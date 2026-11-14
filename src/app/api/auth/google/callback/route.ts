import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncGoogleEventsForUser } from "@/lib/google-calendar";
import {
  sanitizeRedirectPath,
  verifyStateConstantTime,
} from "@/lib/oauth-security";
import { populateSampleData } from "@/lib/seed";
import { getActiveUserId, SESSION_COOKIE_NAME } from "@/lib/session";
import { sanitizeText } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const errParam = req.nextUrl.searchParams.get("error");
  if (errParam) {
    return NextResponse.redirect(new URL(`/app?view=S18&oauth=denied`, req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("journo_oauth_state")?.value;
  const codeVerifier = req.cookies.get("journo_pkce_verifier")?.value;
  const returnTo = sanitizeRedirectPath(req.cookies.get("journo_oauth_return")?.value);
  const intent = req.cookies.get("journo_oauth_intent")?.value || "login";

  if (!code || !verifyStateConstantTime(expectedState, state) || !codeVerifier) {
    return NextResponse.redirect(new URL(`/app?view=S18&oauth=state_error`, req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() || `${appUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL(`/app?view=S18&oauth=unconfigured`, req.url));
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL(`/app?view=S18&oauth=token_error`, req.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;
    const expiresIn: number = tokenData.expires_in || 3600;

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(4000),
    });

    if (!userInfoRes.ok) {
      return NextResponse.redirect(new URL(`/app?view=S18&oauth=profile_error`, req.url));
    }

    const profile = await userInfoRes.json();
    const googleEmail = sanitizeText(profile.email || "", 120).toLowerCase();
    const googleName = sanitizeText(profile.name || "Google User", 80);
    const avatarUrl = typeof profile.picture === "string" ? profile.picture : null;

    let targetUserId: string;

    if (intent === "calendar") {
      targetUserId = await getActiveUserId();
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          name: googleName,
          avatarUrl,
        },
      });
    } else {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: googleEmail },
      });
      if (existingByEmail) {
        targetUserId = existingByEmail.id;
        await prisma.user.update({
          where: { id: targetUserId },
          data: { name: googleName, avatarUrl },
        });
      } else {
        const created = await prisma.user.create({
          data: {
            email: googleEmail,
            name: googleName,
            avatarUrl,
            tier: "PRO", // Enable immediate calendar sync evaluation for jury OAuth sign-in
            transportModes: "BOTH",
            currentCity: "Astana",
            currentTimezone: "Asia/Almaty",
            homeCity: "Astana",
            homeTimezone: "Asia/Almaty",
            onboardingStep: 9,
          },
        });
        targetUserId = created.id;
        await populateSampleData(targetUserId);
      }
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });

    const conn = await prisma.calendarConnection.upsert({
      where: { userId_provider: { userId: targetUserId, provider: "GOOGLE" } },
      update: {
        accountEmail: googleEmail,
        status: "CONNECTED",
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        lastSyncedAt: new Date(),
      },
      create: {
        userId: targetUserId,
        provider: "GOOGLE",
        accountEmail: googleEmail,
        status: "CONNECTED",
        accessToken,
        refreshToken: refreshToken || null,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        lastSyncedAt: new Date(),
      },
    });

    let syncedCount = 0;
    try {
      syncedCount = await syncGoogleEventsForUser(
        targetUserId,
        conn.id,
        accessToken,
        user.currentCity,
        user.currentTimezone,
        conn.importAllDay
      );
    } catch {
      // Connection is still stored; user can inspect or retry in S18
    }

    const dest = new URL(returnTo, req.url);
    dest.searchParams.set("view", "S18");
    dest.searchParams.set("oauth", "connected");
    dest.searchParams.set("synced", String(syncedCount));

    const res = NextResponse.redirect(dest);
    res.cookies.set(SESSION_COOKIE_NAME, targetUserId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 14,
      path: "/",
    });
    res.cookies.delete("journo_oauth_state");
    res.cookies.delete("journo_pkce_verifier");
    res.cookies.delete("journo_oauth_return");
    res.cookies.delete("journo_oauth_intent");
    return res;
  } catch (error) {
    console.error("[Google OAuth Callback Error]", error);
    return NextResponse.redirect(new URL(`/app?view=S18&oauth=error`, req.url));
  }
}
