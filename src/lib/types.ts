export type UserTier = "FREE" | "PRO" | "DEV";
export type TransportPref = "BOTH" | "WALK" | "TRANSIT" | "CAR";
export type TravelMode = "WALK" | "TRANSIT" | "CAR" | "TAXI" | "CARPOOL";
export type PriceSource = "PRICE_INTEL" | "GOOGLE_PLACES" | "TICKETMASTER" | "YELP" | "CUSTOM";
export type NavApp = "GOOGLE" | "APPLE" | "WAZE";
export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
export type TaskStatus = "DRAFT" | "PLANNED" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "CONFLICT";
export type TaskSource = "TASK" | "INTERNAL_CALENDAR" | "GOOGLE_CALENDAR" | "APPLE_ICS" | "SERIES";
export type DayState = "EMPTY" | "DRAFT" | "ACTIVE" | "COMPLETED";
export type MapProvider = "GOOGLE" | "HERE" | "OSRM" | "CACHE";

export type ScreenId =
  | "S03"
  | "S04"
  | "S05"
  | "S06"
  | "S07"
  | "S08"
  | "S09"
  | "S10"
  | "S11"
  | "S12"
  | "S13"
  | "S14"
  | "S15"
  | "S16"
  | "S17"
  | "S18"
  | "S19"
  | "S20"
  | "S21"
  | "S22";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  tier: UserTier;
  transportModes: TransportPref;
  homeAddress: string;
  homeLat: number;
  homeLng: number;
  workAddress: string | null;
  workLat: number | null;
  workLng: number | null;
  tempBaseAddress: string | null;
  tempBaseLat: number | null;
  tempBaseLng: number | null;
  currentCity: string;
  currentTimezone: string;
  homeCity: string;
  homeTimezone: string;
  delayThresholdMin: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  preferredNavApp: NavApp;
  onboardingStep: number;
  subscriptionEndsAt: string | null;
}

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  locationName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  date: string;
  windowStart: string | null;
  windowEnd: string | null;
  durationMin: number;
  priority: TaskPriority;
  isFlexible: boolean;
  status: TaskStatus;
  source: TaskSource;
  externalId: string | null;
  seriesId: string | null;
  seriesOccurrenceIndex: number | null;
  seriesTotalCount: number | null;
  city: string;
  timezone: string;
  plannedOrder: number | null;
  departureTime: string | null;
  eta: string | null;
  bufferMin: number | null;
  legMode: TravelMode | null;
  legDurationWalkMin: number | null;
  legDurationTransitMin: number | null;
  legDistanceKm: number | null;
  legModeChosenByUser: boolean;
  exceedsFreeLimit: boolean;
  startedAt: string | null;
  extendedMin: number;
  deletedInCalendar: boolean;
  partySize?: number;
  estimatedCostPerPerson?: number;
  estimatedVenueTotal?: number;
  priceSource?: PriceSource;
  priceSourceLabel?: string;
  actualVenueSpend?: number | null;
  actualTransportSpend?: number | null;
  parkingCost?: number;
}

export interface TaskSeriesItem {
  id: string;
  userId: string;
  title: string;
  locationName: string;
  address: string;
  lat: number;
  lng: number;
  mode: "SPECIFIC_DAYS" | "N_PER_WEEK";
  daysOfWeek: string | null;
  timesPerWeek: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  durationMin: number;
  isFlexible: boolean;
  endType: "UNTIL_DATE" | "N_OCCURRENCES" | "THREE_MONTHS" | "ENDLESS";
  endDate: string;
  totalCount: number;
  completedCount: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  city: string;
  timezone: string;
}

export interface CalendarConnectionItem {
  id: string;
  userId: string;
  provider: "INTERNAL" | "GOOGLE" | "APPLE_ICS";
  accountEmail: string | null;
  status: "CONNECTED" | "NEEDS_RECONNECT" | "DISCONNECTED";
  importAllDay: boolean;
  lastSyncedAt: string | null;
}

export interface CalendarEventItem {
  id: string;
  userId: string;
  calendarId: string;
  provider: "INTERNAL" | "GOOGLE" | "APPLE_ICS";
  externalId: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  locationName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  isHard: boolean;
  recurrenceRule: string | null;
  reminderMin: number;
  linkedTaskId: string | null;
}

export interface PlanVersionItem {
  id: string;
  dayPlanId: string;
  version: number;
  summary: string;
  deltaMinutes: number;
  deltaKm: number;
  shiftedTasksJson: string;
  snapshotJson: string;
  createdAt: string;
}

export interface DayPlanItem {
  id: string;
  userId: string;
  date: string;
  state: DayState;
  currentVersion: number;
  totalKm: number;
  totalTravelMin: number;
  naiveTravelMin: number;
  savedMin: number;
  providerUsed: MapProvider;
  isEstimateWithoutTraffic: boolean;
  lastUpdatedAt: string;
  versions: PlanVersionItem[];
}

export interface ConflictResolutionOption {
  id: "REMOVE_FLEXIBLE" | "SHIFT_WINDOW" | "ENABLE_BOTH_MODES";
  label: string;
  description: string;
  targetTaskId?: string;
}

export interface RouteConflict {
  reason: string;
  affectedTaskIds: string[];
  affectedTitles: string[];
  options: ConflictResolutionOption[];
}

export interface LegEstimate {
  fromTaskId: string | "START";
  toTaskId: string;
  walkMin: number;
  transitMin: number;
  carMin?: number;
  taxiMin?: number;
  distanceKm: number;
  chosenMode: TravelMode;
  fastestMode: TravelMode | null; // null if < 3 min difference
  cheapestPaidMode?: TravelMode;
  isEqualSpeed: boolean;
  chosenByUser: boolean;
  secondModeNotCalculated: boolean;
  suggestSecondMode: boolean;
  noTransitNote?: string;
  lateWarning?: string;
  walkCost?: number;
  transitCost?: number;
  carCost?: number;
  taxiCost?: number;
  transitNote?: string;
  carNote?: string;
}

export interface TransportCostProfile {
  hasPersonalCar: boolean;
  vehicleType: "GAS" | "EV";
  fuelEfficiencyMpg: number;
  gasPricePerGal: number;
  evKwhPer100Km: number;
  elecPricePerKwh: number;
  defaultParkingCost: number;
  transitBaseFare: number;
  transitDailyCapPerPerson: number;
  hasUnlimitedTransitPass: boolean;
}

export interface PriceIntelEntry {
  venueKey: string;
  venueName: string;
  category: string;
  benchmarkPerPerson: number;
  benchmarkSource: "GOOGLE_PLACES" | "TICKETMASTER" | "YELP";
  visitCount: number;
  avgSpendPerPerson: number;
  lastSpendPerPerson: number | null;
  history: number[];
  updatedAt: string;
}

export interface TaskBudgetRecord {
  taskId: string;
  partySize: number;
  customPerPerson?: number | null;
  parkingCostOverride?: number | null;
  friendRideNote?: string | null;
  friendRideCost?: number | null;
  actualVenueSpend?: number | null;
  actualTransportSpend?: number | null;
  loggedAt?: string | null;
}

export interface DailyBudgetSummary {
  plannedTransportTotal: number;
  plannedVenueTotal: number;
  plannedGrandTotal: number;
  actualTransportTotal: number;
  actualVenueTotal: number;
  actualGrandTotal: number;
  loggedStopsCount: number;
  totalStopsCount: number;
  varianceAmount: number;
  transitDailyCapReached: boolean;
  carContinuityActive?: boolean;
  returnHomeCarKm?: number;
  returnHomeCarMin?: number;
  returnHomeCarCost?: number;
}

export interface SystemSimulationFlags {
  offline: boolean;
  quotaExhausted: boolean;
  partialQuota: boolean;
  geolocationDenied: boolean;
  pushDenied: boolean;
  serverError: boolean;
  sessionExpired: boolean;
  calendarChanged: boolean;
}

export interface InAppNotification {
  id: string;
  type: "LEAVE_NOW" | "DELAY_RISK" | "CALENDAR_CHANGED" | "EVENING_REVIEW" | "CITY_URGENT" | "SERIES_ENDING" | "INFO";
  title: string;
  body: string;
  timestamp: string;
  actionLabel?: string;
  targetScreen?: ScreenId;
}
