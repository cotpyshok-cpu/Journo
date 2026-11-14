import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";
import { sanitizeText } from "@/lib/utils";

const createTaskSchema = z.object({
  title: z.string().min(1).max(160),
  locationName: z.string().max(160).nullable().optional(),
  address: z.string().max(220).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  windowEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  durationMin: z.number().int().min(5).max(480).default(30),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  isFlexible: z.boolean().default(true),
  source: z
    .enum(["TASK", "INTERNAL_CALENDAR", "GOOGLE_CALENDAR", "APPLE_ICS", "SERIES"])
    .default("TASK"),
  allowOverflow: z.boolean().optional(),
});

const patchTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(160).optional(),
  locationName: z.string().max(160).nullable().optional(),
  address: z.string().max(220).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  windowStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  windowEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  isFlexible: z.boolean().optional(),
  status: z
    .enum(["DRAFT", "PLANNED", "IN_PROGRESS", "DONE", "SKIPPED", "CONFLICT"])
    .optional(),
  legMode: z.enum(["WALK", "TRANSIT", "CAR", "TAXI", "CARPOOL"]).nullable().optional(),
  legModeChosenByUser: z.boolean().optional(),
  plannedOrder: z.number().int().min(1).max(100).nullable().optional(),
  extendedMin: z.number().int().min(0).max(240).optional(),
  startedAt: z.string().nullable().optional(),
  exceedsFreeLimit: z.boolean().optional(),
  deletedInCalendar: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const date = req.nextUrl.searchParams.get("date");
    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        ...(date ? { date } : {}),
      },
      orderBy: [{ plannedOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const data = createTaskSchema.parse(body);

    const hasLocation = data.lat != null && data.lng != null;
    const isFlexible = !data.windowStart || !data.windowEnd ? true : data.isFlexible;

    let exceedsFreeLimit = false;
    if (user.tier === "FREE" && hasLocation) {
      const currentCount = await prisma.task.count({
        where: {
          userId: user.id,
          date: data.date,
          lat: { not: null },
          exceedsFreeLimit: false,
        },
      });
      if (currentCount >= 5) {
        if (!data.allowOverflow) {
          return NextResponse.json(
            {
              error: {
                code: "FREE_LIMIT_REACHED",
                message:
                  "Free plan allows up to 5 routed tasks per date. Upgrade to Pro for unlimited tasks.",
              },
            },
            { status: 402 }
          );
        }
        exceedsFreeLimit = true;
      }
    }

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: sanitizeText(data.title, 160),
        locationName: data.locationName ? sanitizeText(data.locationName, 160) : null,
        address: data.address ? sanitizeText(data.address, 220) : null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        date: data.date,
        windowStart: data.windowStart ?? null,
        windowEnd: data.windowEnd ?? null,
        durationMin: data.durationMin,
        priority: data.priority,
        isFlexible,
        status: hasLocation ? "PLANNED" : "DRAFT",
        source: data.source,
        city: user.currentCity,
        timezone: user.currentTimezone,
        exceedsFreeLimit,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const data = patchTaskSchema.parse(body);

    const existing = await prisma.task.findFirst({
      where: { id: data.id, userId: user.id },
    });
    if (!existing) throw new NotFoundError("Task", data.id);

    const { id, startedAt, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };
    if (rest.title !== undefined) updateData.title = sanitizeText(rest.title, 160);
    if (rest.locationName !== undefined) {
      updateData.locationName = rest.locationName ? sanitizeText(rest.locationName, 160) : null;
    }
    if (rest.address !== undefined) {
      updateData.address = rest.address ? sanitizeText(rest.address, 220) : null;
    }
    if (startedAt !== undefined) {
      updateData.startedAt = startedAt ? new Date(startedAt) : null;
    }

    // If adding a location to a previously locationless event on Free tier, enforce limit
    const becomingRoutable =
      existing.lat == null &&
      updateData.lat != null &&
      updateData.lng != null &&
      user.tier === "FREE";
    if (becomingRoutable) {
      const targetDate = (updateData.date as string) || existing.date;
      const count = await prisma.task.count({
        where: {
          userId: user.id,
          date: targetDate,
          lat: { not: null },
          exceedsFreeLimit: false,
          id: { not: existing.id },
        },
      });
      if (count >= 5) {
        updateData.exceedsFreeLimit = true;
      } else if (existing.status === "DRAFT") {
        updateData.status = "PLANNED";
      }
    }

    const updated = await prisma.task.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new ValidationError("Task id is required");

    const existing = await prisma.task.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Task", id);

    await prisma.task.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
