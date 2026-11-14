import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toSafeUserDto } from "@/lib/dto";
import { handleApiError, ValidationError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";
import { SESSION_COOKIE_NAME } from "@/lib/session";

const updateUserSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  tier: z.enum(["FREE", "PRO", "DEV"]).optional(),
  transportModes: z.enum(["BOTH", "WALK", "TRANSIT", "CAR"]).optional(),
  homeAddress: z.string().min(2).max(200).optional(),
  homeLat: z.number().min(-90).max(90).optional(),
  homeLng: z.number().min(-180).max(180).optional(),
  workAddress: z.string().max(200).nullable().optional(),
  workLat: z.number().min(-90).max(90).nullable().optional(),
  workLng: z.number().min(-180).max(180).nullable().optional(),
  tempBaseAddress: z.string().max(200).nullable().optional(),
  tempBaseLat: z.number().min(-90).max(90).nullable().optional(),
  tempBaseLng: z.number().min(-180).max(180).nullable().optional(),
  delayThresholdMin: z.number().int().min(1).max(30).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  preferredNavApp: z.enum(["GOOGLE", "APPLE", "WAZE"]).optional(),
  onboardingStep: z.number().int().min(1).max(9).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const isExport = req.nextUrl.searchParams.get("export") === "1";

    if (isExport) {
      const [tasks, series, calendarEvents, dayPlans] = await Promise.all([
        prisma.task.findMany({ where: { userId: user.id } }),
        prisma.taskSeries.findMany({ where: { userId: user.id } }),
        prisma.calendarEvent.findMany({ where: { userId: user.id } }),
        prisma.dayPlan.findMany({ where: { userId: user.id }, include: { versions: true } }),
      ]);
      return new NextResponse(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            profile: toSafeUserDto(user),
            tasks,
            series,
            calendarEvents,
            dayPlans,
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="journo-export.json"',
          },
        }
      );
    }

    return NextResponse.json({ user: toSafeUserDto(user) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const parsed = updateUserSchema.parse(body);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: parsed,
    });

    return NextResponse.json({ user: toSafeUserDto(updated) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    if (body?.confirm !== "DELETE") {
      throw new ValidationError('Type "DELETE" to confirm permanent account removal.');
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    const res = NextResponse.json({ ok: true, deleted: true });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  } catch (error) {
    return handleApiError(error);
  }
}
