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
});
