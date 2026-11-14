import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toSafeCalendarConnectionDto } from "@/lib/dto";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";
import { parseTimeToMinutes, sanitizeText } from "@/lib/utils";

const createEventSchema = z.object({
  title: z.string().min(1).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAllDay: z.boolean().default(false),
  locationName: z.string().max(160).nullable().optional(),
  address: z.string().max(220).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  isHard: z.boolean().default(true),
  reminderMin: z.number().int().min(0).max(120).default(15),
});

export async function GET() {
  try {
    const user = await getActiveUser();
    const [connections, events] = await Promise.all([
      prisma.calendarConnection.findMany({ where: { userId: user.id } }),
      prisma.calendarEvent.findMany({
        where: { userId: user.id },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
    ]);
    return NextResponse.json({
      connections: connections.map(toSafeCalendarConnectionDto),
      events,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const data = createEventSchema.parse(body);

    let internalCal = await prisma.calendarConnection.findUnique({
      where: { userId_provider: { userId: user.id, provider: "INTERNAL" } },
    });
    if (!internalCal) {
      internalCal = await prisma.calendarConnection.create({
        data: {
          userId: user.id,
          provider: "INTERNAL",
          accountEmail: "Journo Internal Calendar",
          status: "CONNECTED",
        },
      });
    }

    const hasLocation = data.lat != null && data.lng != null;
    const sMin = parseTimeToMinutes(data.startTime) ?? 540;
    const eMin = parseTimeToMinutes(data.endTime) ?? 600;
    const durationMin = Math.max(15, eMin - sMin);

    let exceedsFreeLimit = false;
    if (user.tier === "FREE" && hasLocation) {
      const count = await prisma.task.count({
        where: {
          userId: user.id,
          date: data.date,
          lat: { not: null },
          exceedsFreeLimit: false,
        },
      });
      if (count >= 5) exceedsFreeLimit = true;
    }

    const linkedTask = await prisma.task.create({
      data: {
        userId: user.id,
        title: sanitizeText(data.title, 160),
        locationName: data.locationName ? sanitizeText(data.locationName, 160) : null,
        address: data.address ? sanitizeText(data.address, 220) : null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        date: data.date,
        windowStart: data.startTime,
        windowEnd: data.endTime,
        durationMin,
        priority: data.isHard ? "HIGH" : "MEDIUM",
        isFlexible: !data.isHard,
        status: hasLocation ? "PLANNED" : "DRAFT",
        source: "INTERNAL_CALENDAR",
        city: user.currentCity,
        timezone: user.currentTimezone,
        exceedsFreeLimit,
      },
    });

    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        calendarId: internalCal.id,
        provider: "INTERNAL",
        title: sanitizeText(data.title, 160),
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        isAllDay: data.isAllDay,
        locationName: data.locationName ? sanitizeText(data.locationName, 160) : null,
        address: data.address ? sanitizeText(data.address, 220) : null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        isHard: data.isHard,
        reminderMin: data.reminderMin,
        linkedTaskId: linkedTask.id,
      },
    });

    return NextResponse.json({ event, linkedTask }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new NotFoundError("CalendarEvent", "");

    const existing = await prisma.calendarEvent.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) throw new NotFoundError("CalendarEvent", id);

    if (existing.linkedTaskId) {
      await prisma.task.deleteMany({
        where: { id: existing.linkedTaskId, userId: user.id },
      });
    }
    await prisma.calendarEvent.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
