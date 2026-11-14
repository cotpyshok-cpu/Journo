import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";

const pushPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(240),
  type: z
    .enum([
      "LEAVE_NOW",
      "DELAY_RISK",
      "CALENDAR_CHANGED",
      "EVENING_REVIEW",
      "CITY_URGENT",
      "SERIES_ENDING",
      "INFO",
    ])
    .default("LEAVE_NOW"),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const payload = pushPayloadSchema.parse(body);

    const subsCount = await prisma.pushSubscriptionRecord.count({
      where: { userId: user.id },
    });

    return NextResponse.json({
      ok: true,
      deliveredChannel: subsCount > 0 || user.tier !== "FREE" ? "WEB_PUSH_AND_IN_APP" : "IN_APP",
      notification: {
        id: `notif-${Date.now()}`,
        ...payload,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
