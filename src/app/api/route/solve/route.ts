import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors";
import { solveDailySchedule } from "@/lib/routing-engine";
import { getActiveUser } from "@/lib/session";
import { TaskItem, TransportPref } from "@/lib/types";
import { formatMinutesToTime, parseTimeToMinutes } from "@/lib/utils";

const solveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["build", "preview", "accept", "start_day", "complete_day", "resolve_conflict"]).default("build"),
  offline: z.boolean().optional(),
  simulateQuotaExhausted: z.boolean().optional(),
  simulatePartialQuota: z.boolean().optional(),
  trafficDelayMultiplier: z.number().min(0.8).max(3).optional(),
  dayStartMin: z.number().int().min(300).max(1380).optional(),
  summary: z.string().max(180).optional(),
  conflictAction: z
    .object({
      optionId: z.enum(["REMOVE_FLEXIBLE", "SHIFT_WINDOW", "ENABLE_BOTH_MODES"]),
      targetTaskId: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const input = solveSchema.parse(body);

    if (input.offline) {
      return NextResponse.json(
        {
          error: {
            code: "OFFLINE_MODE",
            message: "Network unavailable. Showing last saved plan in read-only mode.",
          },
        },
        { status: 503 }
      );
    }

    // Handle Day State transitions directly
    if (input.mode === "start_day" || input.mode === "complete_day") {
      const targetState = input.mode === "start_day" ? "ACTIVE" : "COMPLETED";
      const existing = await prisma.dayPlan.findUnique({
        where: { userId_date: { userId: user.id, date: input.date } },
      });
      if (existing) {
        const updatedPlan = await prisma.dayPlan.update({
          where: { id: existing.id },
          data: { state: targetState, lastUpdatedAt: new Date() },
        });
        return NextResponse.json({ ok: true, dayPlan: updatedPlan });
      }
      const createdPlan = await prisma.dayPlan.create({
        data: {
          userId: user.id,
          date: input.date,
          state: targetState,
          currentVersion: 1,
        },
      });
      return NextResponse.json({ ok: true, dayPlan: createdPlan });
    }

    // Apply conflict resolution action if requested (S10)
    let activeTransportPref = user.transportModes as TransportPref;
    if (input.mode === "resolve_conflict" && input.conflictAction) {
      const { optionId, targetTaskId } = input.conflictAction;
      if (optionId === "REMOVE_FLEXIBLE" && targetTaskId) {
        await prisma.task.updateMany({
          where: { id: targetTaskId, userId: user.id },
          data: { status: "SKIPPED" },
        });
      } else if (optionId === "SHIFT_WINDOW" && targetTaskId) {
        const target = await prisma.task.findFirst({
          where: { id: targetTaskId, userId: user.id },
        });
        if (target && target.windowStart && target.windowEnd) {
          const sMin = parseTimeToMinutes(target.windowStart) ?? 540;
          const eMin = parseTimeToMinutes(target.windowEnd) ?? 600;
          await prisma.task.update({
            where: { id: target.id },
            data: {
              windowStart: formatMinutesToTime(sMin + 45),
              windowEnd: formatMinutesToTime(eMin + 45),
              status: "PLANNED",
            },
          });
        }
      } else if (optionId === "ENABLE_BOTH_MODES") {
        await prisma.user.update({
          where: { id: user.id },
          data: { transportModes: "BOTH" },
        });
        activeTransportPref = "BOTH";
      }
    }

    const tasks = (await prisma.task.findMany({
      where: { userId: user.id, date: input.date },
      orderBy: [{ plannedOrder: "asc" }, { createdAt: "asc" }],
    })) as unknown as TaskItem[];

    const existingPlanForOrigin = await prisma.dayPlan.findUnique({
      where: { userId_date: { userId: user.id, date: input.date } },
    });

    const completedRouted = tasks
      .filter((t) => t.status === "DONE" && t.lat != null && t.lng != null)
      .sort((a, b) => (a.plannedOrder ?? 0) - (b.plannedOrder ?? 0));
    const lastCompleted =
      existingPlanForOrigin?.state === "ACTIVE" && completedRouted.length > 0
        ? completedRouted[completedRouted.length - 1]
        : null;

    const plannedOrderOffset =
      existingPlanForOrigin?.state === "ACTIVE"
        ? tasks
            .filter((t) => t.status === "DONE" || t.status === "SKIPPED")
            .reduce((max, t) => Math.max(max, t.plannedOrder ?? 0), 0)
        : 0;

    const originLat = lastCompleted?.lat ?? user.tempBaseLat ?? user.homeLat;
    const originLng = lastCompleted?.lng ?? user.tempBaseLng ?? user.homeLng;
    const originLabel =
      lastCompleted?.locationName ??
      lastCompleted?.title ??
      user.tempBaseAddress ??
      user.homeAddress;

    const lastDoneEndMin = lastCompleted
      ? (parseTimeToMinutes(lastCompleted.eta) ??
          parseTimeToMinutes(lastCompleted.windowStart) ??
          510) + (lastCompleted.durationMin ?? 30)
      : 510;
    const effectiveDayStartMin = input.dayStartMin ?? Math.max(510, lastDoneEndMin);

    const result = await solveDailySchedule({
      origin: { lat: originLat, lng: originLng, label: originLabel },
      tasks,
      transportPref: activeTransportPref,
      dayStartMin: effectiveDayStartMin,
      plannedOrderOffset,
      offline: false,
      simulateQuotaExhausted: input.simulateQuotaExhausted,
      simulatePartialQuota: input.simulatePartialQuota,
      trafficDelayMultiplier: input.trafficDelayMultiplier,
      previousTasks: tasks.filter((t) => t.plannedOrder != null),
    });

    if (!result.ok && result.conflict) {
      // Persist CONFLICT status on affected tasks so S10 & task list reflect it
      await prisma.task.updateMany({
        where: { id: { in: result.conflict.affectedTaskIds }, userId: user.id },
        data: { status: "CONFLICT" },
      });
      return NextResponse.json({
        ok: false,
        conflict: result.conflict,
        providerUsed: result.providerUsed,
        isEstimateWithoutTraffic: result.isEstimateWithoutTraffic,
      });
    }

    if (input.mode === "preview") {
      return NextResponse.json({
        ok: true,
        preview: true,
        result,
      });
    }

    // Commit schedule & create new PlanVersion (v1, v2, ...)
    await Promise.all(
      result.scheduledTasks.map((t) =>
        prisma.task.update({
          where: { id: t.id },
          data: {
            status: t.status === "CONFLICT" ? "PLANNED" : t.status,
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

    const existingPlan = await prisma.dayPlan.findUnique({
      where: { userId_date: { userId: user.id, date: input.date } },
    });

    const nextVersion = existingPlan ? existingPlan.currentVersion + 1 : 1;

    const dayPlan = existingPlan
      ? await prisma.dayPlan.update({
          where: { id: existingPlan.id },
          data: {
            currentVersion: nextVersion,
            totalKm: result.totalKm,
            totalTravelMin: result.totalTravelMin,
            naiveTravelMin: result.naiveTravelMin,
            savedMin: result.savedMin,
            providerUsed: result.providerUsed,
            isEstimateWithoutTraffic: result.isEstimateWithoutTraffic,
            lastUpdatedAt: new Date(),
          },
        })
      : await prisma.dayPlan.create({
          data: {
            userId: user.id,
            date: input.date,
            state: "DRAFT",
            currentVersion: 1,
            totalKm: result.totalKm,
            totalTravelMin: result.totalTravelMin,
            naiveTravelMin: result.naiveTravelMin,
            savedMin: result.savedMin,
            providerUsed: result.providerUsed,
            isEstimateWithoutTraffic: result.isEstimateWithoutTraffic,
          },
        });

    await prisma.planVersion.create({
      data: {
        dayPlanId: dayPlan.id,
        version: dayPlan.currentVersion,
        summary: input.summary || `Route optimization v${dayPlan.currentVersion}`,
        deltaMinutes: result.deltaMinutes,
        deltaKm: result.deltaKm,
        shiftedTasksJson: JSON.stringify(result.shiftedTasks),
        snapshotJson: JSON.stringify(result.scheduledTasks),
      },
    });

    return NextResponse.json({
      ok: true,
      result,
      dayPlan,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
