import {
  DailyBudgetSummary,
  PriceIntelEntry,
  PriceSource,
  TaskBudgetRecord,
  TaskItem,
  TransportCostProfile,
  TravelMode,
} from "@/lib/types";

export const STORAGE_KEYS = {
  PRICE_INTEL: "journo_price_intel_v1",
  TASK_BUDGETS: "journo_task_budgets_v1",
  TRANSPORT_PROFILE: "journo_transport_profile_v1",
} as const;

export const DEFAULT_TRANSPORT_PROFILE: TransportCostProfile = {
  hasPersonalCar: true,
  vehicleType: "GAS",
  fuelEfficiencyMpg: 28,
  gasPricePerGal: 3.45,
  evKwhPer100Km: 17.5,
  elecPricePerKwh: 0.16,
  defaultParkingCost: 2.0,
  transitBaseFare: 0.5,
  transitDailyCapPerPerson: 2.0,
  hasUnlimitedTransitPass: false,
};

interface ExternalBenchmark {
  venueKey: string;
  venueName: string;
  category: string;
  perPerson: number;
  source: "GOOGLE_PLACES" | "TICKETMASTER" | "YELP";
}

const EXTERNAL_BENCHMARKS: ExternalBenchmark[] = [
  {
    venueKey: "koktem coffee",
    venueName: "Koktem Coffee",
    category: "cafe",
    perPerson: 6.5,
    source: "GOOGLE_PLACES",
  },
  {
    venueKey: "talan towers",
    venueName: "Talan Towers",
    category: "restaurant",
    perPerson: 16.0,
    source: "YELP",
  },
  {
    venueKey: "khan shatyr",
    venueName: "Khan Shatyr",
    category: "cinema",
    perPerson: 11.0,
    source: "TICKETMASTER",
  },
  {
    venueKey: "mega silk way",
    venueName: "Mega Silk Way",
    category: "mall",
    perPerson: 18.0,
    source: "GOOGLE_PLACES",
  },
  {
    venueKey: "europharma",
    venueName: "Europharma",
    category: "pharmacy",
    perPerson: 8.5,
    source: "GOOGLE_PLACES",
  },
  {
    venueKey: "world class",
    venueName: "World Class Gym",
    category: "fitness",
    perPerson: 12.0,
    source: "YELP",
  },
  {
    venueKey: "baiterek tower",
    venueName: "Baiterek Tower",
    category: "event",
    perPerson: 7.0,
    source: "TICKETMASTER",
  },
  {
    venueKey: "astana hub",
    venueName: "Astana Hub",
    category: "office",
    perPerson: 0,
    source: "GOOGLE_PLACES",
  },
  {
    venueKey: "nazarbayev university",
    venueName: "Nazarbayev University",
    category: "office",
    perPerson: 0,
    source: "GOOGLE_PLACES",
  },
];

/**
 * Initial seeded personal Price Intelligence records so first-time reviewers
 * can immediately observe how a 2nd+ visit overrides online benchmarks.
 */
export function getInitialPriceIntel(): PriceIntelEntry[] {
  const now = new Date().toISOString();
  return [
    {
      venueKey: "koktem coffee",
      venueName: "Koktem Coffee",
      category: "cafe",
      benchmarkPerPerson: 6.5,
      benchmarkSource: "GOOGLE_PLACES",
      visitCount: 2,
      avgSpendPerPerson: 5.25,
      lastSpendPerPerson: 5.25,
      history: [5.5, 5.0],
      updatedAt: now,
    },
    {
      venueKey: "khan shatyr",
      venueName: "Khan Shatyr",
      category: "cinema",
      benchmarkPerPerson: 11.0,
      benchmarkSource: "TICKETMASTER",
      visitCount: 0,
      avgSpendPerPerson: 11.0,
      lastSpendPerPerson: null,
      history: [],
      updatedAt: now,
    },
    {
      venueKey: "talan towers",
      venueName: "Talan Towers",
      category: "restaurant",
      benchmarkPerPerson: 16.0,
      benchmarkSource: "YELP",
      visitCount: 0,
      avgSpendPerPerson: 16.0,
      lastSpendPerPerson: null,
      history: [],
      updatedAt: now,
    },
    {
      venueKey: "mega silk way",
      venueName: "Mega Silk Way",
      category: "mall",
      benchmarkPerPerson: 18.0,
      benchmarkSource: "GOOGLE_PLACES",
      visitCount: 0,
      avgSpendPerPerson: 18.0,
      lastSpendPerPerson: null,
      history: [],
      updatedAt: now,
    },
    {
      venueKey: "europharma",
      venueName: "Europharma",
      category: "pharmacy",
      benchmarkPerPerson: 8.5,
      benchmarkSource: "GOOGLE_PLACES",
      visitCount: 0,
      avgSpendPerPerson: 8.5,
      lastSpendPerPerson: null,
      history: [],
      updatedAt: now,
    },
  ];
}

export function normalizeVenueKey(locationName?: string | null, title?: string): string {
  const raw = (locationName || title || "errand")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const bench of EXTERNAL_BENCHMARKS) {
    if (raw.includes(bench.venueKey)) return bench.venueKey;
  }
  return raw.slice(0, 60) || "errand";
}

export function inferExternalBenchmark(
  locationName?: string | null,
  title?: string
): ExternalBenchmark {
  const combined = `${locationName || ""} ${title || ""}`.toLowerCase();

  for (const bench of EXTERNAL_BENCHMARKS) {
    if (combined.includes(bench.venueKey)) {
      // Special check: if task title mentions lunch/dinner at a venue, estimate meal cost
      if (
        (combined.includes("lunch") || combined.includes("dinner") || combined.includes("cafe")) &&
        bench.perPerson === 0
      ) {
        return {
          ...bench,
          category: "cafe",
          perPerson: 14.0,
          source: "YELP",
        };
      }
      return bench;
    }
  }

  if (/(?:cinema|movie|film|кино|imax|chaplin|concert|ticket|билет|theater)/i.test(combined)) {
    return {
      venueKey: normalizeVenueKey(locationName, title),
      venueName: locationName || title || "Cinema / Event",
      category: "cinema",
      perPerson: 11.0,
      source: "TICKETMASTER",
    };
  }

  if (/(?:lunch|dinner|restaurant|обед|ужин|bistro|steak)/i.test(combined)) {
    return {
      venueKey: normalizeVenueKey(locationName, title),
      venueName: locationName || title || "Dining",
      category: "restaurant",
      perPerson: 15.0,
      source: "YELP",
    };
  }

  if (/(?:coffee|cafe|кафе|кофе|latte|bakery|croissant)/i.test(combined)) {
    return {
      venueKey: normalizeVenueKey(locationName, title),
      venueName: locationName || title || "Cafe",
      category: "cafe",
      perPerson: 6.5,
      source: "GOOGLE_PLACES",
    };
  }

  if (/(?:pharm|аптек|clinic|medic|visa)/i.test(combined)) {
    return {
      venueKey: normalizeVenueKey(locationName, title),
      venueName: locationName || title || "Pharmacy",
      category: "pharmacy",
      perPerson: 9.0,
      source: "GOOGLE_PLACES",
    };
  }

  if (/(?:mall|shop|market|grocer|store|магазин|купить|contract)/i.test(combined)) {
    return {
      venueKey: normalizeVenueKey(locationName, title),
      venueName: locationName || title || "Retail Stop",
      category: "mall",
      perPerson: combined.includes("contract") ? 0 : 18.0,
      source: "GOOGLE_PLACES",
    };
  }

  if (/(?:pitch|demo|meeting|office|work|совещ|универ)/i.test(combined)) {
    return {
      venueKey: normalizeVenueKey(locationName, title),
      venueName: locationName || title || "Meeting",
      category: "office",
      perPerson: 0,
      source: "GOOGLE_PLACES",
    };
  }

  return {
    venueKey: normalizeVenueKey(locationName, title),
    venueName: locationName || title || "Errand Stop",
    category: "general",
    perPerson: 10.0,
    source: "GOOGLE_PLACES",
  };
}

export function estimateVenueBudget(params: {
  locationName?: string | null;
  title?: string;
  partySize: number;
  priceIntel: PriceIntelEntry[];
  customPerPerson?: number | null;
}): {
  perPerson: number;
  total: number;
  source: PriceSource;
  sourceLabel: string;
} {
  const pax = Math.max(1, params.partySize || 1);
  if (params.customPerPerson != null && params.customPerPerson >= 0) {
    const perPerson = Number(params.customPerPerson.toFixed(2));
    return {
      perPerson,
      total: Number((perPerson * pax).toFixed(2)),
      source: "CUSTOM",
      sourceLabel: `Custom · $${perPerson.toFixed(2)}/person`,
    };
  }

  const key = normalizeVenueKey(params.locationName, params.title);
  const learned = params.priceIntel.find((entry) => entry.venueKey === key);

  // Starting from 2nd visit (visitCount >= 1 recorded previously), prioritize personal history
  if (learned && learned.visitCount >= 1) {
    const perPerson = Number(learned.avgSpendPerPerson.toFixed(2));
    return {
      perPerson,
      total: Number((perPerson * pax).toFixed(2)),
      source: "PRICE_INTEL",
      sourceLabel: `Your avg · $${perPerson.toFixed(2)}/person`,
    };
  }

  const bench = inferExternalBenchmark(params.locationName, params.title);
  const perPerson = Number(bench.perPerson.toFixed(2));

  return {
    perPerson,
    total: Number((perPerson * pax).toFixed(2)),
    source: bench.source,
    sourceLabel:
      perPerson > 0
        ? `Typical ~$${perPerson.toFixed(2)}/person`
        : "No venue spend",
  };
}

export function recordPersonalVisitSpend(
  entries: PriceIntelEntry[],
  params: {
    locationName?: string | null;
    title: string;
    actualTotalSpend: number;
    partySize: number;
  }
): PriceIntelEntry[] {
  const pax = Math.max(1, params.partySize || 1);
  const perPerson = Number((Math.max(0, params.actualTotalSpend) / pax).toFixed(2));
  const key = normalizeVenueKey(params.locationName, params.title);
  const bench = inferExternalBenchmark(params.locationName, params.title);
  const now = new Date().toISOString();

  const existingIdx = entries.findIndex((e) => e.venueKey === key);
  if (existingIdx >= 0) {
    const existing = entries[existingIdx];
    const nextHistory = [...existing.history, perPerson].slice(-12);
    const sum = nextHistory.reduce((acc, v) => acc + v, 0);
    const avg = Number((sum / nextHistory.length).toFixed(2));
    const updated: PriceIntelEntry = {
      ...existing,
      visitCount: existing.visitCount + 1,
      avgSpendPerPerson: avg,
      lastSpendPerPerson: perPerson,
      history: nextHistory,
      updatedAt: now,
    };
    const next = [...entries];
    next[existingIdx] = updated;
    return next;
  }

  return [
    {
      venueKey: key,
      venueName: params.locationName || params.title,
      category: bench.category,
      benchmarkPerPerson: bench.perPerson,
      benchmarkSource: bench.source,
      visitCount: 1,
      avgSpendPerPerson: perPerson,
      lastSpendPerPerson: perPerson,
      history: [perPerson],
      updatedAt: now,
    },
    ...entries,
  ];
}

export interface MultiModalLegBreakdown {
  walkMin: number;
  walkCost: number;
  transitMin: number;
  transitCost: number;
  transitNote: string;
  carMin: number;
  carCost: number;
  carNote: string;
  taxiMin: number;
  taxiCost: number;
  carpoolMin: number;
  carpoolCost: number;
  carpoolNote: string;
  fastestMode: TravelMode;
  cheapestPaidMode: TravelMode;
  dailyCapApplied: boolean;
}

export function calculateLegTransportOptions(params: {
  distanceKm: number;
  walkMin: number;
  transitMin: number;
  partySize: number;
  profile: TransportCostProfile;
  transitSpentSoFarTotal: number;
  parkingCostOverride?: number | null;
  friendRideCostOverride?: number | null;
  friendRideNote?: string | null;
}): MultiModalLegBreakdown {
  const { distanceKm, walkMin, transitMin, profile, transitSpentSoFarTotal } = params;
  const pax = Math.max(1, params.partySize || 1);

  const carMin = Math.max(4, Math.round(distanceKm * 2.1 + 3));
  const taxiMin = Math.max(4, Math.round(distanceKm * 1.85 + 2));

  // Public Transit calculation: transfers (> 6.5 km) + passenger multiplier + pass / daily cap
  let transitCost = 0;
  let transitNote = "";
  let dailyCapApplied = false;

  if (profile.hasUnlimitedTransitPass) {
    transitCost = 0;
    transitNote = "Unlimited pass active ($0)";
  } else {
    const transfersMultiplier = distanceKm > 6.5 ? 1.5 : 1;
    const rawTransit = Number((profile.transitBaseFare * transfersMultiplier * pax).toFixed(2));
    const maxDailyForGroup = Number((profile.transitDailyCapPerPerson * pax).toFixed(2));
    const remainingCap = Math.max(0, Number((maxDailyForGroup - transitSpentSoFarTotal).toFixed(2)));

    if (remainingCap <= 0) {
      transitCost = 0;
      dailyCapApplied = true;
      transitNote = `Daily cap ($${maxDailyForGroup.toFixed(2)}) reached`;
    } else if (rawTransit > remainingCap) {
      transitCost = remainingCap;
      dailyCapApplied = true;
      transitNote = `Daily cap applied · ${pax} pax`;
    } else {
      transitCost = rawTransit;
      transitNote = distanceKm > 6.5 ? `Bus/LRT transfer · ${pax} pax` : `${pax} pax fare`;
    }
  }

  // Personal Car (Gas MPG or EV kWh) + Parking
  const parking =
    params.parkingCostOverride != null ? params.parkingCostOverride : profile.defaultParkingCost;
  let energyCost = 0;
  let carNote = "";

  if (profile.vehicleType === "EV") {
    const kwhUsed = (distanceKm / 100) * profile.evKwhPer100Km;
    energyCost = kwhUsed * profile.elecPricePerKwh;
    carNote = `${kwhUsed.toFixed(1)} kWh ($${energyCost.toFixed(2)}) + $${parking.toFixed(2)} park`;
  } else {
    const miles = distanceKm * 0.621371;
    const gallons = miles / Math.max(8, profile.fuelEfficiencyMpg);
    energyCost = gallons * profile.gasPricePerGal;
    carNote = `Fuel $${energyCost.toFixed(2)} + $${parking.toFixed(2)} park`;
  }
  const carCost = Number((energyCost + parking).toFixed(2));

  // Taxi / Ride-hail estimate (scales per carload of 4)
  const carsNeeded = Math.max(1, Math.ceil(pax / 4));
  const taxiCost = Number(
    ((1.8 + distanceKm * 0.65 + taxiMin * 0.12) * carsNeeded).toFixed(2)
  );

  // Friend ride / Carpool option (available even without personal car)
  const carpoolMin = carMin;
  const carpoolCost = Number(Math.max(0, params.friendRideCostOverride ?? 0).toFixed(2));
  const carpoolNote = params.friendRideNote?.trim()
    ? params.friendRideNote.trim()
    : carpoolCost > 0
      ? `Friend ride split $${carpoolCost.toFixed(2)}`
      : "Ride with friends ($0)";

  // Determine fastest among available modes (exclude personal CAR if user has no personal car)
  const hasCar = profile.hasPersonalCar !== false;
  const timePairs: { mode: TravelMode; min: number }[] = [
    { mode: "WALK", min: walkMin },
    { mode: "TRANSIT", min: transitMin },
    ...(hasCar ? [{ mode: "CAR" as const, min: carMin }] : []),
    { mode: "TAXI", min: taxiMin },
  ];
  timePairs.sort((a, b) => a.min - b.min);
  const fastestMode = timePairs[0].mode;

  // Determine cheapest non-walk motorized mode (excluding personal CAR if user doesn't own a car)
  const paidPairs: { mode: TravelMode; cost: number }[] = [
    { mode: "TRANSIT", cost: transitCost },
    ...(hasCar ? [{ mode: "CAR" as const, cost: carCost }] : []),
    { mode: "TAXI", cost: taxiCost },
  ];
  paidPairs.sort((a, b) => a.cost - b.cost);
  const cheapestPaidMode = paidPairs[0].mode;

  return {
    walkMin,
    walkCost: 0,
    transitMin,
    transitCost,
    transitNote,
    carMin,
    carCost,
    carNote,
    taxiMin,
    taxiCost,
    carpoolMin,
    carpoolCost,
    carpoolNote,
    fastestMode,
    cheapestPaidMode,
    dailyCapApplied,
  };
}

export function enrichDayBudgetAndTasks(params: {
  tasks: TaskItem[];
  taskBudgets: Record<string, TaskBudgetRecord>;
  priceIntel: PriceIntelEntry[];
  transportProfile: TransportCostProfile;
}): {
  enrichedTasks: TaskItem[];
  legBreakdowns: Map<string, MultiModalLegBreakdown>;
  summary: DailyBudgetSummary;
} {
  const { tasks, taskBudgets, priceIntel: _priceIntel, transportProfile } = params;
  void _priceIntel;
  const legBreakdowns = new Map<string, MultiModalLegBreakdown>();

  const sorted = tasks
    .slice()
    .sort((a, b) => (a.plannedOrder ?? 999) - (b.plannedOrder ?? 999));

  let transitSpentSoFarTotal = 0;
  let plannedTransportTotal = 0;
  let plannedVenueTotal = 0;
  let actualTransportTotal = 0;
  let actualVenueTotal = 0;
  let loggedStopsCount = 0;
  let dailyCapReached = false;

  const enrichedMap = new Map<string, TaskItem>();

  for (const task of sorted) {
    const budgetRec = taskBudgets[task.id];
    // Default partySize heuristic if user hasn't edited yet
    const inferredParty =
      budgetRec?.partySize ??
      (/(?:двоих|for two|couple|на 2|2 pers)/i.test(task.title) ? 2 : 1);

    // Planned Morning Total stays anchored to today's morning baseline & selected party size
    // and is NOT mutated when the user logs actual receipts later in Live Day / Review.
    const baselineVenueEst = estimateVenueBudget({
      locationName: task.locationName,
      title: task.title,
      partySize: inferredParty,
      priceIntel: getInitialPriceIntel(),
      customPerPerson: budgetRec?.customPerPerson ?? null,
    });

    const routable =
      task.lat != null &&
      task.lng != null &&
      !task.exceedsFreeLimit &&
      task.status !== "SKIPPED";
    let legCost = 0;

    if (routable && task.legDistanceKm != null) {
      const breakdown = calculateLegTransportOptions({
        distanceKm: task.legDistanceKm,
        walkMin: task.legDurationWalkMin ?? 14,
        transitMin: task.legDurationTransitMin ?? 9,
        partySize: inferredParty,
        profile: transportProfile,
        transitSpentSoFarTotal,
        parkingCostOverride: budgetRec?.parkingCostOverride ?? null,
        friendRideCostOverride: budgetRec?.friendRideCost ?? null,
        friendRideNote: budgetRec?.friendRideNote ?? null,
      });

      legBreakdowns.set(task.id, breakdown);
      const rawMode = (task.legMode ?? "TRANSIT") as TravelMode;
      const activeMode: TravelMode =
        rawMode === "CAR" && transportProfile.hasPersonalCar === false ? "TRANSIT" : rawMode;

      if (activeMode === "WALK") legCost = 0;
      else if (activeMode === "CAR") legCost = breakdown.carCost;
      else if (activeMode === "TAXI") legCost = breakdown.taxiCost;
      else if (activeMode === "CARPOOL") legCost = breakdown.carpoolCost;
      else {
        legCost = breakdown.transitCost;
        transitSpentSoFarTotal = Number((transitSpentSoFarTotal + legCost).toFixed(2));
        if (breakdown.dailyCapApplied) dailyCapReached = true;
      }

      plannedTransportTotal = Number((plannedTransportTotal + legCost).toFixed(2));
    }

    if (!task.exceedsFreeLimit && task.status !== "SKIPPED") {
      plannedVenueTotal = Number((plannedVenueTotal + baselineVenueEst.total).toFixed(2));
    }

    // Actual transport spend reflects stops marked Started/Done in Live Day (or overridden).
    const roadSpentInLiveDay =
      !task.exceedsFreeLimit &&
      task.status !== "SKIPPED" &&
      (task.status === "DONE" ||
        task.status === "IN_PROGRESS" ||
        budgetRec?.actualTransportSpend != null);

    if (roadSpentInLiveDay) {
      actualTransportTotal = Number(
        (actualTransportTotal + (budgetRec?.actualTransportSpend ?? legCost)).toFixed(2)
      );
    }

    // Actual venue spend adds strictly the real receipts logged by the user on top of road spend.
    if (
      !task.exceedsFreeLimit &&
      task.status !== "SKIPPED" &&
      budgetRec?.actualVenueSpend != null
    ) {
      loggedStopsCount += 1;
      actualVenueTotal = Number((actualVenueTotal + budgetRec.actualVenueSpend).toFixed(2));
    }

    enrichedMap.set(task.id, {
      ...task,
      partySize: inferredParty,
      estimatedCostPerPerson: baselineVenueEst.perPerson,
      estimatedVenueTotal: baselineVenueEst.total,
      priceSource: baselineVenueEst.source,
      priceSourceLabel: baselineVenueEst.sourceLabel,
      actualVenueSpend: budgetRec?.actualVenueSpend ?? null,
      actualTransportSpend: budgetRec?.actualTransportSpend ?? null,
      parkingCost: budgetRec?.parkingCostOverride ?? transportProfile.defaultParkingCost,
    });
  }

  const enrichedTasks = tasks.map((t) => enrichedMap.get(t.id) ?? t);
  const plannedGrandTotal = Number((plannedTransportTotal + plannedVenueTotal).toFixed(2));
  const actualGrandTotal = Number((actualTransportTotal + actualVenueTotal).toFixed(2));

  return {
    enrichedTasks,
    legBreakdowns,
    summary: {
      plannedTransportTotal,
      plannedVenueTotal,
      plannedGrandTotal,
      actualTransportTotal,
      actualVenueTotal,
      actualGrandTotal,
      loggedStopsCount,
      totalStopsCount: tasks.filter((t) => !t.exceedsFreeLimit && t.status !== "SKIPPED").length,
      varianceAmount: Number((actualGrandTotal - plannedGrandTotal).toFixed(2)),
      transitDailyCapReached: dailyCapReached,
    },
  };
}

export function loadLocalPriceIntel(): PriceIntelEntry[] {
  if (typeof window === "undefined") return getInitialPriceIntel();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PRICE_INTEL);
    if (!raw) {
      const initial = getInitialPriceIntel();
      window.localStorage.setItem(STORAGE_KEYS.PRICE_INTEL, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialPriceIntel();
  } catch {
    return getInitialPriceIntel();
  }
}

export function saveLocalPriceIntel(entries: PriceIntelEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.PRICE_INTEL, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLocalTaskBudgets(): Record<string, TaskBudgetRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.TASK_BUDGETS);
    return raw ? (JSON.parse(raw) as Record<string, TaskBudgetRecord>) : {};
  } catch {
    return {};
  }
}

export function saveLocalTaskBudgets(records: Record<string, TaskBudgetRecord>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.TASK_BUDGETS, JSON.stringify(records));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadLocalTransportProfile(): TransportCostProfile {
  if (typeof window === "undefined") return DEFAULT_TRANSPORT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.TRANSPORT_PROFILE);
    return raw
      ? { ...DEFAULT_TRANSPORT_PROFILE, ...(JSON.parse(raw) as Partial<TransportCostProfile>) }
      : DEFAULT_TRANSPORT_PROFILE;
  } catch {
    return DEFAULT_TRANSPORT_PROFILE;
  }
}

export function saveLocalTransportProfile(profile: TransportCostProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.TRANSPORT_PROFILE, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}
