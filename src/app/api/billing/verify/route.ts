import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toSafeUserDto } from "@/lib/dto";
import { handleApiError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";

const verifySchema = z.object({
  action: z.enum(["refresh_status", "cancel_pro"]).default("refresh_status"),
  plan: z.enum(["monthly", "yearly"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const input = verifySchema.parse(body);

    if (input.action === "cancel_pro") {
      // Business Rule 9: tasks are NOT deleted when cancelling Pro; only creation limits apply
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          tier: "FREE",
          subscriptionEndsAt: null,
        },
      });
      return NextResponse.json({
        ok: true,
        status: "CANCELLED",
        user: toSafeUserDto(updated),
      });
    }

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + (input.plan === "yearly" ? 365 : 30));

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        tier: "PRO",
        subscriptionEndsAt: endsAt,
      },
    });

    await prisma.task.updateMany({
      where: { userId: user.id, exceedsFreeLimit: true },
      data: { exceedsFreeLimit: false },
    });

    return NextResponse.json({
      ok: true,
      status: "ACTIVATED",
      user: toSafeUserDto(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
