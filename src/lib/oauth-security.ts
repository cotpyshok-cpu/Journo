import crypto from "node:crypto";

const ALLOWED_RETURN_PATHS = ["/app", "/"] as const;

export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function generatePkceVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function derivePkceChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function verifyStateConstantTime(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual) return false;
  const bufA = Buffer.from(expected, "utf-8");
  const bufB = Buffer.from(actual, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function sanitizeRedirectPath(input: string | null | undefined): string {
  if (!input) return "/app";
  const trimmed = input.trim();
  // Reject protocol-relative //, explicit schemes, backslashes, or @ authority tricks
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("@") ||
    trimmed.includes(":")
  ) {
    return "/app";
  }

  const pathname = trimmed.split("?")[0];
  const isAllowed = ALLOWED_RETURN_PATHS.some(
    (allowed) => pathname === allowed || pathname.startsWith("/app/")
  );
  if (!isAllowed) return "/app";

  // Allow safe query strings on /app only
  return trimmed;
}
