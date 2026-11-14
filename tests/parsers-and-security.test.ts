import { describe, expect, it } from "vitest";
import {
  parseShareLocationUrl,
  resolvePlaceByWords,
  searchPlacesLocal,
} from "@/lib/astana-places";
import { parseIcsContent } from "@/lib/ics-parser";
import {
  derivePkceChallenge,
  generateOAuthState,
  generatePkceVerifier,
  sanitizeRedirectPath,
  verifyStateConstantTime,
} from "@/lib/oauth-security";
import { parseQuickAddText } from "@/lib/quick-add-parser";
import {
  DEFAULT_TRANSPORT_PROFILE,
  calculateLegTransportOptions,
  enrichDayBudgetAndTasks,
  estimateVenueBudget,
  getInitialPriceIntel,
  recordPersonalVisitSpend,
} from "@/lib/budget-intelligence";
import type { TaskBudgetRecord, TaskItem } from "@/lib/types";
import { decodeGooglePolyline } from "@/lib/polyline";
import { sanitizeText } from "@/lib/utils";

describe("Quick Add Natural-Language Parser (S12)", () => {
  it("parses Pharmacy flexible snippet cleanly", () => {
    const parsed = parseQuickAddText("Pharmacy, 10 min, flexible");
    expect(parsed.parsedSuccessfully).toBe(true);
    expect(parsed.title).toContain("Pharmacy");
    expect(parsed.durationMin).toBe(10);
    expect(parsed.isFlexible).toBe(true);
    expect(parsed.windowStart).toBeNull();
  });

  it("extracts explicit time window and rigid mode for appointments", () => {
    const parsed = parseQuickAddText("Bank meeting, 30 min, 14:00-16:00, urgent");
    expect(parsed.windowStart).toBe("14:00");
    expect(parsed.windowEnd).toBe("16:00");
    expect(parsed.durationMin).toBe(30);
    expect(parsed.isFlexible).toBe(false);
    expect(parsed.priority).toBe("HIGH");
  });
});

describe("Apple Calendar (.ics) Parser & Place Presets", () => {
  it("parses RFC 5545 VEVENT blocks and strips unsafe characters", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-event-01
SUMMARY:Investor Sync <script>alert(1)</script>
LOCATION:Astana Hub, Mangilik El C4.6
DTSTART:20261114T143000
DTEND:20261114T151500
END:VEVENT
END:VCALENDAR`;

    const events = parseIcsContent(ics);
    expect(events).toHaveLength(1);
    expect(events[0].title).not.toContain("<script>");
    expect(events[0].date).toBe("2026-11-14");
    expect(events[0].startTime).toBe("14:30");
    expect(events[0].endTime).toBe("15:15");
    expect(events[0].locationName).toContain("Astana Hub");
  });

  it("extracts coordinates from shared Google/Apple map links", () => {
    const pin = parseShareLocationUrl("https://maps.google.com/?q=51.1282,71.4304");
    expect(pin).not.toBeNull();
    expect(pin?.lat).toBeCloseTo(51.1282, 4);
    expect(pin?.lng).toBeCloseTo(71.4304, 4);

    const astanaPlaces = searchPlacesLocal("baiterek", "Astana");
    expect(astanaPlaces.length).toBeGreaterThan(0);
  });
});

describe("OAuth 2.0 PKCE, State Timing Check & Open Redirect Defense", () => {
  it("generates distinct cryptographic OAuth state and verifies in constant time", () => {
    const s1 = generateOAuthState();
    const s2 = generateOAuthState();
    expect(s1).not.toBe(s2);
    expect(verifyStateConstantTime(s1, s1)).toBe(true);
    expect(verifyStateConstantTime(s1, s2)).toBe(false);
    expect(verifyStateConstantTime(s1, null)).toBe(false);
  });

  it("derives valid base64url S256 PKCE code challenge", () => {
    const verifier = generatePkceVerifier();
    const challenge = derivePkceChallenge(verifier);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).not.toBe(verifier);
    expect(challenge).not.toMatch(/[+/=]/);
  });

  it("rejects open redirect attacks and allows only whitelisted internal paths", () => {
    expect(sanitizeRedirectPath("/app")).toBe("/app");
    expect(sanitizeRedirectPath("/app?view=S18")).toBe("/app?view=S18");
    expect(sanitizeRedirectPath("/")).toBe("/");
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/app");
    expect(sanitizeRedirectPath("//evil.com/phish")).toBe("/app");
    expect(sanitizeRedirectPath("/\\evil.com")).toBe("/app");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/app");
    expect(sanitizeRedirectPath("https://journo.app@evil.com/app")).toBe("/app");
    expect(sanitizeRedirectPath("/admin/secrets")).toBe("/app");
  });

  it("sanitizes angle brackets and control chars from user/calendar text", () => {
    expect(sanitizeText("<img src=x onerror=alert(1)>Hello\nWorld")).toBe(
      "img src=x onerror=alert(1)Hello World"
    );
  });

  it("decodes Google encoded polylines accurately for route rendering", () => {
    const coords = decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(coords).toHaveLength(3);
    expect(coords[0][0]).toBeCloseTo(38.5, 4);
    expect(coords[0][1]).toBeCloseTo(-120.2, 4);
    expect(coords[1][0]).toBeCloseTo(40.7, 4);
    expect(coords[1][1]).toBeCloseTo(-120.95, 4);
    expect(coords[2][0]).toBeCloseTo(43.252, 3);
    expect(coords[2][1]).toBeCloseTo(-126.453, 3);
  });
});

describe("Bilingual Quick Add, Multi-Modal Cost & Self-Learning Price Intelligence", () => {
  it("parses Russian and English cinema inputs with party size and start time", () => {
    const ru = parseQuickAddText("Кино на двоих в 19:30");
    expect(ru.parsedSuccessfully).toBe(true);
    expect(ru.partySize).toBe(2);
    expect(ru.windowStart).toBe("19:30");
    expect(ru.categoryHint).toBe("cinema");
    expect(ru.isFlexible).toBe(false);

    const en = parseQuickAddText("Cinema for two at 19:30");
    expect(en.partySize).toBe(2);
    expect(en.windowStart).toBe("19:30");
    expect(en.categoryHint).toBe("cinema");
  });

  it("computes 4-mode transport costs including transit daily cap, Gas vs EV, and Taxi", () => {
    const leg1 = calculateLegTransportOptions({
      distanceKm: 4.5,
      walkMin: 56,
      transitMin: 16,
      partySize: 1,
      profile: DEFAULT_TRANSPORT_PROFILE,
      transitSpentSoFarTotal: 0,
    });
    expect(leg1.walkCost).toBe(0);
    expect(leg1.transitCost).toBe(0.5);
    expect(leg1.carCost).toBeGreaterThan(2);
    expect(leg1.taxiCost).toBeGreaterThan(leg1.transitCost);

    const capped = calculateLegTransportOptions({
      distanceKm: 7.0,
      walkMin: 80,
      transitMin: 20,
      partySize: 1,
      profile: DEFAULT_TRANSPORT_PROFILE,
      transitSpentSoFarTotal: 1.8,
    });
    expect(capped.transitCost).toBeCloseTo(0.2, 2);
    expect(capped.dailyCapApplied).toBe(true);

    const ev = calculateLegTransportOptions({
      distanceKm: 10,
      walkMin: 120,
      transitMin: 25,
      partySize: 2,
      profile: { ...DEFAULT_TRANSPORT_PROFILE, vehicleType: "EV", hasUnlimitedTransitPass: true },
      transitSpentSoFarTotal: 0,
    });
    expect(ev.transitCost).toBe(0);
    expect(ev.carNote).toContain("kWh");
  });

  it("uses external benchmark on 1st visit and personal Price Intelligence average from 2nd+ visit", () => {
    const baseIntel = getInitialPriceIntel().filter((x) => x.venueKey !== "mega silk way");
    const firstVisitEst = estimateVenueBudget({
      locationName: "Mega Silk Way",
      title: "Evening Cinema",
      partySize: 2,
      priceIntel: baseIntel,
    });
    expect(firstVisitEst.source).not.toBe("PRICE_INTEL");
    expect(firstVisitEst.total).toBeGreaterThan(0);

    // Log 1st real check ($30 for 2 people = $15/person) -> next visit (2nd visit) uses PRICE_INTEL!
    const afterVisit1 = recordPersonalVisitSpend(baseIntel, {
      locationName: "Mega Silk Way",
      title: "Evening Cinema",
      actualTotalSpend: 30,
      partySize: 2,
    });
    const estAfter1 = estimateVenueBudget({
      locationName: "Mega Silk Way",
      title: "Evening Cinema",
      partySize: 2,
      priceIntel: afterVisit1,
    });
    expect(estAfter1.source).toBe("PRICE_INTEL");
    expect(estAfter1.perPerson).toBeCloseTo(15, 2);
    expect(estAfter1.total).toBeCloseTo(30, 2);

    // Log 2nd real check ($26 for 2 people = $13/person) -> avg = $14/person active!
    const afterVisit2 = recordPersonalVisitSpend(afterVisit1, {
      locationName: "Mega Silk Way",
      title: "Evening Cinema",
      actualTotalSpend: 26,
      partySize: 2,
    });
    const estAfter2 = estimateVenueBudget({
      locationName: "Mega Silk Way",
      title: "Evening Cinema",
      partySize: 2,
      priceIntel: afterVisit2,
    });
    expect(estAfter2.source).toBe("PRICE_INTEL");
    expect(estAfter2.perPerson).toBeCloseTo(14, 2);
    expect(estAfter2.total).toBeCloseTo(28, 2);
  });
});

function makeTestTask(overrides: Partial<TaskItem> & { id: string; title: string }): TaskItem {
  return {
    userId: "user-1",
    locationName: "Koktem Coffee",
    address: "Mangilik El 20, Astana",
    lat: 51.11,
    lng: 71.42,
    date: "2026-11-15",
    windowStart: "10:00",
    windowEnd: "11:00",
    durationMin: 45,
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
    plannedOrder: 1,
    departureTime: "09:40",
    eta: "10:00",
    bufferMin: 15,
    legMode: "TRANSIT",
    legDurationWalkMin: 35,
    legDurationTransitMin: 18,
    legDistanceKm: 4.2,
    legModeChosenByUser: false,
    exceedsFreeLimit: false,
    startedAt: null,
    extendedMin: 0,
    deletedInCalendar: false,
    ...overrides,
  };
}

describe("Word-Based Address Search & Morning vs Actual Spend Math", () => {
  it("matches Russian and English place keywords cleanly", () => {
    const cinemaRu = searchPlacesLocal("кино", "Astana");
    expect(cinemaRu.length).toBeGreaterThan(0);
    expect(cinemaRu.some((p) => /chaplin|kinopark|mega/i.test(p.name))).toBe(true);

    const coffeeRu = searchPlacesLocal("кофе", "Astana");
    expect(coffeeRu.some((p) => /coffee|koktem|talan/i.test(p.name))).toBe(true);

    const custom = resolvePlaceByWords("ул. Кунаева 14", "Astana");
    expect(custom.name).toBe("ул. Кунаева 14");
    expect(custom.lat).toBeGreaterThan(50);
    expect(custom.lng).toBeGreaterThan(70);
  });

  it("keeps Planned Morning Total fixed on check logs and separates Live Day road vs check spend", () => {
    const tasks: TaskItem[] = [
      makeTestTask({
        id: "t1",
        title: "Coffee with client",
        locationName: "Koktem Coffee",
        plannedOrder: 1,
        status: "PLANNED",
      }),
      makeTestTask({
        id: "t2",
        title: "Product Demo at Astana Hub",
        locationName: "Astana Hub",
        plannedOrder: 2,
        status: "PLANNED",
        legMode: "TRANSIT",
      }),
    ];

    const baseline = enrichDayBudgetAndTasks({
      tasks,
      taskBudgets: {},
      priceIntel: getInitialPriceIntel(),
      transportProfile: DEFAULT_TRANSPORT_PROFILE,
    });

    // Before Live Day starts (all stops PENDING): actual spend is $0
    expect(baseline.summary.actualTransportTotal).toBe(0);
    expect(baseline.summary.actualVenueTotal).toBe(0);
    expect(baseline.summary.actualGrandTotal).toBe(0);
    const baselineMorningTotal = baseline.summary.plannedGrandTotal;
    expect(baselineMorningTotal).toBeGreaterThan(0);

    // Stop 1 becomes DONE in Live Day -> only road spend is counted initially
    const liveDayTasks = [
      { ...tasks[0], status: "DONE" as const },
      tasks[1],
    ];
    const afterDone = enrichDayBudgetAndTasks({
      tasks: liveDayTasks,
      taskBudgets: {},
      priceIntel: getInitialPriceIntel(),
      transportProfile: DEFAULT_TRANSPORT_PROFILE,
    });
    expect(afterDone.summary.plannedGrandTotal).toBeCloseTo(baselineMorningTotal, 2);
    expect(afterDone.summary.actualTransportTotal).toBeCloseTo(0.5, 2);
    expect(afterDone.summary.actualVenueTotal).toBe(0);
    expect(afterDone.summary.actualGrandTotal).toBeCloseTo(0.5, 2);

    // User logs an $18 check for Stop 1 and updates priceIntel -> Planned Morning Total MUST NOT move!
    const updatedIntel = recordPersonalVisitSpend(getInitialPriceIntel(), {
      locationName: "Koktem Coffee",
      title: "Coffee with client",
      actualTotalSpend: 18,
      partySize: 1,
    });
    const budgetsWithCheck: Record<string, TaskBudgetRecord> = {
      t1: {
        taskId: "t1",
        partySize: 1,
        actualVenueSpend: 18,
      },
    };
    const afterCheck = enrichDayBudgetAndTasks({
      tasks: liveDayTasks,
      taskBudgets: budgetsWithCheck,
      priceIntel: updatedIntel,
      transportProfile: DEFAULT_TRANSPORT_PROFILE,
    });
    expect(afterCheck.summary.plannedGrandTotal).toBeCloseTo(baselineMorningTotal, 2);
    expect(afterCheck.summary.actualTransportTotal).toBeCloseTo(0.5, 2);
    expect(afterCheck.summary.actualVenueTotal).toBeCloseTo(18, 2);
    expect(afterCheck.summary.actualGrandTotal).toBeCloseTo(18.5, 2);

    // If a stop is SKIPPED, Planned Morning Total drops accordingly
    const withSkipped = enrichDayBudgetAndTasks({
      tasks: [
        liveDayTasks[0],
        { ...tasks[1], status: "SKIPPED" as const },
      ],
      taskBudgets: budgetsWithCheck,
      priceIntel: updatedIntel,
      transportProfile: DEFAULT_TRANSPORT_PROFILE,
    });
    expect(withSkipped.summary.plannedGrandTotal).toBeLessThan(baselineMorningTotal);
  });
});
