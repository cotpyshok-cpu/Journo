import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchPlacesLocal } from "@/lib/astana-places";
import { prisma } from "@/lib/db";
import { toSafeCalendarConnectionDto } from "@/lib/dto";
import { ForbiddenError, handleApiError, ValidationError } from "@/lib/errors";
import { parseIcsContent } from "@/lib/ics-parser";
import { getActiveUser } from "@/lib/session";
import { parseTimeToMinutes } from "@/lib/utils";

const icsSchema = z.object({
  icsContent: z.string().min(10).max(200_000),
  overrideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    if (user.tier === "FREE") {
      throw new ForbiddenError("Apple Calendar (.ics) import requires Pro or Dev mode.");
    }

    const body = await req.json();
    const { icsContent, overrideDate } = icsSchema.parse(body);

    const parsedEvents = parseIcsContent(icsContent, overrideDate);
    if (parsedEvents.length === 0) {
      throw new ValidationError("No VEVENT entries found in the provided .ics file.");
    }

    const conn = await prisma.calendarConnection.upsert({
      where: { userId_provider: { userId: user.id, provider: "APPLE_ICS" } },
      update: {
        status: "CONNECTED",
        accountEmail: "Apple Calendar (.ics Import)",
        lastSyncedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider: "APPLE_ICS",
        accountEmail: "Apple Calendar (.ics Import)",
        status: "CONNECTED",
        lastSyncedAt: new Date(),
      },
    });

    let importedCount = 0;
    for (const ev of parsedEvents) {
      const targetDate = overrideDate || ev.date;
      let lat = ev.lat;
      let lng = ev.lng;
      if (lat == null && ev.locationName) {
        const matched = searchPlacesLocal(ev.locationName, user.currentCity);
        if (matched.length > 0) {
          lat = matched[0].lat;
          lng = matched[0].lng;
        } else {
          lat = 51.126 + (importedCount % 4) * 0.006;
          lng = 71.425 + (importedCount % 4) * 0.008;
        }
      }

      const sMin = parseTimeToMinutes(ev.startTime) ?? 600;
      const eMin = parseTimeToMinutes(ev.endTime) ?? 660;
      const durationMin = Math.max(15, eMin - sMin);

      let linkedTaskId: string | null = null;
      if (ev.locationName) {
        const task = await prisma.task.create({
          data: {
            userId: user.id,
            title: ev.title,
            locationName: ev.locationName,
            address: ev.address || ev.locationName,
            lat,
            lng,
            date: targetDate,
            windowStart: ev.startTime,
            windowEnd: ev.endTime,
            durationMin,
            priority: "HIGH",
            isFlexible: false,
            status: "PLANNED",
            source: "APPLE_ICS",
            externalId: ev.externalId,
            city: user.currentCity,
            timezone: user.currentTimezone,
          },
        });
        linkedTaskId = task.id;
      }

      await prisma.calendarEvent.create({
        data: {
          userId: user.id,
          calendarId: conn.id,
          provider: "APPLE_ICS",
          externalId: ev.externalId,
          title: ev.title,
          date: targetDate,
          startTime: ev.startTime,
          endTime: ev.endTime,
          isAllDay: ev.isAllDay,
          locationName: ev.locationName,
          address: ev.address,
          lat,
          lng,
          isHard: true,
          recurrenceRule: ev.recurrenceRule,
          linkedTaskId,
        },
      });
      importedCount++;
    }

    return NextResponse.json({
      ok: true,
      importedCount,
      connection: toSafeCalendarConnectionDto(conn),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
