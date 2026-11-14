import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toSafeUserDto } from "@/lib/dto";
import { handleApiError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";

const checkoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"]),
  mode: z.enum(["auto", "sandbox_success", "sandbox_delay", "sandbox_error"]).default("auto"),
  returnScreen: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const input = checkoutSchema.parse(body);

    const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
    const priceId =
      input.plan === "monthly"
        ? process.env.STRIPE_PRICE_MONTHLY_ID?.trim()
        : process.env.STRIPE_PRICE_YEARLY_ID?.trim();

    if (stripeKey && priceId && input.mode === "auto") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;
      const params = new URLSearchParams({
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${appUrl}/app?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/app?billing=cancelled`,
        customer_email: user.email,
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
        signal: AbortSignal.timeout(5000),
      });

      if (stripeRes.ok) {
        const session = await stripeRes.json();
        return NextResponse.json({
          provider: "STRIPE",
          checkoutUrl: session.url,
          sessionId: session.id,
        });
      }
    }

    if (input.mode === "sandbox_error") {
      return NextResponse.json(
        {
          error: {
            code: "PAYMENT_DECLINED",
            message: "Card authorization failed in sandbox test. Pro was not activated.",
          },
        },
        { status: 402 }
      );
    }

    if (input.mode === "sandbox_delay") {
      return NextResponse.json({
        provider: "SANDBOX",
        status: "PENDING_WEBHOOK",
        message: "Payment submitted; waiting for webhook confirmation...",
      });
    }

    // Immediate Sandbox Pro upgrade
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + (input.plan === "yearly" ? 365 : 30));

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        tier: "PRO",
        subscriptionEndsAt: endsAt,
      },
    });

    // Clear Free overflow lock on existing tasks so user can immediately build full day
    await prisma.task.updateMany({
      where: { userId: user.id, exceedsFreeLimit: true },
      data: { exceedsFreeLimit: false },
    });

    return NextResponse.json({
      provider: "SANDBOX",
      status: "ACTIVATED",
      user: toSafeUserDto(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
