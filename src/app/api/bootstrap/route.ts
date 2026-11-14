import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toSafeCalendarConnectionDto, toSafeUserDto } from "@/lib/dto";
import { handleApiError } from "@/lib/errors";
import { resetDemoDataForUser } from "@/lib/seed";
import { getActiveUser } from "@/lib/session";
import { getDateInTimezone } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const dateParam = req.nextUrl.searchParams.get("date");
    const activeDate =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : getDateInTimezone(user.currentTimezone || "Asia/Almaty", 0);

    const [tasks, allUserTasksCount, series, connections, calendarEvents, dayPlan, recentDayPlans] =
      await Promise.all([
        prisma.task.findMany({
          where: { userId: user.id, date: activeDate },
          orderBy: [{ plannedOrder: "asc" }, { createdAt: "asc" }],
        }),
        prisma.task.count({
          where: {
            userId: user.id,
            date: activeDate,
            lat: { not: null },
            exceedsFreeLimit: false,
          },
        }),
        prisma.taskSeries.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        }),
        prisma.calendarConnection.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "asc" },
        }),
        prisma.calendarEvent.findMany({
          where: { userId: user.id },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
        }),
        prisma.dayPlan.findUnique({
          where: { userId_date: { userId: user.id, date: activeDate } },
          include: {
            versions: {
              orderBy: { version: "desc" },
              take: 10,
            },
          },
        }),
        prisma.dayPlan.findMany({
          where: { userId: user.id },
          orderBy: { date: "desc" },
          take: 7,
        }),
      ]);

    const todayStr = getDateInTimezone(user.currentTimezone || "Asia/Almaty", 0);
    const isPastDate = activeDate < todayStr;

    return NextResponse.json({
      date: activeDate,
      todayDate: todayStr,
      isPastDate,
      freeLimitCount: allUserTasksCount,
      freeLimitMax: 5,
      user: toSafeUserDto(user),
      tasks,
      series,
      calendarConnections: connections.map(toSafeCalendarConnectionDto),
      calendarEvents,
      dayPlan: dayPlan
        ? {
            ...dayPlan,
            lastUpdatedAt: dayPlan.lastUpdatedAt.toISOString(),
            versions: dayPlan.versions.map((v) => ({
              ...v,
              createdAt: v.createdAt.toISOString(),
            })),
          }
        : null,
      recentDayPlans: recentDayPlans
        .map((p) => ({
          date: p.date,
          state: p.state,
          totalKm: p.totalKm,
          totalTravelMin: p.totalTravelMin,
          naiveTravelMin: p.naiveTravelMin,
          savedMin: p.savedMin,
        }))
        .reverse(),
      capabilities: {
        googleOAuthConfigured: Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
        googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
        hereConfigured: Boolean(process.env.HERE_API_KEY),
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getActiveUser();
    if (body?.action === "reset_demo") {
      await resetDemoDataForUser(user.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
