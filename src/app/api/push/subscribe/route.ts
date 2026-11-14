import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const data = subSchema.parse(body);

    await prisma.pushSubscriptionRecord.upsert({
      where: { userId_endpoint: { userId: user.id, endpoint: data.endpoint } },
      update: { p256dh: data.keys.p256dh, auth: data.keys.auth },
      create: {
        userId: user.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
      },
    });

    return NextResponse.json({ ok: true, subscribed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
