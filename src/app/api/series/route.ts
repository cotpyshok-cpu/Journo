import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";
import { getDateInTimezone, sanitizeText } from "@/lib/utils";

const createSeriesSchema = z.object({
  title: z.string().min(1).max(160),
  locationName: z.string().min(1).max(160),
  address: z.string().min(1).max(220),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  mode: z.enum(["SPECIFIC_DAYS", "N_PER_WEEK"]).default("SPECIFIC_DAYS"),
  daysOfWeek: z.string().nullable().optional(),
  timesPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  windowStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  windowEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  durationMin: z.number().int().min(5).max(480).default(60),
  isFlexible: z.boolean().default(false),
  endType: z.enum(["UNTIL_DATE", "N_OCCURRENCES", "THREE_MONTHS", "ENDLESS"]).default("THREE_MONTHS"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  totalCount: z.number().int().min(1).max(365).optional(),
  createTodayOccurrence: z.boolean().default(true),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const patchSeriesSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["PAUSE", "RESUME", "COMPLETE", "EXTEND_MONTH", "UPDATE"]),
  scope: z.enum(["THIS_ONLY", "THIS_AND_FOLLOWING", "ALL"]).default("ALL"),
  taskId: z.string().optional(),
  title: z.string().min(1).max(160).optional(),
  windowStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  windowEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export async function GET() {
  try {
    const user = await getActiveUser();
    const series = await prisma.taskSeries.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const data = createSeriesSchema.parse(body);

    const endDate =
      data.endDate ||
      getDateInTimezone(user.currentTimezone || "Asia/Almaty", data.endType === "THREE_MONTHS" ? 90 : 30);
    const totalCount =
      data.totalCount ??
      (data.mode === "N_PER_WEEK"
        ? (data.timesPerWeek ?? 3) * 13
        : (data.daysOfWeek?.split(",").filter(Boolean).length || 3) * 13);

    const series = await prisma.taskSeries.create({
      data: {
        userId: user.id,
        title: sanitizeText(data.title, 160),
        locationName: sanitizeText(data.locationName, 160),
        address: sanitizeText(data.address, 220),
        lat: data.lat,
        lng: data.lng,
        mode: data.mode,
        daysOfWeek: data.daysOfWeek ?? "Mon,Wed,Fri",
        timesPerWeek: data.timesPerWeek ?? null,
        windowStart: data.windowStart ?? null,
        windowEnd: data.windowEnd ?? null,
        durationMin: data.durationMin,
        isFlexible: data.isFlexible,
        endType: data.endType,
        endDate,
        totalCount,
        completedCount: 0,
        status: "ACTIVE",
        city: user.currentCity,
        timezone: user.currentTimezone,
      },
    });

    let createdTask = null;
    if (data.createTodayOccurrence) {
      const targetDate = data.date || getDateInTimezone(user.currentTimezone || "Asia/Almaty", 0);
      let exceedsFreeLimit = false;
      if (user.tier === "FREE") {
        const count = await prisma.task.count({
          where: {
            userId: user.id,
            date: targetDate,
            lat: { not: null },
            exceedsFreeLimit: false,
          },
        });
        if (count >= 5) {
          exceedsFreeLimit = true;
        }
      }

      createdTask = await prisma.task.create({
        data: {
          userId: user.id,
          title: series.title,
          locationName: series.locationName,
          address: series.address,
          lat: series.lat,
          lng: series.lng,
          date: targetDate,
          windowStart: series.windowStart,
          windowEnd: series.windowEnd,
          durationMin: series.durationMin,
          priority: "MEDIUM",
          isFlexible: series.isFlexible,
          status: "PLANNED",
          source: "SERIES",
          seriesId: series.id,
          seriesOccurrenceIndex: 1,
          seriesTotalCount: series.totalCount,
          city: user.currentCity,
          timezone: user.currentTimezone,
          exceedsFreeLimit,
        },
      });
    }

    return NextResponse.json({ series, createdTask }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const data = patchSeriesSchema.parse(body);

    const existing = await prisma.taskSeries.findFirst({
      where: { id: data.id, userId: user.id },
    });
    if (!existing) throw new NotFoundError("TaskSeries", data.id);

    if (data.action === "PAUSE") {
      const updated = await prisma.taskSeries.update({
        where: { id: existing.id },
        data: { status: "PAUSED" },
      });
      return NextResponse.json({ series: updated });
    }

    if (data.action === "RESUME") {
      const updated = await prisma.taskSeries.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      });
      return NextResponse.json({ series: updated });
    }

    if (data.action === "COMPLETE") {
      const updated = await prisma.taskSeries.update({
        where: { id: existing.id },
        data: { status: "COMPLETED" },
      });
      return NextResponse.json({ series: updated });
    }

    if (data.action === "EXTEND_MONTH") {
      const base = new Date(existing.endDate);
      base.setDate(base.getDate() + 30);
      const nextEnd = base.toISOString().slice(0, 10);
      const updated = await prisma.taskSeries.update({
        where: { id: existing.id },
        data: {
          endDate: nextEnd,
          totalCount: existing.totalCount + 12,
          status: "ACTIVE",
        },
      });
      return NextResponse.json({ series: updated });
    }

    // UPDATE with scope (THIS_ONLY | THIS_AND_FOLLOWING | ALL)
    if (data.scope === "THIS_ONLY" && data.taskId) {
      await prisma.task.updateMany({
        where: { id: data.taskId, userId: user.id },
        data: {
          ...(data.title ? { title: sanitizeText(data.title, 160) } : {}),
          ...(data.windowStart !== undefined ? { windowStart: data.windowStart } : {}),
          ...(data.windowEnd !== undefined ? { windowEnd: data.windowEnd } : {}),
        },
      });
      return NextResponse.json({ series: existing, scopeApplied: "THIS_ONLY" });
    }

    const updated = await prisma.taskSeries.update({
      where: { id: existing.id },
      data: {
        ...(data.title ? { title: sanitizeText(data.title, 160) } : {}),
        ...(data.windowStart !== undefined ? { windowStart: data.windowStart } : {}),
        ...(data.windowEnd !== undefined ? { windowEnd: data.windowEnd } : {}),
      },
    });
    await prisma.task.updateMany({
      where: { seriesId: existing.id, userId: user.id, status: { in: ["DRAFT", "PLANNED"] } },
      data: {
        ...(data.title ? { title: sanitizeText(data.title, 160) } : {}),
        ...(data.windowStart !== undefined ? { windowStart: data.windowStart } : {}),
        ...(data.windowEnd !== undefined ? { windowEnd: data.windowEnd } : {}),
      },
    });

    return NextResponse.json({ series: updated, scopeApplied: data.scope });
  } catch (error) {
    return handleApiError(error);
  }
}
