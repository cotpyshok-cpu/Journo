import { NextRequest, NextResponse } from "next/server";
import {
  derivePkceChallenge,
  generateOAuthState,
  generatePkceVerifier,
  sanitizeRedirectPath,
} from "@/lib/oauth-security";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() || `${appUrl}/api/auth/google/callback`;

  const returnTo = sanitizeRedirectPath(req.nextUrl.searchParams.get("next") || "/app");
  const intent = req.nextUrl.searchParams.get("intent") === "calendar" ? "calendar" : "login";

  if (!clientId) {
    return NextResponse.redirect(
      new URL(`/app?view=S18&oauth=unconfigured`, req.url)
    );
  }

  const state = generateOAuthState();
  const codeVerifier = generatePkceVerifier();
  const codeChallenge = derivePkceChallenge(codeVerifier);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    "openid email profile https://www.googleapis.com/auth/calendar.readonly"
  );
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(authUrl.toString());
  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set("journo_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 600,
    path: "/",
  });
  res.cookies.set("journo_pkce_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 600,
    path: "/",
  });
  res.cookies.set("journo_oauth_return", returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 600,
    path: "/",
  });
  res.cookies.set("journo_oauth_intent", intent, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 600,
    path: "/",
  });

  return res;
}
