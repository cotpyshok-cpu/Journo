import { cookies } from "next/headers";
import { prisma } from "./db";
import { ensureDemoUserSeeded } from "./seed";

export const SESSION_COOKIE_NAME = "journo_uid";

export async function getActiveUserId(): Promise<string> {
  const cookieStore = await cookies();
  const cookieUid = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (cookieUid) {
    const found = await prisma.user.findUnique({
      where: { id: cookieUid },
      select: { id: true },
    });
    if (found) return found.id;
  }

  return ensureDemoUserSeeded();
}

export async function getActiveUser() {
  const userId = await getActiveUserId();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });
  return user;
}
