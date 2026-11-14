import { CalendarConnection, User } from "@prisma/client";

export function toSafeUserDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    tier: user.tier,
    transportModes: user.transportModes,
    homeAddress: user.homeAddress,
    homeLat: user.homeLat,
    homeLng: user.homeLng,
    workAddress: user.workAddress,
    workLat: user.workLat,
    workLng: user.workLng,
    tempBaseAddress: user.tempBaseAddress,
    tempBaseLat: user.tempBaseLat,
    tempBaseLng: user.tempBaseLng,
    currentCity: user.currentCity,
    currentTimezone: user.currentTimezone,
    homeCity: user.homeCity,
    homeTimezone: user.homeTimezone,
    delayThresholdMin: user.delayThresholdMin,
    quietHoursStart: user.quietHoursStart,
    quietHoursEnd: user.quietHoursEnd,
    preferredNavApp: user.preferredNavApp,
    onboardingStep: user.onboardingStep,
    subscriptionEndsAt: user.subscriptionEndsAt ? user.subscriptionEndsAt.toISOString() : null,
  };
}

export function toSafeCalendarConnectionDto(conn: CalendarConnection) {
  // Never expose OAuth accessToken or refreshToken to client components
  return {
    id: conn.id,
    userId: conn.userId,
    provider: conn.provider,
    accountEmail: conn.accountEmail,
    status: conn.status,
    importAllDay: conn.importAllDay,
    lastSyncedAt: conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null,
  };
}
