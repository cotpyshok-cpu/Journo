import { describe, expect, it } from "vitest";
import { solveDailySchedule } from "@/lib/routing-engine";
import { TaskItem } from "@/lib/types";

function makeTask(overrides: Partial<TaskItem> & { id: string; title: string }): TaskItem {
  return {
    userId: "user-test",
    locationName: overrides.locationName ?? "Baiterek Tower",
    address: overrides.address ?? "Astana",
    lat: overrides.lat ?? 51.1283,
    lng: overrides.lng ?? 71.4305,
    date: "2026-11-14",
    windowStart: null,
    windowEnd: null,
    durationMin: 30,
    priority: "MEDIUM",
    isFlexible: true,
    status: "PLANNED",
    source: "TASK",
    externalId: null,
    seriesId: null,
    seriesOccurrenceIndex: null,
    seriesTotalCount: null,
    city: "Astana",
    timezone: "Asia/Almaty",
    plannedOrder: null,
    departureTime: null,
    eta: null,
    bufferMin: null,
    legMode: null,
    legDurationWalkMin: null,
    legDurationTransitMin: null,
    legDistanceKm: null,
    legModeChosenByUser: false,
    exceedsFreeLimit: false,
    startedAt: null,
    extendedMin: 0,
    deletedInCalendar: false,
    ...overrides,
  };
}

const ORIGIN = {
  lat: 51.1245,
  lng: 71.4662,
  label: "Highvill Astana",
};

describe("Journo TSPTW Routing Engine", () => {
  it("optimizes flexible errands alongside a hard anchor and sets CACHE failover estimate badge", async () => {
    const tasks: TaskItem[] = [
      makeTask({
        id: "t-far",
        title: "Nazarbayev University Meeting",
        locationName: "Nazarbayev University",
        lat: 51.0906,
        lng: 71.3983,
        windowStart: "11:00",
        windowEnd: "12:00",
        durationMin: 45,
        priority: "HIGH",
        isFlexible: false,
      }),
      makeTask({
        id: "t-mid",
        title: "Keruen Errand",
        locationName: "Keruen Mall",
        lat: 51.1286,
        lng: 71.4257,
        durationMin: 15,
        isFlexible: true,
      }),
      makeTask({
        id: "t-noloc",
        title: "Read Brief",
        lat: null,
        lng: null,
      }),
    ];

    const res = await solveDailySchedule({
      origin: ORIGIN,
      tasks,
      transportPref: "BOTH",
      dayStartMin: 540, // 09:00
      offline: true,
    });

    expect(res.ok).toBe(true);
    expect(res.providerUsed).toBe("CACHE");
    expect(res.isEstimateWithoutTraffic).toBe(true);
    expect(res.scheduledTasks).toHaveLength(2);
    expect(res.unscheduledLocationlessIds).toEqual(["t-noloc"]);
    // Keruen (09:00 region) should be ordered cleanly before 11:00 Nazarbayev University anchor
    expect(res.scheduledTasks[0].id).toBe("t-mid");
    expect(res.scheduledTasks[1].id).toBe("t-far");
    expect(res.scheduledTasks[1].eta).toBeTruthy();
    expect(res.totalKm).toBeGreaterThan(0);
  });

  it("detects impossible overlapping hard anchors and returns S10 conflict recovery options (E6.1)", async () => {
    const tasks: TaskItem[] = [
      makeTask({
        id: "hard-1",
        title: "AIFC Keynote",
        lat: 51.0909,
        lng: 71.4184,
        windowStart: "10:00",
        windowEnd: "10:45",
        durationMin: 45,
        priority: "HIGH",
        isFlexible: false,
      }),
      makeTask({
        id: "hard-2",
        title: "Khan Shatyr Briefing",
        lat: 51.1325,
        lng: 71.4037,
        windowStart: "10:30",
        windowEnd: "11:00",
        durationMin: 30,
        priority: "HIGH",
        isFlexible: false,
      }),
    ];

    const res = await solveDailySchedule({
      origin: ORIGIN,
      tasks,
      transportPref: "WALK",
      dayStartMin: 540,
    });

    expect(res.ok).toBe(false);
    expect(res.conflict).not.toBeNull();
    expect(res.conflict?.affectedTaskIds).toContain("hard-2");
    expect(res.conflict?.options.some((o) => o.id === "SHIFT_WINDOW")).toBe(true);
    expect(res.conflict?.options.some((o) => o.id === "ENABLE_BOTH_MODES")).toBe(true);
  });

  it("respects user manual legMode selection and <3 min equal speed threshold", async () => {
    const tasks: TaskItem[] = [
      makeTask({
        id: "t-short",
        title: "Nearby Coffee",
        lat: 51.1251,
        lng: 71.4648, // ~0.12 km from Highvill => short walk
        durationMin: 15,
        legMode: "TRANSIT",
        legModeChosenByUser: true,
      }),
    ];

    const res = await solveDailySchedule({
      origin: ORIGIN,
      tasks,
      transportPref: "BOTH",
      dayStartMin: 540,
      offline: true,
    });

    expect(res.ok).toBe(true);
    expect(res.legs).toHaveLength(1);
    expect(res.legs[0].chosenByUser).toBe(true);
    expect(res.legs[0].chosenMode).toBe("TRANSIT");
    expect(res.legs[0].noTransitNote).toContain("Short walk");
  });

  it("forces local cache when simulateQuotaExhausted is true (E6.2 / E6.4)", async () => {
    const tasks: TaskItem[] = [
      makeTask({
        id: "t-1",
        title: "Astana Hub",
        lat: 51.0897,
        lng: 71.4167,
      }),
    ];

    const res = await solveDailySchedule({
      origin: ORIGIN,
      tasks,
      transportPref: "BOTH",
      simulateQuotaExhausted: true,
      simulatePartialQuota: true,
    });

    expect(res.ok).toBe(true);
    expect(res.providerUsed).toBe("CACHE");
    expect(res.isEstimateWithoutTraffic).toBe(true);
  });

  it("warns on tight cross-town fixed tasks and recommends Taxi/Car when bus misses the start time", async () => {
    const tasks: TaskItem[] = [
      makeTask({
        id: "coffee-1",
        title: "Morning Coffee",
        lat: 51.0906,
        lng: 71.3986, // Mega Silk Way area
        windowStart: "10:00",
        windowEnd: "10:40",
        durationMin: 40,
        isFlexible: false,
      }),
      makeTask({
        id: "gym-2",
        title: "Cross-town Gym",
        lat: 51.1489,
        lng: 71.4712, // ~10.9 km away (~32 min bus vs ~22 min taxi)
        windowStart: "11:05",
        windowEnd: "12:15",
        durationMin: 60,
        isFlexible: false,
      }),
    ];

    const conflictRes = await solveDailySchedule({
      origin: ORIGIN,
      tasks,
      transportPref: "TRANSIT",
      dayStartMin: 540,
      offline: true,
    });

    expect(conflictRes.ok).toBe(false);
    expect(conflictRes.conflict).not.toBeNull();
    expect(conflictRes.conflict?.recommendedMode).toBe("TAXI");
    expect(conflictRes.conflict?.options.some((o) => o.id === "SWITCH_TO_TAXI")).toBe(true);
    expect(conflictRes.conflict?.options.some((o) => o.id === "MAKE_FLEXIBLE")).toBe(true);

    // Switching that leg to TAXI resolves the cross-town fixed conflict cleanly
    const taxiRes = await solveDailySchedule({
      origin: ORIGIN,
      tasks: tasks.map((t) =>
        t.id === "gym-2" ? { ...t, legMode: "TAXI", legModeChosenByUser: true } : t
      ),
      transportPref: "TRANSIT",
      dayStartMin: 540,
      offline: true,
    });

    expect(taxiRes.ok).toBe(true);
    expect(taxiRes.scheduledTasks.find((t) => t.id === "gym-2")?.legMode).toBe("TAXI");
  });

  it("detects same-time fixed task overlap (10:00-11:00 vs 10:00-11:00)", async () => {
    const tasks: TaskItem[] = [
      makeTask({
        id: "fixed-a",
        title: "Client Sync",
        lat: 51.0897,
        lng: 71.4167,
        windowStart: "10:00",
        windowEnd: "11:00",
        durationMin: 60,
        isFlexible: false,
      }),
      makeTask({
        id: "fixed-b",
        title: "Doctor Visit",
        lat: 51.1288,
        lng: 71.4342,
        windowStart: "10:00",
        windowEnd: "11:00",
        durationMin: 60,
        isFlexible: false,
      }),
    ];

    const res = await solveDailySchedule({
      origin: ORIGIN,
      tasks,
      transportPref: "BOTH",
      dayStartMin: 540,
      offline: true,
    });

    expect(res.ok).toBe(false);
    expect(res.conflict).not.toBeNull();
    expect(res.conflict?.affectedTaskIds).toContain("fixed-a");
    expect(res.conflict?.affectedTaskIds).toContain("fixed-b");
    expect(res.conflict?.options.some((o) => o.id === "MAKE_FLEXIBLE")).toBe(true);
  });

  it("auto-shifts a flexible evening task to morning when evening is blocked and reports shiftedTasks notice", async () => {
    const tasks: TaskItem[] = [
      makeTask({
        id: "evening-dinner",
        title: "Evening Client Dinner",
        lat: 51.1288,
        lng: 71.4342,
        windowStart: "18:00",
        windowEnd: "20:00",
        durationMin: 105,
        isFlexible: false,
      }),
      makeTask({
        id: "flex-gym",
        title: "Evening Gym",
        lat: 51.0892,
        lng: 71.4084,
        windowStart: "18:00",
        windowEnd: "20:00",
        durationMin: 60,
        isFlexible: true,
      }),
    ];

    const res = await solveDailySchedule({
      origin: ORIGIN,
      tasks,
      transportPref: "BOTH",
      dayStartMin: 540, // 09:00
      offline: true,
    });

    expect(res.ok).toBe(true);
    expect(res.shiftedTasks.length).toBeGreaterThanOrEqual(1);
    const shiftNotice = res.shiftedTasks.find((s) => s.taskId === "flex-gym");
    expect(shiftNotice).toBeDefined();
    expect(shiftNotice?.oldEta).toBe("18:00");
    expect(shiftNotice?.newEta).toMatch(/^09:/);
    expect(shiftNotice?.reason).toContain("Evening Gym");
  });
});
