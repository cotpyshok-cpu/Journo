import {
  ConflictResolutionOption,
  LegEstimate,
  MapProvider,
  RouteConflict,
  TaskItem,
  TransportPref,
  TravelMode,
} from "./types";
import { formatMinutesToTime, haversineKm, parseTimeToMinutes } from "./utils";

export interface MatrixPoint {
  id: string;
  lat: number;
  lng: number;
}

export interface LegMatrixCell {
  distanceKm: number;
  walkMin: number;
  transitMin: number;
  noTransitNote?: string;
}

export interface SolveScheduleInput {
  origin: { lat: number; lng: number; label: string };
  tasks: TaskItem[];
  transportPref: TransportPref;
  dayStartMin?: number; // e.g., 510 = 08:30
  plannedOrderOffset?: number;
  offline?: boolean;
  simulateQuotaExhausted?: boolean;
  simulatePartialQuota?: boolean;
  trafficDelayMultiplier?: number; // e.g. 1.35 to simulate live traffic slowdown
  previousTasks?: TaskItem[];
}

export interface SolveScheduleResult {
  ok: boolean;
  providerUsed: MapProvider;
  isEstimateWithoutTraffic: boolean;
  scheduledTasks: TaskItem[];
  unscheduledLocationlessIds: string[];
  excludedFreeLimitIds: string[];
  legs: LegEstimate[];
  totalKm: number;
  totalTravelMin: number;
  naiveTravelMin: number;
  savedMin: number;
  conflict: RouteConflict | null;
  deltaMinutes: number;
  deltaKm: number;
  shiftedTasks: { taskId: string; title: string; oldEta: string | null; newEta: string | null }[];
}

function computeCacheCell(a: MatrixPoint, b: MatrixPoint, trafficMultiplier = 1): LegMatrixCell {
  const straightKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
  // Urban Manhattan/arterial winding factor in Astana / major cities
  const roadKm = Math.max(0.2, Number((straightKm * 1.28).toFixed(2)));
  // Walking speed ~ 4.8 km/h => 12.5 min/km
  const walkMin = Math.max(3, Math.round(roadKm * 12.5));

  // Transit: short distances (< 0.45 km) don't benefit from bus/LRT
  if (roadKm < 0.45) {
    return {
      distanceKm: roadKm,
      walkMin,
      transitMin: walkMin + 4,
      noTransitNote: "Short walk — no transit leg needed",
    };
  }

  // Bus/LRT ~ 22 km/h (~2.73 min/km) + 4 min average headway/transfer wait
  const transitMin = Math.max(5, Math.round((roadKm * 2.75 + 4) * trafficMultiplier));
  return {
    distanceKm: roadKm,
    walkMin,
    transitMin,
  };
}

async function tryGoogleMatrix(
  points: MatrixPoint[],
  apiKey: string
): Promise<Map<string, LegMatrixCell> | null> {
  if (!apiKey || points.length > 10) return null;
  const coords = points.map((p) => `${p.lat},${p.lng}`).join("|");
  try {
    const [walkRes, transitRes] = await Promise.all([
      fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
          coords
        )}&destinations=${encodeURIComponent(coords)}&mode=walking&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(2200) }
      ),
      fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
          coords
        )}&destinations=${encodeURIComponent(coords)}&mode=transit&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(2200) }
      ),
    ]);
    if (!walkRes.ok || !transitRes.ok) return null;
    const walkData = await walkRes.json();
    const transitData = await transitRes.json();
    if (walkData.status !== "OK") return null;

    const map = new Map<string, LegMatrixCell>();
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const wEl = walkData.rows?.[i]?.elements?.[j];
        const tEl = transitData.rows?.[i]?.elements?.[j];
        const fallback = computeCacheCell(points[i], points[j]);
        const distanceKm =
          wEl?.status === "OK" && wEl.distance?.value
            ? Number((wEl.distance.value / 1000).toFixed(2))
            : fallback.distanceKm;
        const walkMin =
          wEl?.status === "OK" && wEl.duration?.value
            ? Math.max(2, Math.round(wEl.duration.value / 60))
            : fallback.walkMin;
        const transitAvailable = tEl?.status === "OK" && tEl.duration?.value;
        const transitMin = transitAvailable
          ? Math.max(4, Math.round(tEl.duration.value / 60))
          : fallback.transitMin;
        map.set(`${points[i].id}->${points[j].id}`, {
          distanceKm,
          walkMin,
          transitMin,
          noTransitNote: transitAvailable ? undefined : "No direct transit route — showing walk/fallback",
        });
      }
    }
    return map;
  } catch {
    return null;
  }
}

async function tryHereMatrix(
  points: MatrixPoint[],
  apiKey: string
): Promise<Map<string, LegMatrixCell> | null> {
  if (!apiKey || points.length > 12) return null;
  try {
    const origins = points.map((p) => ({ lat: p.lat, lng: p.lng }));
    const res = await fetch(
      `https://matrix.router.hereapi.com/v8/matrix?apiKey=${encodeURIComponent(apiKey)}&async=false`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origins,
          destinations: origins,
          regionDefinition: { type: "world" },
          transportMode: "pedestrian",
          matrixAttributes: ["travelTimes", "distances"],
        }),
        signal: AbortSignal.timeout(2200),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const times: number[] | undefined = data?.matrix?.travelTimes;
    const distances: number[] | undefined = data?.matrix?.distances;
    if (!times || !distances) return null;

    const n = points.length;
    const map = new Map<string, LegMatrixCell>();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const idx = i * n + j;
        const fallback = computeCacheCell(points[i], points[j]);
        const distM = distances[idx];
        const walkSec = times[idx];
        const distanceKm = distM ? Number((distM / 1000).toFixed(2)) : fallback.distanceKm;
        const walkMin = walkSec ? Math.max(2, Math.round(walkSec / 60)) : fallback.walkMin;
        map.set(`${points[i].id}->${points[j].id}`, {
          distanceKm,
          walkMin,
          transitMin: fallback.transitMin,
        });
      }
    }
    return map;
  } catch {
    return null;
  }
}

async function tryOsrmMatrix(
  points: MatrixPoint[],
  trafficMultiplier = 1
): Promise<Map<string, LegMatrixCell> | null> {
  if (points.length < 2 || points.length > 15) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`,
      { signal: AbortSignal.timeout(1200) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.durations || !data.distances) return null;

    const map = new Map<string, LegMatrixCell>();
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const distM = data.distances[i]?.[j];
        const driveSec = data.durations[i]?.[j];
        const fallback = computeCacheCell(points[i], points[j], trafficMultiplier);
        const distanceKm =
          typeof distM === "number" && distM > 0
            ? Math.max(0.2, Number((distM / 1000).toFixed(2)))
            : fallback.distanceKm;
        const walkMin = Math.max(3, Math.round(distanceKm * 12.5));
        const transitMin =
          typeof driveSec === "number" && driveSec > 0
            ? Math.max(5, Math.round(((driveSec / 60) * 1.45 + 4) * trafficMultiplier))
            : fallback.transitMin;
        map.set(`${points[i].id}->${points[j].id}`, {
          distanceKm,
          walkMin,
          transitMin,
          noTransitNote: distanceKm < 0.45 ? "Short walk — no transit leg needed" : undefined,
        });
      }
    }
    return map;
  } catch {
    return null;
  }
}

export async function buildTravelMatrix(
  points: MatrixPoint[],
  options: {
    offline?: boolean;
    simulateQuotaExhausted?: boolean;
    trafficDelayMultiplier?: number;
  }
): Promise<{
  matrix: Map<string, LegMatrixCell>;
  providerUsed: MapProvider;
  isEstimateWithoutTraffic: boolean;
}> {
  const trafficMult = options.trafficDelayMultiplier ?? 1;

  if (!options.offline && !options.simulateQuotaExhausted && points.length >= 2) {
    const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
    if (googleKey) {
      const gm = await tryGoogleMatrix(points, googleKey);
      if (gm) {
        return { matrix: gm, providerUsed: "GOOGLE", isEstimateWithoutTraffic: false };
      }
    }

    const hereKey = process.env.HERE_API_KEY?.trim() || "";
    if (hereKey) {
      const hm = await tryHereMatrix(points, hereKey);
      if (hm) {
        return { matrix: hm, providerUsed: "HERE", isEstimateWithoutTraffic: false };
      }
    }

    // Failover to OSRM (live geometry, no live traffic)
    if (trafficMult === 1) {
      const osrm = await tryOsrmMatrix(points, trafficMult);
      if (osrm) {
        return { matrix: osrm, providerUsed: "OSRM", isEstimateWithoutTraffic: true };
      }
    }
  }

  // Final failover: local deterministic Astana/city matrix cache
  const cacheMap = new Map<string, LegMatrixCell>();
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      cacheMap.set(
        `${points[i].id}->${points[j].id}`,
        computeCacheCell(points[i], points[j], trafficMult)
      );
    }
  }
  return {
    matrix: cacheMap,
    providerUsed: "CACHE",
    isEstimateWithoutTraffic: true,
  };
}

function getCell(
  matrix: Map<string, LegMatrixCell>,
  fromId: string,
  toId: string,
  pointsMap: Map<string, MatrixPoint>,
  trafficMult = 1
): LegMatrixCell {
  const hit = matrix.get(`${fromId}->${toId}`);
  if (hit) return hit;
  const a = pointsMap.get(fromId);
  const b = pointsMap.get(toId);
  if (a && b) return computeCacheCell(a, b, trafficMult);
  return { distanceKm: 1.5, walkMin: 18, transitMin: 10 };
}

function getModeTravelMin(mode: TravelMode, cell: LegMatrixCell): number {
  if (mode === "WALK") return cell.walkMin;
  if (mode === "CAR" || mode === "CARPOOL") return Math.max(4, Math.round(cell.distanceKm * 2.1 + 3));
  if (mode === "TAXI") return Math.max(4, Math.round(cell.distanceKm * 1.85 + 2));
  return cell.transitMin;
}

function evaluateLegMode(
  cell: LegMatrixCell,
  task: TaskItem,
  transportPref: TransportPref,
  secondModeNotCalculated: boolean,
  carContinuityActive = false
): {
  chosenMode: TravelMode;
  fastestMode: TravelMode | null;
  isEqualSpeed: boolean;
  travelMin: number;
  suggestSecondMode: boolean;
} {
  const walkMin = cell.walkMin;
  const transitMin = cell.transitMin;
  const carMin = getModeTravelMin("CAR", cell);
  const diff = Math.abs(walkMin - transitMin);
  const isEqualSpeed = diff < 3;
  const fastestMode: TravelMode | null =
    transportPref === "CAR" || carContinuityActive
      ? carMin <= walkMin && carMin <= transitMin
        ? "CAR"
        : isEqualSpeed
          ? null
          : walkMin <= transitMin
            ? "WALK"
            : "TRANSIT"
      : isEqualSpeed
        ? null
        : walkMin <= transitMin
          ? "WALK"
          : "TRANSIT";

  if (secondModeNotCalculated && !task.legModeChosenByUser) {
    const primary: TravelMode =
      transportPref === "CAR" || carContinuityActive
        ? "CAR"
        : transportPref === "TRANSIT"
          ? "TRANSIT"
          : "WALK";
    return {
      chosenMode: primary,
      fastestMode: null,
      isEqualSpeed: false,
      travelMin: getModeTravelMin(primary, cell),
      suggestSecondMode: false,
    };
  }

  if (task.legModeChosenByUser && task.legMode) {
    return {
      chosenMode: task.legMode,
      fastestMode,
      isEqualSpeed,
      travelMin: getModeTravelMin(task.legMode, cell),
      suggestSecondMode: false,
    };
  }

  if (transportPref === "CAR" || carContinuityActive) {
    return {
      chosenMode: "CAR",
      fastestMode,
      isEqualSpeed: false,
      travelMin: carMin,
      suggestSecondMode: false,
    };
  }

  if (transportPref === "WALK") {
    return {
      chosenMode: "WALK",
      fastestMode: null,
      isEqualSpeed: false,
      travelMin: walkMin,
      suggestSecondMode: walkMin > 35 && transitMin < walkMin - 8,
    };
  }

  if (transportPref === "TRANSIT") {
    return {
      chosenMode: "TRANSIT",
      fastestMode: null,
      isEqualSpeed: false,
      travelMin: transitMin,
      suggestSecondMode: Boolean(cell.noTransitNote),
    };
  }

  // BOTH modes enabled
  const autoMode: TravelMode = cell.noTransitNote
    ? "WALK"
    : fastestMode ?? (walkMin <= transitMin ? "WALK" : "TRANSIT");
  return {
    chosenMode: autoMode,
    fastestMode,
    isEqualSpeed,
    travelMin: getModeTravelMin(autoMode, cell),
    suggestSecondMode: false,
  };
}

function getEffectiveTravelMin(
  cell: LegMatrixCell,
  task: TaskItem,
  transportPref: TransportPref,
  carContinuityActive = false
): number {
  return evaluateLegMode(cell, task, transportPref, false, carContinuityActive).travelMin;
}

function simulateOrder(
  orderedTasks: TaskItem[],
  startMin: number,
  matrix: Map<string, LegMatrixCell>,
  pointsMap: Map<string, MatrixPoint>,
  transportPref: TransportPref
): {
  feasible: boolean;
  totalTravelMin: number;
  roundTripScoreMin: number;
  totalKm: number;
  carContinuityActive: boolean;
  failedTaskId?: string;
  failedReason?: string;
  schedule: {
    task: TaskItem;
    departureMin: number;
    arrivalMin: number;
    startServiceMin: number;
    endServiceMin: number;
    bufferMin: number;
    travelMin: number;
    distanceKm: number;
  }[];
} {
  let currentTime = startMin;
  let prevId = "START";
  let totalTravelMin = 0;
  let totalKm = 0;
  let carActive = transportPref === "CAR";
  const schedule = [];

  for (const task of orderedTasks) {
    const cell = getCell(matrix, prevId, task.id, pointsMap);
    const evalRes = evaluateLegMode(cell, task, transportPref, false, carActive);
    if (evalRes.chosenMode === "CAR") {
      carActive = true;
    } else if (prevId === "START" && task.legModeChosenByUser) {
      // User explicitly left home without car on first leg
      carActive = false;
    }
    const travelMin = evalRes.travelMin;
    const departureMin = currentTime;
    const arrivalMin = departureMin + travelMin;
    const wStart = parseTimeToMinutes(task.windowStart);
    const wEnd = parseTimeToMinutes(task.windowEnd);
    const effectiveDur = task.durationMin + (task.extendedMin || 0);

    if (!task.isFlexible && wEnd !== null && arrivalMin > wEnd) {
      return {
        feasible: false,
        totalTravelMin,
        roundTripScoreMin: totalTravelMin,
        totalKm,
        carContinuityActive: carActive,
        failedTaskId: task.id,
        failedReason: `"${task.title}" arrives at ${formatMinutesToTime(
          arrivalMin
        )}, missing its ${task.windowStart ?? ""}-${task.windowEnd} window.`,
        schedule: [],
      };
    }

    const startServiceMin = wStart !== null ? Math.max(arrivalMin, wStart) : arrivalMin;
    const endServiceMin = startServiceMin + effectiveDur;

    if (!task.isFlexible && wEnd !== null && startServiceMin > wEnd) {
      return {
        feasible: false,
        totalTravelMin,
        roundTripScoreMin: totalTravelMin,
        totalKm,
        carContinuityActive: carActive,
        failedTaskId: task.id,
        failedReason: `"${task.title}" cannot start before window end ${task.windowEnd}.`,
        schedule: [],
      };
    }

    const bufferMin =
      wEnd !== null ? wEnd - arrivalMin : Math.max(10, Math.round(travelMin * 0.25) + 12);

    totalTravelMin += travelMin;
    totalKm += cell.distanceKm;
    schedule.push({
      task,
      departureMin,
      arrivalMin,
      startServiceMin,
      endServiceMin,
      bufferMin,
      travelMin,
      distanceKm: cell.distanceKm,
    });
    currentTime = endServiceMin;
    prevId = task.id;
  }

  // If user left Home on a car, optimize stop order so the last stop finishes closer to Home for the drive back.
  let roundTripScoreMin = totalTravelMin;
  if (carActive && orderedTasks.length > 0) {
    const lastTask = orderedTasks[orderedTasks.length - 1];
    const returnCell = getCell(matrix, lastTask.id, "START", pointsMap);
    roundTripScoreMin += getModeTravelMin("CAR", returnCell);
  }

  return {
    feasible: true,
    totalTravelMin,
    roundTripScoreMin,
    totalKm: Number(totalKm.toFixed(2)),
    carContinuityActive: carActive,
    schedule,
  };
}

export async function solveDailySchedule(
  input: SolveScheduleInput
): Promise<SolveScheduleResult> {
  const dayStartMin = input.dayStartMin ?? 510; // 08:30 default morning start
  const unscheduledLocationlessIds: string[] = [];
  const excludedFreeLimitIds: string[] = [];
  const routableTasks: TaskItem[] = [];

  for (const task of input.tasks) {
    if (task.status === "DONE" || task.status === "SKIPPED") {
      continue;
    }
    if (task.exceedsFreeLimit) {
      excludedFreeLimitIds.push(task.id);
      continue;
    }
    if (task.lat == null || task.lng == null) {
      unscheduledLocationlessIds.push(task.id);
      continue;
    }
    routableTasks.push(task);
  }

  if (routableTasks.length === 0) {
    return {
      ok: true,
      providerUsed: input.offline || input.simulateQuotaExhausted ? "CACHE" : "CACHE",
      isEstimateWithoutTraffic: true,
      scheduledTasks: [],
      unscheduledLocationlessIds,
      excludedFreeLimitIds,
      legs: [],
      totalKm: 0,
      totalTravelMin: 0,
      naiveTravelMin: 0,
      savedMin: 0,
      conflict: null,
      deltaMinutes: 0,
      deltaKm: 0,
      shiftedTasks: [],
    };
  }

  const points: MatrixPoint[] = [
    { id: "START", lat: input.origin.lat, lng: input.origin.lng },
    ...routableTasks.map((t) => ({ id: t.id, lat: t.lat!, lng: t.lng! })),
  ];
  const pointsMap = new Map(points.map((p) => [p.id, p]));

  const { matrix, providerUsed, isEstimateWithoutTraffic } = await buildTravelMatrix(points, {
    offline: input.offline,
    simulateQuotaExhausted: input.simulateQuotaExhausted,
    trafficDelayMultiplier: input.trafficDelayMultiplier,
  });

  // Separate Hard Anchors and Flexible Tasks
  const hardAnchors = routableTasks
    .filter((t) => !t.isFlexible && t.windowStart && t.windowEnd)
    .sort(
      (a, b) =>
        (parseTimeToMinutes(a.windowStart) ?? 0) - (parseTimeToMinutes(b.windowStart) ?? 0)
    );
  const flexTasks = routableTasks.filter((t) => t.isFlexible || !t.windowStart || !t.windowEnd);

  // Step 1: Check Hard Anchor feasibility (E6.1)
  const anchorCheck = simulateOrder(
    hardAnchors,
    dayStartMin,
    matrix,
    pointsMap,
    input.transportPref
  );

  if (!anchorCheck.feasible) {
    const failedId = anchorCheck.failedTaskId;
    const failedIdx = hardAnchors.findIndex((t) => t.id === failedId);
    const prevAnchor = failedIdx > 0 ? hardAnchors[failedIdx - 1] : null;
    const failedAnchor = failedIdx >= 0 ? hardAnchors[failedIdx] : hardAnchors[0];
    const affected = [prevAnchor, failedAnchor].filter(Boolean) as TaskItem[];

    const options: ConflictResolutionOption[] = [];
    if (flexTasks.length > 0) {
      options.push({
        id: "REMOVE_FLEXIBLE",
        label: `Unschedule "${flexTasks[0].title}" to clear buffer`,
        description: "Keep flexible errand in inbox for tomorrow.",
        targetTaskId: flexTasks[0].id,
      });
    }
    if (failedAnchor) {
      options.push({
        id: "SHIFT_WINDOW",
        label: `Shift "${failedAnchor.title}" window +45 min`,
        description: "Move the second hard window later to eliminate the overlap.",
        targetTaskId: failedAnchor.id,
      });
    }
    if (input.transportPref !== "BOTH") {
      options.push({
        id: "ENABLE_BOTH_MODES",
        label: "Enable both Walk & Transit",
        description: "Use faster transit hops between distant anchors.",
      });
    }

    return {
      ok: false,
      providerUsed,
      isEstimateWithoutTraffic,
      scheduledTasks: routableTasks.map((t) => ({
        ...t,
        status: affected.some((a) => a.id === t.id) ? "CONFLICT" : t.status,
      })),
      unscheduledLocationlessIds,
      excludedFreeLimitIds,
      legs: [],
      totalKm: 0,
      totalTravelMin: 0,
      naiveTravelMin: 0,
      savedMin: 0,
      conflict: {
        reason:
          anchorCheck.failedReason ||
          "Time windows overlap or travel time exceeds the available gap between hard anchors.",
        affectedTaskIds: affected.map((t) => t.id),
        affectedTitles: affected.map((t) => t.title),
        options,
      },
      deltaMinutes: 0,
      deltaKm: 0,
      shiftedTasks: [],
    };
  }

  // Step 2: Insert Flexible Tasks using branch-and-bound / cheapest feasible insertion
  let bestOrder: TaskItem[] = [...hardAnchors];
  let bestSim = anchorCheck;

  for (const flex of flexTasks) {
    let localBestOrder: TaskItem[] | null = null;
    let localBestSim: ReturnType<typeof simulateOrder> | null = null;

    for (let pos = 0; pos <= bestOrder.length; pos++) {
      const candidate = [...bestOrder.slice(0, pos), flex, ...bestOrder.slice(pos)];
      const sim = simulateOrder(candidate, dayStartMin, matrix, pointsMap, input.transportPref);
      if (sim.feasible) {
        if (!localBestSim || sim.roundTripScoreMin < localBestSim.roundTripScoreMin) {
          localBestOrder = candidate;
          localBestSim = sim;
        }
      }
    }

    if (localBestOrder && localBestSim) {
      bestOrder = localBestOrder;
      bestSim = localBestSim;
    } else {
      // Flexible task cannot fit before a hard anchor; check if conflict needs resolution
      const conflictOptions: ConflictResolutionOption[] = [
        {
          id: "REMOVE_FLEXIBLE",
          label: `Keep "${flex.title}" unscheduled for tomorrow`,
          description: "Preserve all fixed anchors without rushing.",
          targetTaskId: flex.id,
        },
      ];
      if (hardAnchors.length > 0) {
        conflictOptions.push({
          id: "SHIFT_WINDOW",
          label: `Shift "${hardAnchors[hardAnchors.length - 1].title}" +45 min`,
          description: "Open a wider midday gap for flexible tasks.",
          targetTaskId: hardAnchors[hardAnchors.length - 1].id,
        });
      }
      if (input.transportPref !== "BOTH") {
        conflictOptions.push({
          id: "ENABLE_BOTH_MODES",
          label: "Enable both Walk & Transit",
          description: "Reduce travel time between stops.",
        });
      }

      return {
        ok: false,
        providerUsed,
        isEstimateWithoutTraffic,
        scheduledTasks: routableTasks,
        unscheduledLocationlessIds,
        excludedFreeLimitIds,
        legs: [],
        totalKm: 0,
        totalTravelMin: 0,
        naiveTravelMin: 0,
        savedMin: 0,
        conflict: {
          reason: `Not enough gap time to fit flexible task "${flex.title}" (${flex.durationMin} min) without missing a fixed appointment.`,
          affectedTaskIds: [flex.id, ...hardAnchors.map((a) => a.id)],
          affectedTitles: [flex.title, ...hardAnchors.map((a) => a.title)],
          options: conflictOptions,
        },
        deltaMinutes: 0,
        deltaKm: 0,
        shiftedTasks: [],
      };
    }
  }

  // Step 3: Compute Naive order travel time (original array order) for Evening Review / Savings metric
  let naiveTravelMin = 0;
  let naivePrev = "START";
  let naiveCarActive = input.transportPref === "CAR";
  for (const t of routableTasks) {
    const cell = getCell(matrix, naivePrev, t.id, pointsMap);
    const naiveEval = evaluateLegMode(cell, t, input.transportPref, false, naiveCarActive);
    if (naiveEval.chosenMode === "CAR") naiveCarActive = true;
    naiveTravelMin += naiveEval.travelMin;
    naivePrev = t.id;
  }
  // Ensure realistic saved comparison even if user happened to input them in near-optimal order
  const optimizedTravelMin = bestSim.totalTravelMin;
  const savedMin = Math.max(0, naiveTravelMin - optimizedTravelMin);

  // Step 4: Build per-leg metadata & scheduled TaskItems
  const legs: LegEstimate[] = [];
  const scheduledTasks: TaskItem[] = [];
  const totalLegs = bestSim.schedule.length;
  let prevStopId: string | "START" = "START";
  let carContinuityActive = input.transportPref === "CAR";

  for (let idx = 0; idx < totalLegs; idx++) {
    const slot = bestSim.schedule[idx];
    const cell = getCell(matrix, prevStopId, slot.task.id, pointsMap);
    const secondModeNotCalculated = Boolean(
      input.simulatePartialQuota && idx >= Math.ceil(totalLegs / 2)
    );
    const evalMode = evaluateLegMode(
      cell,
      slot.task,
      input.transportPref,
      secondModeNotCalculated,
      carContinuityActive
    );
    if (evalMode.chosenMode === "CAR") {
      carContinuityActive = true;
    } else if (idx === 0 && slot.task.legModeChosenByUser) {
      carContinuityActive = false;
    }

    const wEnd = parseTimeToMinutes(slot.task.windowEnd);
    const lateWarning =
      evalMode.chosenMode !== evalMode.fastestMode &&
      wEnd !== null &&
      slot.arrivalMin > wEnd - 3
        ? `Manual mode leaves tight or late arrival; ${evalMode.fastestMode?.toLowerCase()} is faster.`
        : undefined;

    legs.push({
      fromTaskId: prevStopId,
      toTaskId: slot.task.id,
      walkMin: cell.walkMin,
      transitMin: cell.transitMin,
      distanceKm: cell.distanceKm,
      chosenMode: evalMode.chosenMode,
      fastestMode: evalMode.fastestMode,
      isEqualSpeed: evalMode.isEqualSpeed,
      chosenByUser: slot.task.legModeChosenByUser,
      secondModeNotCalculated,
      suggestSecondMode: evalMode.suggestSecondMode,
      noTransitNote: cell.noTransitNote,
      lateWarning,
    });

    scheduledTasks.push({
      ...slot.task,
      status: slot.task.status === "CONFLICT" ? "PLANNED" : slot.task.status,
      plannedOrder: (input.plannedOrderOffset ?? 0) + idx + 1,
      departureTime: formatMinutesToTime(slot.departureMin),
      eta: formatMinutesToTime(slot.arrivalMin),
      bufferMin: slot.bufferMin,
      legMode: evalMode.chosenMode,
      legDurationWalkMin: cell.walkMin,
      legDurationTransitMin: secondModeNotCalculated ? null : cell.transitMin,
      legDistanceKm: cell.distanceKm,
    });

    prevStopId = slot.task.id;
  }

  // Step 5: Compute Delta vs Previous Plan (for S13 comparison)
  const prevTasks = input.previousTasks ?? [];
  const prevTotalTravel = prevTasks.reduce((sum, t) => {
    if (t.legMode === "WALK") return sum + (t.legDurationWalkMin ?? 0);
    if (t.legMode === "CAR" || t.legMode === "CARPOOL") {
      return sum + Math.max(4, Math.round((t.legDistanceKm ?? 0) * 2.1 + 3));
    }
    if (t.legMode === "TAXI") {
      return sum + Math.max(4, Math.round((t.legDistanceKm ?? 0) * 1.85 + 2));
    }
    return sum + (t.legDurationTransitMin ?? t.legDurationWalkMin ?? 0);
  }, 0);
  const prevTotalKm = prevTasks.reduce((sum, t) => sum + (t.legDistanceKm ?? 0), 0);

  const prevEtaMap = new Map(prevTasks.map((t) => [t.id, t.eta]));
  const shiftedTasks = scheduledTasks
    .filter((t) => {
      const oldEta = prevEtaMap.get(t.id);
      return oldEta !== undefined && oldEta !== t.eta;
    })
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      oldEta: prevEtaMap.get(t.id) ?? null,
      newEta: t.eta,
    }));

  const deltaMinutes = prevTasks.length > 0 ? optimizedTravelMin - prevTotalTravel : 0;
  const deltaKm =
    prevTasks.length > 0 ? Number((bestSim.totalKm - prevTotalKm).toFixed(2)) : 0;

  return {
    ok: true,
    providerUsed,
    isEstimateWithoutTraffic,
    scheduledTasks,
    unscheduledLocationlessIds,
    excludedFreeLimitIds,
    legs,
    totalKm: bestSim.totalKm,
    totalTravelMin: optimizedTravelMin,
    naiveTravelMin,
    savedMin,
    conflict: null,
    deltaMinutes,
    deltaKm,
    shiftedTasks,
  };
}
