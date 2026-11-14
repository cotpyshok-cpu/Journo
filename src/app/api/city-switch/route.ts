import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CITY_PRESETS } from "@/lib/astana-places";
import { prisma } from "@/lib/db";
import { toSafeUserDto } from "@/lib/dto";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";
import { getDateInTimezone } from "@/lib/utils";

const citySwitchSchema = z.object({
  targetCity: z.enum(["Astana", "Almaty", "London", "Tokyo"]),
  tempBaseAddress: z.string().max(200).nullable().optional(),
  tempBaseLat: z.number().min(-90).max(90).nullable().optional(),
  tempBaseLng: z.number().min(-180).max(180).nullable().optional(),
  pauseActiveSeries: z.boolean().optional(),
  urgentDecisions: z
    .array(
      z.object({
        taskId: z.string(),
        decision: z.enum(["KEEP", "RESCHEDULE", "DELETE"]),
      })
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const input = citySwitchSchema.parse(body);

    const preset = CITY_PRESETS.find((c) => c.name === input.targetCity);
    if (!preset) throw new ValidationError("Unknown target city");

    const returningHome = preset.name === user.homeCity;

    // Apply urgent task decisions in previous city (F7 Step 4)
    if (input.urgentDecisions && input.urgentDecisions.length > 0) {
      for (const dec of input.urgentDecisions) {
        if (dec.decision === "DELETE") {
          await prisma.task.deleteMany({
            where: { id: dec.taskId, userId: user.id },
          });
        } else if (dec.decision === "RESCHEDULE") {
          const nextWeek = getDateInTimezone(user.homeTimezone || "Asia/Almaty", 7);
          await prisma.task.updateMany({
            where: { id: dec.taskId, userId: user.id },
            data: { date: nextWeek, plannedOrder: null, eta: null, departureTime: null },
          });
        }
        // "KEEP" retains the task in its original city & timezone so dual timezone badge displays
      }
    }

    if (input.pauseActiveSeries) {
      await prisma.taskSeries.updateMany({
        where: { userId: user.id, status: "ACTIVE" },
        data: { status: "PAUSED" },
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        currentCity: preset.name,
        currentTimezone: preset.timezone,
        tempBaseAddress: returningHome
          ? null
          : input.tempBaseAddress ?? preset.suggestedTempBase.address,
        tempBaseLat: returningHome
          ? null
          : input.tempBaseLat ?? preset.suggestedTempBase.lat,
        tempBaseLng: returningHome
          ? null
          : input.tempBaseLng ?? preset.suggestedTempBase.lng,
      },
    });

    return NextResponse.json({
      ok: true,
      user: toSafeUserDto(updated),
      preset,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
