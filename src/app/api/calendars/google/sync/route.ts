import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { syncGoogleEventsForUser } from "@/lib/google-calendar";
import { prisma } from "@/lib/db";
import { toSafeCalendarConnectionDto } from "@/lib/dto";
import { ForbiddenError, handleApiError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";
import { getDateInTimezone } from "@/lib/utils";

const syncSchema = z.object({
  action: z.enum(["sync", "sandbox_sync", "toggle_all_day", "revoke_sim", "disconnect", "token_sync"]),
  accessToken: z.string().optional(),
  importAllDay: z.boolean().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const input = syncSchema.parse(body);

    if (
      user.tier === "FREE" &&
      input.action !== "disconnect" &&
      input.action !== "toggle_all_day"
    ) {
      throw new ForbiddenError(
        "External Google Calendar sync requires Pro or Dev mode."
      );
    }

    const activeDate =
      input.date || getDateInTimezone(user.currentTimezone || "Asia/Almaty", 0);

    if (input.action === "disconnect") {
      const conn = await prisma.calendarConnection.findUnique({
        where: { userId_provider: { userId: user.id, provider: "GOOGLE" } },
      });
      if (conn) {
        // Per Rule 14.1: External calendar events leave the calendar grid, while planned tasks stay in the plan
        await prisma.calendarEvent.deleteMany({
          where: { calendarId: conn.id, userId: user.id },
        });
        await prisma.calendarConnection.delete({ where: { id: conn.id } });
      }
      return NextResponse.json({ ok: true, disconnected: true });
    }

    if (input.action === "revoke_sim") {
      const conn = await prisma.calendarConnection.upsert({
        where: { userId_provider: { userId: user.id, provider: "GOOGLE" } },
        update: { status: "NEEDS_RECONNECT" },
        create: {
          userId: user.id,
          provider: "GOOGLE",
          accountEmail: user.email,
          status: "NEEDS_RECONNECT",
        },
      });
      return NextResponse.json({
        ok: true,
        connection: toSafeCalendarConnectionDto(conn),
      });
    }

    if (input.action === "toggle_all_day") {
      const conn = await prisma.calendarConnection.upsert({
        where: { userId_provider: { userId: user.id, provider: "GOOGLE" } },
        update: { importAllDay: Boolean(input.importAllDay) },
        create: {
          userId: user.id,
          provider: "GOOGLE",
          accountEmail: user.email,
          status: "CONNECTED",
          importAllDay: Boolean(input.importAllDay),
        },
      });
      return NextResponse.json({
        ok: true,
        connection: toSafeCalendarConnectionDto(conn),
      });
    }

    if (input.action === "token_sync" && input.accessToken) {
      const conn = await prisma.calendarConnection.upsert({
        where: { userId_provider: { userId: user.id, provider: "GOOGLE" } },
        update: {
          accessToken: input.accessToken,
          status: "CONNECTED",
        },
        create: {
          userId: user.id,
          provider: "GOOGLE",
          accountEmail: "google-calendar-user@gmail.com",
          status: "CONNECTED",
          accessToken: input.accessToken,
        },
      });
      const importedCount = await syncGoogleEventsForUser(
        user.id,
        conn.id,
        input.accessToken,
        user.currentCity,
        user.currentTimezone,
        conn.importAllDay
      );
      return NextResponse.json({
        ok: true,
        importedCount,
        connection: toSafeCalendarConnectionDto(conn),
      });
    }

    if (input.action === "sync") {
      const conn = await prisma.calendarConnection.findUnique({
        where: { userId_provider: { userId: user.id, provider: "GOOGLE" } },
      });
      if (!conn || !conn.accessToken) {
        return NextResponse.json(
          {
            error: {
              code: "NO_GOOGLE_TOKEN",
              message: "No active Google OAuth token. Connect via Google or use Sandbox Sync.",
            },
          },
          { status: 400 }
        );
      }
      const importedCount = await syncGoogleEventsForUser(
        user.id,
        conn.id,
        conn.accessToken,
        user.currentCity,
        user.currentTimezone,
        conn.importAllDay
      );
      return NextResponse.json({
        ok: true,
        importedCount,
        connection: toSafeCalendarConnectionDto(conn),
      });
    }

    // sandbox_sync: inserts realistic Astana Google Calendar events for jury testing without OAuth keys
    const conn = await prisma.calendarConnection.upsert({
      where: { userId_provider: { userId: user.id, provider: "GOOGLE" } },
      update: {
        status: "CONNECTED",
        accountEmail: "jury.demo@gmail.com",
        lastSyncedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider: "GOOGLE",
        accountEmail: "jury.demo@gmail.com",
        status: "CONNECTED",
        lastSyncedAt: new Date(),
      },
    });

    const sampleGoogleEvents = [
      {
        externalId: `gcal-aifc-${activeDate}`,
        title: "AIFC Fintech Legal Sign-Off",
        startTime: "11:30",
        endTime: "12:15",
        locationName: "AIFC Fintech Hub",
        address: "Mangilik El Ave 55/18, Astana",
        lat: 51.0909,
        lng: 71.4184,
      },
      {
        externalId: `gcal-keruen-${activeDate}`,
        title: "Press Briefing at Baiterek / Keruen",
        startTime: "16:15",
        endTime: "17:00",
        locationName: "Keruen Mall",
        address: "Dostyk St 9, Astana",
        lat: 51.1286,
        lng: 71.4257,
      },
    ];

    let importedCount = 0;
    for (const ev of sampleGoogleEvents) {
      const exists = await prisma.calendarEvent.findFirst({
        where: { userId: user.id, provider: "GOOGLE", externalId: ev.externalId },
      });
      if (!exists) {
        const task = await prisma.task.create({
          data: {
            userId: user.id,
            title: ev.title,
            locationName: ev.locationName,
            address: ev.address,
            lat: ev.lat,
            lng: ev.lng,
            date: activeDate,
            windowStart: ev.startTime,
            windowEnd: ev.endTime,
            durationMin: 45,
            priority: "HIGH",
            isFlexible: false,
            status: "PLANNED",
            source: "GOOGLE_CALENDAR",
            externalId: ev.externalId,
            city: user.currentCity,
            timezone: user.currentTimezone,
          },
        });
        await prisma.calendarEvent.create({
          data: {
            userId: user.id,
            calendarId: conn.id,
            provider: "GOOGLE",
            externalId: ev.externalId,
            title: ev.title,
            date: activeDate,
            startTime: ev.startTime,
            endTime: ev.endTime,
            locationName: ev.locationName,
            address: ev.address,
            lat: ev.lat,
            lng: ev.lng,
            isHard: true,
            linkedTaskId: task.id,
          },
        });
        importedCount++;
      }
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
