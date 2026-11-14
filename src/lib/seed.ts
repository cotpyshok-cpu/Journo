import { prisma } from "./db";
import { solveDailySchedule } from "./routing-engine";
import { TaskItem } from "./types";
import { getDateInTimezone } from "./utils";

export const DEMO_USER_EMAIL = "demo@journo.app";

let seedingPromise: Promise<string> | null = null;

export async function ensureDemoUserSeeded(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (existing) return existing.id;

  if (!seedingPromise) {
    seedingPromise = seedDemoUserInternal().finally(() => {
      seedingPromise = null;
    });
  }
  return seedingPromise;
}

export async function resetDemoDataForUser(userId: string) {
  await prisma.task.deleteMany({ where: { userId } });
  await prisma.taskSeries.deleteMany({ where: { userId } });
  await prisma.calendarEvent.deleteMany({ where: { userId } });
  await prisma.dayPlan.deleteMany({ where: { userId } });
  await prisma.calendarConnection.deleteMany({ where: { userId } });

  await prisma.user.update({
    where: { id: userId },
    data: {
      tier: "FREE",
      transportModes: "BOTH",
      homeAddress: "Highvill Astana, Baitursynov St 5, Astana",
      homeLat: 51.1245,
      homeLng: 71.4662,
      workAddress: "Astana Hub, Mangilik El Ave 55/8, Astana",
      workLat: 51.0894,
      workLng: 71.4158,
      tempBaseAddress: null,
      tempBaseLat: null,
      tempBaseLng: null,
      currentCity: "Astana",
      currentTimezone: "Asia/Almaty",
      homeCity: "Astana",
      homeTimezone: "Asia/Almaty",
      onboardingStep: 9,
    },
  });

  await populateSampleData(userId);
}

async function seedDemoUserInternal(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      name: "Amina Nurpeisova",
      tier: "FREE",
      transportModes: "BOTH",
      homeAddress: "Highvill Astana, Baitursynov St 5, Astana",
      homeLat: 51.1245,
      homeLng: 71.4662,
      workAddress: "Astana Hub, Mangilik El Ave 55/8, Astana",
      workLat: 51.0894,
      workLng: 71.4158,
      currentCity: "Astana",
      currentTimezone: "Asia/Almaty",
      homeCity: "Astana",
      homeTimezone: "Asia/Almaty",
      delayThresholdMin: 5,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      preferredNavApp: "GOOGLE",
      onboardingStep: 9,
    },
  });

  const existingTasks = await prisma.task.count({ where: { userId: user.id } });
  if (existingTasks === 0) {
    await populateSampleData(user.id);
  }

  return user.id;
}

export async function populateSampleData(userId: string) {
  const today = getDateInTimezone("Asia/Almaty", 0);
  const tomorrow = getDateInTimezone("Asia/Almaty", 1);

  const internalCal = await prisma.calendarConnection.create({
    data: {
      userId,
      provider: "INTERNAL",
      accountEmail: "Journo Internal Calendar",
      status: "CONNECTED",
      importAllDay: false,
      lastSyncedAt: new Date(),
    },
  });

  const endDate = getDateInTimezone("Asia/Almaty", 56);
  const gymSeries = await prisma.taskSeries.create({
    data: {
      userId,
      title: "Evening Fitness Session",
      locationName: "World Class / MEGA Silk Way",
      address: "Kabanbay Batyr Ave 62, Astana",
      lat: 51.0892,
      lng: 71.4084,
      mode: "SPECIFIC_DAYS",
      daysOfWeek: "Mon,Wed,Fri",
      windowStart: "18:00",
      windowEnd: "20:00",
      durationMin: 60,
      isFlexible: false,
      endType: "THREE_MONTHS",
      endDate,
      totalCount: 39,
      completedCount: 12,
      status: "ACTIVE",
      city: "Astana",
      timezone: "Asia/Almaty",
    },
  });

  const createdTasks = await Promise.all([
    prisma.task.create({
      data: {
        userId,
        title: "Product Demo Pitch at Astana Hub",
        locationName: "Astana Hub",
        address: "Mangilik El Ave 55/8, EXPO C4.6, Astana",
        lat: 51.0894,
        lng: 71.4158,
        date: today,
        windowStart: "09:30",
        windowEnd: "10:45",
        durationMin: 60,
        priority: "HIGH",
        isFlexible: false,
        status: "PLANNED",
        source: "INTERNAL_CALENDAR",
        city: "Astana",
        timezone: "Asia/Almaty",
      },
    }),
    prisma.task.create({
      data: {
        userId,
        title: "Pick up signed contract & coffee",
        locationName: "Koktem Coffee",
        address: "Kunayev St 12/1, Astana",
        lat: 51.1301,
        lng: 71.4285,
        date: today,
        windowStart: null,
        windowEnd: null,
        durationMin: 25,
        priority: "MEDIUM",
        isFlexible: true,
        status: "PLANNED",
        source: "TASK",
        city: "Astana",
        timezone: "Asia/Almaty",
      },
    }),
    prisma.task.create({
      data: {
        userId,
        title: "Client Lunch & Architecture Review",
        locationName: "Talan Towers",
        address: "Dostyk St 16, Astana",
        lat: 51.1288,
        lng: 71.4342,
        date: today,
        windowStart: "13:00",
        windowEnd: "14:15",
        durationMin: 60,
        priority: "HIGH",
        isFlexible: false,
        status: "PLANNED",
        source: "INTERNAL_CALENDAR",
        city: "Astana",
        timezone: "Asia/Almaty",
      },
    }),
    prisma.task.create({
      data: {
        userId,
        title: "Evening Fitness Session",
        locationName: "World Class / MEGA Silk Way",
        address: "Kabanbay Batyr Ave 62, Astana",
        lat: 51.0892,
        lng: 71.4084,
        date: today,
        windowStart: "18:00",
        windowEnd: "20:00",
        durationMin: 60,
        priority: "MEDIUM",
        isFlexible: false,
        status: "PLANNED",
        source: "SERIES",
        seriesId: gymSeries.id,
        seriesOccurrenceIndex: 12,
        seriesTotalCount: 39,
        city: "Astana",
        timezone: "Asia/Almaty",
      },
    }),
    // Locationless Internal Calendar Event (does not occupy route slot until location assigned)
    prisma.task.create({
      data: {
        userId,
        title: "Remote Design Sync (Needs Location)",
        locationName: null,
        address: null,
        lat: null,
        lng: null,
        date: today,
        windowStart: "15:30",
        windowEnd: "16:00",
        durationMin: 30,
        priority: "LOW",
        isFlexible: true,
        status: "DRAFT",
        source: "INTERNAL_CALENDAR",
        city: "Astana",
        timezone: "Asia/Almaty",
      },
    }),
    // Tomorrow task
    prisma.task.create({
      data: {
        userId,
        title: "Investor Breakfast at Ritz-Carlton",
        locationName: "The Ritz-Carlton Astana",
        address: "Dostyk St 16, Astana",
        lat: 51.1285,
        lng: 71.4337,
        date: tomorrow,
        windowStart: "09:00",
        windowEnd: "10:00",
        durationMin: 60,
        priority: "HIGH",
        isFlexible: false,
        status: "PLANNED",
        source: "INTERNAL_CALENDAR",
        city: "Astana",
        timezone: "Asia/Almaty",
      },
    }),
  ]);

  // Internal calendar events corresponding to today & tomorrow
  await prisma.calendarEvent.createMany({
    data: [
      {
        userId,
        calendarId: internalCal.id,
        provider: "INTERNAL",
        title: "Product Demo Pitch at Astana Hub",
        date: today,
        startTime: "09:30",
        endTime: "10:30",
        locationName: "Astana Hub",
        address: "Mangilik El Ave 55/8, EXPO C4.6, Astana",
        lat: 51.0894,
        lng: 71.4158,
        isHard: true,
        linkedTaskId: createdTasks[0].id,
      },
      {
        userId,
        calendarId: internalCal.id,
        provider: "INTERNAL",
        title: "Client Lunch & Architecture Review",
        date: today,
        startTime: "13:00",
        endTime: "14:00",
        locationName: "Talan Towers",
        address: "Dostyk St 16, Astana",
        lat: 51.1288,
        lng: 71.4342,
        isHard: true,
        linkedTaskId: createdTasks[2].id,
      },
      {
        userId,
        calendarId: internalCal.id,
        provider: "INTERNAL",
        title: "Remote Design Sync",
        date: today,
        startTime: "15:30",
        endTime: "16:00",
        locationName: null,
        address: null,
        isHard: false,
        linkedTaskId: createdTasks[4].id,
      },
    ],
  });

  // Historical DayPlans (past 6 days) for Evening Review Pro Analytics & Read-only Past Dates (A1.1)
  const pastStats = [
    { offset: -6, km: 14.2, travel: 58, naive: 79, saved: 21 },
    { offset: -5, km: 11.8, travel: 44, naive: 61, saved: 17 },
    { offset: -4, km: 16.5, travel: 64, naive: 92, saved: 28 },
    { offset: -3, km: 9.4, travel: 39, naive: 51, saved: 12 },
    { offset: -2, km: 18.1, travel: 71, naive: 98, saved: 27 },
    { offset: -1, km: 12.6, travel: 49, naive: 68, saved: 19 },
  ];

  for (const st of pastStats) {
    const d = getDateInTimezone("Asia/Almaty", st.offset);
    await prisma.dayPlan.create({
      data: {
        userId,
        date: d,
        state: "COMPLETED",
        currentVersion: 1,
        totalKm: st.km,
        totalTravelMin: st.travel,
        naiveTravelMin: st.naive,
        savedMin: st.saved,
        providerUsed: "CACHE",
        isEstimateWithoutTraffic: true,
      },
    });
  }

  // Build initial v1 route for Today so the map & morning plan open rich immediately
  const todayTasks = createdTasks.filter((t) => t.date === today) as unknown as TaskItem[];
  const solve = await solveDailySchedule({
    origin: { lat: 51.1245, lng: 71.4662, label: "Highvill Astana" },
    tasks: todayTasks,
    transportPref: "BOTH",
    dayStartMin: 510,
    offline: true,
  });

  if (solve.ok) {
    await Promise.all(
      solve.scheduledTasks.map((t) =>
        prisma.task.update({
          where: { id: t.id },
          data: {
            plannedOrder: t.plannedOrder,
            departureTime: t.departureTime,
            eta: t.eta,
            bufferMin: t.bufferMin,
            legMode: t.legMode,
            legDurationWalkMin: t.legDurationWalkMin,
            legDurationTransitMin: t.legDurationTransitMin,
            legDistanceKm: t.legDistanceKm,
          },
        })
      )
    );

    const dayPlan = await prisma.dayPlan.create({
      data: {
        userId,
        date: today,
        state: "DRAFT",
        currentVersion: 1,
        totalKm: solve.totalKm,
        totalTravelMin: solve.totalTravelMin,
        naiveTravelMin: solve.naiveTravelMin,
        savedMin: solve.savedMin,
        providerUsed: solve.providerUsed,
        isEstimateWithoutTraffic: solve.isEstimateWithoutTraffic,
      },
    });

    await prisma.planVersion.create({
      data: {
        dayPlanId: dayPlan.id,
        version: 1,
        summary: "Initial morning optimization across Astana",
        deltaMinutes: 0,
        deltaKm: 0,
        shiftedTasksJson: "[]",
        snapshotJson: JSON.stringify(solve.scheduledTasks),
      },
    });
  }
}
