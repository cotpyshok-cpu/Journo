"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Compass,
  Globe,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import {
  CalendarConnectionItem,
  CalendarEventItem,
  ConflictResolutionOption,
  DayPlanItem,
  InAppNotification,
  LegEstimate,
  PriceIntelEntry,
  RouteConflict,
  ScreenId,
  ShiftedTaskNotice,
  SystemSimulationFlags,
  TaskBudgetRecord,
  TaskItem,
  TaskPriority,
  TaskSeriesItem,
  TransportCostProfile,
  TravelMode,
  UserProfile,
  UserTier,
} from "@/lib/types";
import {
  DEFAULT_TRANSPORT_PROFILE,
  enrichDayBudgetAndTasks,
  getInitialPriceIntel,
  loadLocalPriceIntel,
  loadLocalTaskBudgets,
  loadLocalTransportProfile,
  recordPersonalVisitSpend,
  saveLocalPriceIntel,
  saveLocalTaskBudgets,
  saveLocalTransportProfile,
} from "@/lib/budget-intelligence";
import { formatMinutesToTime, getDateInTimezone, parseTimeToMinutes } from "@/lib/utils";
import { JournoLogo } from "@/components/brand/JournoLogo";
import { DynamicJournoMap } from "@/components/map/DynamicJournoMap";
import { Button, Card } from "@/components/ui/primitives";
import { JuryControlBar } from "@/components/app/JuryControlBar";
import { OnboardingModal } from "@/components/app/OnboardingModal";
import { TaskFormModal } from "@/components/app/TaskFormModal";
import { MorningPlanView } from "@/components/app/MorningPlanView";
import { LiveDayView } from "@/components/app/LiveDayView";
import {
  QuickAddModal,
  QuickAddPlaceCandidate,
} from "@/components/app/QuickAddModal";
import {
  PlanComparisonModal,
  PlanComparisonPreview,
} from "@/components/app/PlanComparisonModal";
import { EveningReviewView } from "@/components/app/EveningReviewView";
import { PaywallModal } from "@/components/app/PaywallModal";
import { CitySwitchModal } from "@/components/app/CitySwitchModal";
import {
  CalendarsAndSeriesView,
  CalendarsSubTab,
} from "@/components/app/CalendarsAndSeriesView";
import { SettingsView } from "@/components/app/SettingsView";

type PrimaryTab = "plan" | "live" | "review" | "calendars" | "settings";

interface BootstrapResponse {
  date: string;
  todayDate: string;
  isPastDate: boolean;
  freeLimitCount: number;
  freeLimitMax: number;
  user: UserProfile;
  tasks: TaskItem[];
  weekTasks?: TaskItem[];
  series: TaskSeriesItem[];
  calendarConnections: CalendarConnectionItem[];
  calendarEvents: CalendarEventItem[];
  dayPlan: DayPlanItem | null;
  recentDayPlans: {
    date: string;
    savedMin: number;
    totalKm: number;
    totalTravelMin: number;
    naiveTravelMin: number;
  }[];
}

const DEFAULT_SIM_FLAGS: SystemSimulationFlags = {
  offline: false,
  quotaExhausted: false,
  partialQuota: false,
  geolocationDenied: false,
  pushDenied: false,
  serverError: false,
  sessionExpired: false,
  calendarChanged: false,
};

function deriveLegsFromTasks(tasks: TaskItem[]): LegEstimate[] {
  const routed = tasks
    .filter((t) => t.lat != null && t.lng != null && t.plannedOrder != null && !t.exceedsFreeLimit)
    .slice()
    .sort((a, b) => (a.plannedOrder ?? 99) - (b.plannedOrder ?? 99));

  return routed.map((task, idx) => {
    const walkMin = task.legDurationWalkMin ?? 14;
    const transitMin = task.legDurationTransitMin ?? 9;
    const diff = Math.abs(walkMin - transitMin);
    const isEqualSpeed = diff < 3;
    const fastestMode: TravelMode | null = isEqualSpeed
      ? null
      : walkMin <= transitMin
      ? "WALK"
      : "TRANSIT";

    return {
      fromTaskId: idx === 0 ? "START" : routed[idx - 1].id,
      toTaskId: task.id,
      walkMin,
      transitMin,
      distanceKm: task.legDistanceKm ?? 2.4,
      chosenMode: task.legMode ?? (fastestMode ?? "WALK"),
      fastestMode,
      isEqualSpeed,
      chosenByUser: task.legModeChosenByUser,
      secondModeNotCalculated: false,
      suggestSecondMode: false,
    };
  });
}

export function JournoApp() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<PrimaryTab>("plan");
  const [calendarSubTab, setCalendarSubTab] = useState<CalendarsSubTab>("grid");
  const [currentScreen, setCurrentScreen] = useState<ScreenId>("S07");
  const [simFlags, setSimFlags] = useState<SystemSimulationFlags>(DEFAULT_SIM_FLAGS);

  const [legs, setLegs] = useState<LegEstimate[]>([]);
  const [conflict, setConflict] = useState<RouteConflict | null>(null);
  const [planAdjustments, setPlanAdjustments] = useState<ShiftedTaskNotice[]>([]);
  const [autoOptimizeNotes, setAutoOptimizeNotes] = useState<string[]>([]);
  const [needsCriticalDecision, setNeedsCriticalDecision] = useState(false);
  const [building, setBuilding] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Budget, Multi-Modal Cost & Self-Learning Price Intelligence State (local-first)
  const [priceIntel, setPriceIntel] = useState<PriceIntelEntry[]>([]);
  const [taskBudgets, setTaskBudgets] = useState<Record<string, TaskBudgetRecord>>({});
  const [transportProfile, setTransportProfile] =
    useState<TransportCostProfile>(DEFAULT_TRANSPORT_PROFILE);

  useEffect(() => {
    setPriceIntel(loadLocalPriceIntel());
    setTaskBudgets(loadLocalTaskBudgets());
    setTransportProfile(loadLocalTransportProfile());
  }, []);

  const { enrichedTasks, legBreakdowns, summary: budgetSummary } = useMemo(
    () =>
      enrichDayBudgetAndTasks({
        tasks: data?.tasks ?? [],
        taskBudgets,
        priceIntel,
        transportProfile,
      }),
    [data?.tasks, taskBudgets, priceIntel, transportProfile]
  );

  const handleUpdateTaskBudget = useCallback(
    (taskId: string, patch: Partial<TaskBudgetRecord>) => {
      setTaskBudgets((prev) => {
        const existing = prev[taskId] ?? { taskId, partySize: 1 };
        const next: Record<string, TaskBudgetRecord> = {
          ...prev,
          [taskId]: { ...existing, ...patch, taskId },
        };
        saveLocalTaskBudgets(next);
        return next;
      });
    },
    []
  );

  const handleUpdateTransportProfile = useCallback((next: TransportCostProfile) => {
    setTransportProfile(next);
    saveLocalTransportProfile(next);
  }, []);

  // Modals & Deep Overlays
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(3);
  const autoOnboardingCheckedRef = useRef(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddText, setQuickAddText] = useState("Pharmacy, 10 min, flexible");
  const [planPreview, setPlanPreview] = useState<PlanComparisonPreview | null>(null);
  const [pendingQuickAddTaskId, setPendingQuickAddTaskId] = useState<string | null>(null);
  const [acceptingPreview, setAcceptingPreview] = useState(false);

  const [paywallState, setPaywallState] = useState<{ open: boolean; reason: string }>({
    open: false,
    reason: "",
  });
  const [showCitySwitch, setShowCitySwitch] = useState(false);

  // Toast & In-App Push Notifications
  const [toasts, setToasts] = useState<InAppNotification[]>([]);

  const pushToast = useCallback(
    (
      body: string,
      title = "Journo",
      type: InAppNotification["type"] = "INFO",
      actionLabel?: string,
      targetScreen?: ScreenId
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [
        {
          id,
          type,
          title,
          body,
          timestamp: new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
          actionLabel,
          targetScreen,
        },
        ...prev.slice(0, 2),
      ]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, 6500);
    },
    []
  );

  const loadBootstrap = useCallback(
    async (dateOverride?: string) => {
      const target = dateOverride ?? selectedDate;
      const url = target ? `/api/bootstrap?date=${encodeURIComponent(target)}` : "/api/bootstrap";
      setBootError(null);
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as BootstrapResponse;
        setData(json);
        if (!selectedDate) setSelectedDate(json.date);
        setLegs((prev) => (prev.length > 0 ? prev : deriveLegsFromTasks(json.tasks)));
      } catch (err) {
        setBootError(err instanceof Error ? err.message : "Failed to load Journo workspace.");
      } finally {
        setLoading(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  // Global Cmd/Ctrl+K shortcut for Quick Add (S12)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowQuickAdd(true);
        setCurrentScreen("S12");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigateScreen = useCallback(
    (screen: ScreenId) => {
      setCurrentScreen(screen);
      if (screen === "S03" || screen === "S04" || screen === "S05" || screen === "S06") {
        const num = Number(screen.slice(1));
        setOnboardingStep(num);
        setShowOnboarding(true);
        return;
      }
      if (screen === "S07" || screen === "S09") {
        setActiveTab("plan");
        return;
      }
      if (screen === "S08") {
        setEditingTask(null);
        setShowTaskModal(true);
        return;
      }
      if (screen === "S10") {
        setActiveTab("plan");
        return;
      }
      if (screen === "S11") {
        setActiveTab("live");
        return;
      }
      if (screen === "S12") {
        setShowQuickAdd(true);
        return;
      }
      if (screen === "S13") {
        if (planPreview) return;
        setActiveTab("plan");
        pushToast("Use Quick Add on Free tier or rebuild a changed day to preview route diffs.");
        return;
      }
      if (screen === "S14") {
        setActiveTab("review");
        return;
      }
      if (screen === "S15") {
        setPaywallState({
          open: true,
          reason: "Unlock unlimited stops, Google Calendar sync, and automatic rerouting.",
        });
        return;
      }
      if (screen === "S16") {
        setActiveTab("settings");
        return;
      }
      if (screen === "S17") {
        setShowCitySwitch(true);
        return;
      }
      if (screen === "S18" || screen === "S22") {
        setCalendarSubTab("connections");
        setActiveTab("calendars");
        return;
      }
      if (screen === "S21") {
        setCalendarSubTab("series");
        setActiveTab("calendars");
        return;
      }
      if (screen === "S19") {
        setCalendarSubTab("people");
        setActiveTab("calendars");
        return;
      }
      if (screen === "S20") {
        setActiveTab("settings");
        return;
      }
    },
    [planPreview, pushToast]
  );

  // React to URL query params & open Onboarding automatically on first visit
  useEffect(() => {
    const viewParam = searchParams.get("view") as ScreenId | null;
    if (viewParam) {
      navigateScreen(viewParam);
    }
    if (searchParams.get("onboarding") === "1") {
      setOnboardingStep(3);
      setShowOnboarding(true);
    }
    const oauth = searchParams.get("oauth");
    if (!viewParam && !oauth && !autoOnboardingCheckedRef.current) {
      autoOnboardingCheckedRef.current = true;
      const skip = searchParams.get("skipOnboarding") === "1";
      const alreadyDone =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem("journo_onboarding_done") === "1";
      if (!skip && !alreadyDone) {
        setOnboardingStep(3);
        setShowOnboarding(true);
      }
    }
    if (oauth === "connected" || oauth === "google_connected") {
      const synced = searchParams.get("synced");
      pushToast(
        synced
          ? `Google Calendar connected — synced ${synced} event(s).`
          : "Google Calendar connected and synced.",
        "Google Sync",
        "INFO"
      );
      void loadBootstrap();
    } else if (oauth === "google_login") {
      pushToast("Signed in with Google.", "Welcome to Journo", "INFO");
    } else if (
      oauth === "unconfigured" ||
      oauth === "error" ||
      oauth === "token_error" ||
      oauth === "profile_error" ||
      oauth === "denied" ||
      oauth === "invalid_state"
    ) {
      pushToast(
        oauth === "unconfigured"
          ? "Google sign-in isn't configured yet — you can use sample meetings instead."
          : `Could not complete Google sign-in (${oauth}). Please try again.`,
        "Calendar Sign-In",
        "DELAY_RISK"
      );
    }
    const oauthErr = searchParams.get("oauth_error");
    if (oauthErr) {
      pushToast(`Google sign-in notice: ${oauthErr}`, "Calendar Sign-In", "DELAY_RISK");
    }
  }, [searchParams, navigateScreen, pushToast, loadBootstrap]);

  const triggerWebPush = useCallback(
    async (title: string, body: string, type: InAppNotification["type"]) => {
      try {
        await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, type }),
        });
      } catch {
        // Non-blocking fallback
      }

      pushToast(body, title, type, type === "DELAY_RISK" ? "Open Live Day" : undefined, "S11");

      if (
        !simFlags.pushDenied &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator
      ) {
        try {
          let perm = Notification.permission;
          if (perm === "default") {
            perm = await Notification.requestPermission();
          }
          if (perm === "granted") {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(title, {
              body,
              icon: "/icon.svg",
              badge: "/icon.svg",
              tag: "journo-live-alert",
            });
          }
        } catch {
          // Browser suppressed notification permission cleanly -> in-app toast already shown
        }
      }
    },
    [pushToast, simFlags.pushDenied]
  );

  // Handlers
  const handleSaveProfile = async (patch: Partial<UserProfile>) => {
    if (patch.transportModes === "CAR" && !transportProfile.hasPersonalCar) {
      handleUpdateTransportProfile({ ...transportProfile, hasPersonalCar: true });
    }
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) {
      pushToast(json.error?.message || "Failed to update profile.");
      return;
    }
    await loadBootstrap();
    pushToast("Preferences saved.");
  };

  const handleTierChange = async (tier: UserTier) => {
    await handleSaveProfile({ tier });
    pushToast(`Switched active tier to ${tier} mode.`);
  };

  const handleBuildPlan = async (extra?: {
    trafficDelayMultiplier?: number;
    summary?: string;
  }) => {
    if (!data) return;
    if (simFlags.offline) {
      pushToast("Offline mode active — cannot recalculate route until network returns.", "Offline");
      return;
    }
    setBuilding(true);
    try {
      const res = await fetch("/api/route/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          mode: "build",
          simulateQuotaExhausted: simFlags.quotaExhausted,
          simulatePartialQuota: simFlags.partialQuota,
          trafficDelayMultiplier: extra?.trafficDelayMultiplier,
          summary: extra?.summary,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error?.message || "Route build failed.");
        return;
      }

      if (!json.ok && json.conflict) {
        setConflict(json.conflict);
        setPlanAdjustments([]);
        setAutoOptimizeNotes([]);
        setNeedsCriticalDecision(false);
        setCurrentScreen("S10");
        await loadBootstrap(data.date);
        pushToast("Schedule conflict detected — choose a recovery option.", "Conflict", "DELAY_RISK");
        return;
      }

      setConflict(null);
      setNeedsCriticalDecision(false);
      setPlanAdjustments(json.result?.shiftedTasks ?? []);
      if (json.result?.legs) setLegs(json.result.legs);
      setCurrentScreen("S09");
      await loadBootstrap(data.date);
      const shiftedCount = (json.result?.shiftedTasks ?? []).length;
      pushToast(
        shiftedCount > 0
          ? `Route rebuilt — ${shiftedCount} task${shiftedCount > 1 ? "s" : ""} shifted around busy commitments.`
          : json.result?.isEstimateWithoutTraffic
            ? "Route built from local distance cache."
            : `Route optimized! Saved ${json.result?.savedMin ?? 0} min.`
      );
    } finally {
      setBuilding(false);
    }
  };

  const handleAutoOptimize = async () => {
    if (!data) return;
    setBuilding(true);
    try {
      const res = await fetch("/api/route/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          mode: "auto_optimize",
          simulateQuotaExhausted: simFlags.quotaExhausted,
          simulatePartialQuota: simFlags.partialQuota,
          summary: "One-click auto-optimization",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        pushToast(json.error?.message || "Auto-optimization failed.");
        return;
      }

      const notes: string[] = Array.isArray(json.autoActions) ? json.autoActions : [];
      if (!json.ok && json.conflict) {
        setConflict(json.conflict);
        setPlanAdjustments([]);
        setAutoOptimizeNotes(notes);
        setNeedsCriticalDecision(Boolean(json.needsCriticalDecision));
        setCurrentScreen("S10");
        await loadBootstrap(data.date);
        pushToast(
          "Auto-optimized solvable steps — 1 critical overlap needs your decision.",
          "Critical Choice Needed",
          "DELAY_RISK"
        );
        return;
      }

      setConflict(null);
      setPlanAdjustments([]);
      setNeedsCriticalDecision(false);
      setAutoOptimizeNotes(notes);
      if (json.result?.legs) setLegs(json.result.legs);
      setCurrentScreen("S09");
      await loadBootstrap(data.date);
      pushToast(
        `Plan auto-optimized! Saved ${json.result?.savedMin ?? 0} min of travel.`
      );
    } finally {
      setBuilding(false);
    }
  };

  const handleResolveConflict = async (
    optionId: ConflictResolutionOption["id"],
    targetTaskId?: string
  ) => {
    if (!data) return;
    setBuilding(true);
    try {
      const res = await fetch("/api/route/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          mode: "resolve_conflict",
          conflictAction: { optionId, targetTaskId },
          simulateQuotaExhausted: simFlags.quotaExhausted,
          simulatePartialQuota: simFlags.partialQuota,
        }),
      });
      const json = await res.json();
      if (json.ok && json.result) {
        setConflict(null);
        setNeedsCriticalDecision(false);
        setPlanAdjustments(json.result.shiftedTasks ?? []);
        setLegs(json.result.legs ?? []);
        await loadBootstrap(data.date);
        pushToast(`Conflict resolved! Saved ${json.result.savedMin ?? 0} min.`);
      } else if (json.conflict) {
        setConflict(json.conflict);
        setPlanAdjustments([]);
        await loadBootstrap(data.date);
      }
    } finally {
      setBuilding(false);
    }
  };

  const handleRejectPlanShift = async (adj: ShiftedTaskNotice) => {
    if (!data) return;
    const target = data.tasks.find((t) => t.id === adj.taskId);
    if (!target) return;

    const restoredStart = adj.oldEta ?? target.windowStart;
    const durMin = target.durationMin + (target.extendedMin ?? 0);
    const startMin = parseTimeToMinutes(restoredStart);
    const existingEndMin = parseTimeToMinutes(target.windowEnd);
    const restoredEnd =
      startMin !== null
        ? target.windowStart === restoredStart && existingEndMin !== null && existingEndMin > startMin
          ? target.windowEnd
          : formatMinutesToTime(Math.min(23 * 60 + 55, startMin + Math.max(15, durMin)))
        : target.windowEnd;

    setPlanAdjustments((prev) => prev.filter((item) => item.taskId !== adj.taskId));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: target.id,
        isFlexible: false,
        windowStart: restoredStart,
        windowEnd: restoredEnd,
      }),
    });
    await handleBuildPlan({ summary: `Declined shift for ${target.title}` });
  };

  const handleTestConflict = async () => {
    if (!data) return;
    // Inject two conflicting Hard Anchors to demonstrate S10 conflict recovery cleanly
    const res1 = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Board Review (Conflict Test)",
        locationName: "Astana Hub",
        address: "Mangilik El C4.6, Astana",
        lat: 51.0897,
        lng: 71.4167,
        date: data.date,
        windowStart: "10:00",
        windowEnd: "10:25",
        durationMin: 25,
        priority: "HIGH",
        isFlexible: false,
        allowOverflow: true,
      }),
    });
    if (res1.ok) {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Urgent Courier Pickup (Overlap)",
          locationName: "Khan Shatyr Mall",
          address: "Turan Ave 37, Astana",
          lat: 51.1325,
          lng: 71.4037,
          date: data.date,
          windowStart: "10:15",
          windowEnd: "10:35",
          durationMin: 20,
          priority: "MEDIUM",
          isFlexible: true,
          allowOverflow: true,
        }),
      });
    }
    await handleBuildPlan();
  };

  const handleRecordActualCheck = useCallback(
    ({
      task,
      actualVenueSpend,
      actualTransportSpend,
      partySize,
    }: {
      task: TaskItem;
      actualVenueSpend: number | null;
      actualTransportSpend: number | null;
      partySize: number;
    }) => {
      handleUpdateTaskBudget(task.id, {
        partySize,
        actualVenueSpend,
        actualTransportSpend,
        loggedAt: new Date().toISOString(),
      });

      if (actualVenueSpend != null && actualVenueSpend >= 0) {
        setPriceIntel((prev) => {
          const updated = recordPersonalVisitSpend(prev, {
            locationName: task.locationName,
            title: task.title,
            actualTotalSpend: actualVenueSpend,
            partySize,
          });
          saveLocalPriceIntel(updated);
          return updated;
        });
      }
      pushToast(
        `Saved actual check ($${((actualVenueSpend ?? 0) + (actualTransportSpend ?? 0)).toFixed(2)}) for "${task.title}" — Price Intelligence updated.`
      );
    },
    [handleUpdateTaskBudget, pushToast]
  );

  const handleResetPriceIntel = useCallback(() => {
    const initial = getInitialPriceIntel();
    setPriceIntel(initial);
    saveLocalPriceIntel(initial);
    pushToast("Personal Price Intelligence reset to baseline demo visits.");
  }, [pushToast]);

  const handleSubmitTask = async (payload: {
    id?: string;
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
    partySize?: number;
    customPerPerson?: number | null;
    repeatConfig?: {
      enabled: boolean;
      mode: "SPECIFIC_DAYS" | "N_PER_WEEK";
      daysOfWeek: string;
      timesPerWeek: number;
      endType: "UNTIL_DATE" | "N_OCCURRENCES" | "THREE_MONTHS" | "ENDLESS";
      endDate: string;
      totalCount: number;
    };
  }) => {
    const { partySize, customPerPerson, ...apiPayload } = payload;
    if (payload.id) {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...apiPayload }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || "Could not update task");
      }
      if (partySize != null || customPerPerson !== undefined) {
        handleUpdateTaskBudget(payload.id, {
          partySize: partySize ?? 1,
          customPerPerson: customPerPerson ?? null,
        });
      }
      await loadBootstrap(data?.date);
      const isLiveDay = data?.dayPlan?.state === "ACTIVE" || activeTab === "live";
      const hasPlannedRoute = Boolean(data?.tasks.some((t) => t.plannedOrder != null));
      if (payload.date === data?.date && (isLiveDay || hasPlannedRoute)) {
        await handleBuildPlan({ summary: `Recalculated route after updating "${payload.title}"` });
      }
      pushToast(`Updated "${payload.title}".`);
      return;
    }

    if (payload.repeatConfig?.enabled && payload.lat != null && payload.lng != null) {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          locationName: payload.locationName || payload.title,
          address: payload.address || "Astana",
          lat: payload.lat,
          lng: payload.lng,
          mode: payload.repeatConfig.mode,
          daysOfWeek: payload.repeatConfig.daysOfWeek,
          timesPerWeek: payload.repeatConfig.timesPerWeek,
          windowStart: payload.windowStart,
          windowEnd: payload.windowEnd,
          durationMin: payload.durationMin,
          isFlexible: payload.isFlexible,
          endType: payload.repeatConfig.endType,
          endDate: payload.repeatConfig.endDate,
          totalCount: payload.repeatConfig.totalCount,
          createTodayOccurrence: true,
          date: payload.date,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error?.message || "Could not create recurring series");
      }
      await loadBootstrap(data?.date);
      const isLiveDay = data?.dayPlan?.state === "ACTIVE" || activeTab === "live";
      const hasPlannedRoute = Boolean(data?.tasks.some((t) => t.plannedOrder != null));
      if (payload.date === data?.date && (isLiveDay || hasPlannedRoute)) {
        await handleBuildPlan({ summary: `Recalculated route for "${payload.title}"` });
      }
      pushToast(`Recurring series "${payload.title}" created!`);
      return;
    }

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiPayload),
    });
    const json = await res.json();
    if (res.status === 402 && json.error?.code === "FREE_LIMIT_REACHED") {
      setShowTaskModal(false);
      setPaywallState({
        open: true,
        reason: json.error.message || "Free limit of 5 tasks per day reached.",
      });
      return;
    }
    if (!res.ok) {
      throw new Error(json.error?.message || "Could not create task");
    }
    if (json.task?.id) {
      handleUpdateTaskBudget(json.task.id, {
        partySize: partySize ?? 1,
        customPerPerson: customPerPerson ?? null,
      });
    }
    await loadBootstrap(data?.date);
    const isLiveDay = data?.dayPlan?.state === "ACTIVE" || activeTab === "live";
    const hasPlannedRoute = Boolean(data?.tasks.some((t) => t.plannedOrder != null));
    if (payload.date === data?.date && (isLiveDay || hasPlannedRoute)) {
      await handleBuildPlan({ summary: `Recalculated route including "${payload.title}"` });
    }
    pushToast(`Added "${payload.title}".`);
  };

  const handleCommitQuickAdd = async (
    text: string,
    selectedPlace: QuickAddPlaceCandidate | null
  ) => {
    if (!data) return;
    const res = await fetch("/api/tasks/quick-add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        date: data.date,
        action: "commit",
        selectedPlace: selectedPlace
          ? {
              name: selectedPlace.name,
              address: selectedPlace.address,
              lat: selectedPlace.lat,
              lng: selectedPlace.lng,
            }
          : undefined,
      }),
    });
    const json = await res.json();

    if (res.status === 402 && json.error?.code === "FREE_LIMIT_REACHED") {
      // E3.1: Preserve quickAddText while user checks Paywall (S15)
      setShowQuickAdd(false);
      setPaywallState({
        open: true,
        reason: "5/5 Free daily task limit reached. Your Quick Add text is preserved safely.",
      });
      return;
    }
    if (!res.ok) {
      throw new Error(json.error?.message || "Could not add stop");
    }

    if (json.task?.id) {
      handleUpdateTaskBudget(json.task.id, {
        partySize: json.parsed?.partySize ?? 1,
      });
    }

    setShowQuickAdd(false);
    setQuickAddText("Pharmacy, 10 min, flexible");

    const isLiveDay = data.dayPlan?.state === "ACTIVE" || activeTab === "live";
    if (json.autoRecalculate || isLiveDay) {
      await handleBuildPlan({ summary: `Quick Add auto-recalc: ${json.task?.title}` });
      return;
    }

    // Free tier opens S13 Before vs After Plan Comparison modal before committing schedule
    const previewRes = await fetch("/api/route/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: data.date, mode: "preview" }),
    });
    const previewJson = await previewRes.json();
    if (previewJson.ok && previewJson.result) {
      setPendingQuickAddTaskId(json.task?.id ?? null);
      setPlanPreview({
        title: `Inserting "${json.task?.title ?? "New Stop"}" along your route`,
        deltaMinutes: previewJson.result.deltaMinutes ?? 4,
        deltaKm: previewJson.result.deltaKm ?? 0.6,
        newTotalTravelMin: previewJson.result.totalTravelMin ?? 42,
        newTotalKm: previewJson.result.totalKm ?? 8.5,
        shiftedTasks: previewJson.result.shiftedTasks ?? [],
      });
    } else {
      await loadBootstrap(data.date);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await fetch(`/api/tasks?id=${encodeURIComponent(taskId)}`, { method: "DELETE" });
    await loadBootstrap(data?.date);
    const isLiveDay = data?.dayPlan?.state === "ACTIVE" || activeTab === "live";
    const remainingRouted = (data?.tasks ?? []).filter(
      (t) => t.id !== taskId && t.lat != null && t.plannedOrder != null
    );
    if (isLiveDay || remainingRouted.length > 0) {
      await handleBuildPlan({ summary: "Recalculated savings after removing task" });
    }
    pushToast("Task deleted.");
  };

  const handleMoveTaskOrder = async (taskId: string, direction: "UP" | "DOWN") => {
    if (!data) return;
    const routed = data.tasks
      .filter((t) => t.lat != null && !t.exceedsFreeLimit)
      .slice()
      .sort((a, b) => (a.plannedOrder ?? 99) - (b.plannedOrder ?? 99));
    const idx = routed.findIndex((t) => t.id === taskId);
    const swapIdx = direction === "UP" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= routed.length) return;

    const current = routed[idx];
    const partner = routed[swapIdx];

    await Promise.all([
      fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, plannedOrder: partner.plannedOrder ?? swapIdx + 1 }),
      }),
      fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: partner.id, plannedOrder: current.plannedOrder ?? idx + 1 }),
      }),
    ]);
    await loadBootstrap(data.date);
  };

  const handleSelectLegMode = async (
    taskId: string,
    mode: TravelMode | "RESTORE_FASTEST"
  ) => {
    if (mode === "RESTORE_FASTEST") {
      const leg = legs.find((l) => l.toTaskId === taskId);
      const fastest = leg?.fastestMode ?? "TRANSIT";
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, legMode: fastest, legModeChosenByUser: false }),
      });
    } else {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, legMode: mode, legModeChosenByUser: true }),
      });
    }
    await handleBuildPlan({ summary: "Recalculated leg transport mode preference" });
  };

  // Loading & Error / S20 System States
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EF] p-6 text-center">
        <JournoLogo size="lg" />
        <p className="mt-4 text-sm font-medium text-[#5E766B]">
          Bootstrapping your Astana daily route workspace...
        </p>
      </div>
    );
  }

  if (simFlags.sessionExpired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EF] p-6 text-center">
        <Card className="max-w-md p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6EFE2] text-[#9C6B3B]">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#2F453B]">Session Expired</h1>
          <p className="mt-2 text-xs text-[#5E766B]">
            Your security token expired. Sign in again to restore calendar sync and background optimization — your drafted tasks remain stored safely.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <a
              href="/api/auth/google?intent=login&next=/app"
              className="inline-flex min-h-[44px] items-center rounded-2xl bg-[#2F453B] px-4 text-xs font-semibold text-[#F6F4EF]"
            >
              Sign in with Google
            </a>
            <Button
              variant="primary"
              onClick={() => setSimFlags((prev) => ({ ...prev, sessionExpired: false }))}
            >
              Restore Demo Session
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (bootError || simFlags.serverError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EF] p-6 text-center">
        <Card className="max-w-md p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5E6E6] text-[#B05454]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#2F453B]">
            Service Temporarily Unavailable
          </h1>
          <p className="mt-2 text-xs text-[#5E766B]">
            {bootError || "Unable to reach route service right now."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setSimFlags((prev) => ({ ...prev, serverError: false }));
                void loadBootstrap();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Retry Connection
            </Button>
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded-2xl border border-[#DFDBD0] px-4 text-xs font-semibold text-[#2F453B]"
            >
              Back to Landing
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { user } = data;
  const showMapAside = activeTab === "plan" || activeTab === "live";
  const originPoint = {
    lat: user.tempBaseLat ?? user.homeLat,
    lng: user.tempBaseLng ?? user.homeLng,
    label: user.tempBaseAddress ?? user.homeAddress,
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F6F4EF] pb-24 lg:pb-8">
      {/* Top Jury / Dev Control Bar */}
      <JuryControlBar
        tier={user.tier}
        onTierChange={handleTierChange}
        simFlags={simFlags}
        onToggleSimFlag={(key) =>
          setSimFlags((prev) => ({ ...prev, [key]: !prev[key] }))
        }
        currentScreen={currentScreen}
        onNavigateScreen={navigateScreen}
        onSimulateTrafficPush={async () => {
          await triggerWebPush(
            "Traffic +12m Alert on Mangilik El",
            "Leave 12 min earlier or recalculate to keep your Baiterek Hard Anchor on time.",
            "DELAY_RISK"
          );
          if (!simFlags.offline && user.tier !== "FREE") {
            await handleBuildPlan({
              trafficDelayMultiplier: 1.35,
              summary: "Auto-recalc from +12m Astana traffic push",
            });
          }
        }}
        onOpenOnboarding={() => {
          setOnboardingStep(3);
          setShowOnboarding(true);
        }}
        onOpenCitySwitch={() => setShowCitySwitch(true)}
        onResetDemo={async () => {
          setLoading(true);
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("journo_onboarding_done");
          }
          await fetch("/api/bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset_demo" }),
          });
          setSimFlags(DEFAULT_SIM_FLAGS);
          setConflict(null);
          await loadBootstrap();
          setOnboardingStep(3);
          setShowOnboarding(true);
          pushToast("Astana demo day reset cleanly.");
        }}
      />

      {/* Top App Header */}
      <header className="border-b border-[#DFDBD0] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="shrink-0">
              <JournoLogo size="sm" />
            </Link>
            <button
              type="button"
              onClick={() => setShowCitySwitch(true)}
              className="hidden items-center gap-1.5 rounded-full border border-[#DFDBD0] bg-[#F6F4EF] px-3 py-1 text-xs font-semibold text-[#2F453B] hover:border-[#C67D63] sm:inline-flex"
            >
              <Globe className="h-3.5 w-3.5 text-[#C67D63]" />
              <span>{user.currentCity}</span>
              <span className="text-[#5E766B]">
                ({user.currentTimezone === "Asia/Almaty" ? "UTC+5" : user.currentTimezone})
              </span>
            </button>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav
            aria-label="Primary workspace navigation"
            className="hidden items-center gap-1 rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF] p-1 lg:flex"
          >
            {(
              [
                { id: "plan", label: "Plan", icon: Compass, screen: "S07" },
                { id: "live", label: "Live Day", icon: Play, screen: "S11" },
                { id: "review", label: "Review", icon: BarChart3, screen: "S14" },
                { id: "calendars", label: "Calendars", icon: CalendarDays, screen: "S18" },
                { id: "settings", label: "Settings", icon: Settings, screen: "S16" },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setCurrentScreen(item.screen);
                  }}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[#2F453B] text-[#F6F4EF]"
                      : "text-[#5E766B] hover:text-[#2F453B]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              aria-label="Quick Add"
              onClick={() => {
                setShowQuickAdd(true);
                setCurrentScreen("S12");
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Add</span>
              <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold sm:inline">
                ⌘K
              </kbd>
            </Button>
          </div>
        </div>
      </header>

      {/* Offline Read-Only Strip */}
      {simFlags.offline && (
        <div className="border-b border-[#C67D63]/30 bg-[#F4E8E3]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 text-xs text-[#2F453B] sm:px-6">
            <span className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-[#C67D63]" />
              <strong>Offline mode:</strong> Cached itinerary loaded from Service Worker shell; live traffic and recalculation disabled.
            </span>
            <button
              type="button"
              onClick={() => setSimFlags((prev) => ({ ...prev, offline: false }))}
              className="font-bold text-[#C67D63] underline"
            >
              Reconnect
            </button>
          </div>
        </div>
      )}

      {/* Main Split-Pane Workspace */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-12">
        {/* Left Column: Active Flow Screen */}
        <section className={showMapAside ? "min-w-0 space-y-4 lg:col-span-7" : "min-w-0 space-y-4 lg:col-span-12"}>
          {activeTab === "plan" && (
            <MorningPlanView
              user={user}
              date={data.date}
              todayDate={data.todayDate}
              isPastDate={data.isPastDate}
              tasks={enrichedTasks}
              dayPlan={data.dayPlan}
              legs={legs}
              legBreakdowns={legBreakdowns}
              budgetSummary={budgetSummary}
              transportProfile={transportProfile}
              taskBudgets={taskBudgets}
              onUpdateTransportProfile={handleUpdateTransportProfile}
              onUpdateTaskPartySize={(taskId, partySize) =>
                handleUpdateTaskBudget(taskId, { partySize })
              }
              onUpdateFriendRide={(taskId, note, cost) =>
                handleUpdateTaskBudget(taskId, { friendRideNote: note, friendRideCost: cost })
              }
              conflict={conflict}
              planAdjustments={planAdjustments}
              autoOptimizeNotes={autoOptimizeNotes}
              needsCriticalDecision={needsCriticalDecision}
              onDismissAutoOptimize={() => setAutoOptimizeNotes([])}
              onAutoOptimize={handleAutoOptimize}
              onDismissAdjustment={(taskId) =>
                setPlanAdjustments((prev) => prev.filter((item) => item.taskId !== taskId))
              }
              onRejectAdjustment={handleRejectPlanShift}
              freeLimitCount={data.freeLimitCount}
              freeLimitMax={data.freeLimitMax}
              building={building}
              calendarChanged={simFlags.calendarChanged}
              offline={simFlags.offline}
              onChangeDate={(offsetDays) => {
                const base = new Date(`${data.date}T12:00:00Z`);
                base.setUTCDate(base.getUTCDate() + offsetDays);
                const next = base.toISOString().slice(0, 10);
                setSelectedDate(next);
                void loadBootstrap(next);
              }}
              onOpenNewTask={() => {
                setEditingTask(null);
                setShowTaskModal(true);
                setCurrentScreen("S08");
              }}
              onEditTask={(task) => {
                setEditingTask(task);
                setShowTaskModal(true);
                setCurrentScreen("S08");
              }}
              onDeleteTask={handleDeleteTask}
              onAssignLocation={async (taskId, place) => {
                await fetch("/api/tasks", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: taskId,
                    locationName: place.name,
                    address: place.address,
                    lat: place.lat,
                    lng: place.lng,
                  }),
                });
                await loadBootstrap(data.date);
                pushToast(`Assigned ${place.name} to task.`);
              }}
              onBuildPlan={() => handleBuildPlan()}
              onStartDay={async () => {
                await fetch("/api/route/solve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: data.date, mode: "start_day" }),
                });
                setActiveTab("live");
                setCurrentScreen("S11");
                await loadBootstrap(data.date);
                await triggerWebPush(
                  "Day Started — Next Stop Ready",
                  "Head out on time for your first Astana stop.",
                  "LEAVE_NOW"
                );
              }}
              onSelectLegMode={handleSelectLegMode}
              onMoveTaskOrder={handleMoveTaskOrder}
              onResolveConflict={handleResolveConflict}
              onTestConflict={handleTestConflict}
              onOpenPaywall={(reason) => setPaywallState({ open: true, reason })}
              onOpenCalendars={() => {
                setCalendarSubTab("connections");
                setActiveTab("calendars");
                setCurrentScreen("S18");
              }}
            />
          )}

          {activeTab === "live" && (
            <LiveDayView
              user={user}
              date={data.date}
              tasks={enrichedTasks}
              dayPlan={data.dayPlan}
              offline={simFlags.offline}
              geolocationDenied={simFlags.geolocationDenied}
              pushDenied={simFlags.pushDenied}
              recalculating={building}
              onRecordActualCheck={handleRecordActualCheck}
              onStartTask={async (task) => {
                await fetch("/api/tasks", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: task.id,
                    status: "IN_PROGRESS",
                    startedAt: new Date().toISOString(),
                  }),
                });
                setActiveTaskId(task.id);
                await loadBootstrap(data.date);
              }}
              onCompleteTask={async (task) => {
                await fetch("/api/tasks", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: task.id, status: "DONE" }),
                });
                await loadBootstrap(data.date);
              }}
              onExtendTask={async (task, extraMin) => {
                await fetch("/api/tasks", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: task.id,
                    extendedMin: (task.extendedMin || 0) + extraMin,
                  }),
                });
                await loadBootstrap(data.date);
              }}
              onSkipTask={async (task, action) => {
                if (action === "DELETE") {
                  await handleDeleteTask(task.id);
                  return;
                }
                if (action === "MOVE_TOMORROW") {
                  const tomorrow = getDateInTimezone(user.currentTimezone || "Asia/Almaty", 1);
                  await fetch("/api/tasks", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: task.id,
                      date: tomorrow,
                      status: "PLANNED",
                      plannedOrder: null,
                    }),
                  });
                  await loadBootstrap(data.date);
                  pushToast(`Moved "${task.title}" to tomorrow (${tomorrow}).`);
                  return;
                }
                await fetch("/api/tasks", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: task.id, status: "SKIPPED" }),
                });
                await loadBootstrap(data.date);
              }}
              onSelectTask={(taskId) => setActiveTaskId(taskId)}
              onRecalculateRoute={(summary) => handleBuildPlan({ summary })}
              onOpenQuickAdd={() => {
                setShowQuickAdd(true);
                setCurrentScreen("S12");
              }}
              onFinishDay={async () => {
                setActiveTab("review");
                setCurrentScreen("S14");
              }}
              onOpenPaywall={(reason) => setPaywallState({ open: true, reason })}
              onNotify={(msg) => pushToast(msg)}
            />
          )}

          {activeTab === "review" && (
            <EveningReviewView
              user={user}
              date={data.date}
              tasks={enrichedTasks}
              dayPlan={data.dayPlan}
              recentDayPlans={data.recentDayPlans}
              budgetSummary={budgetSummary}
              onRecordActualCheck={handleRecordActualCheck}
              onMoveTaskToDate={async (taskId, targetDate) => {
                const res = await fetch("/api/tasks", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: taskId,
                    date: targetDate,
                    status: "PLANNED",
                    plannedOrder: null,
                    eta: null,
                    departureTime: null,
                  }),
                });
                if (!res.ok) {
                  const j = await res.json();
                  if (j.error?.code === "FREE_LIMIT_REACHED") {
                    setPaywallState({ open: true, reason: j.error.message });
                    return;
                  }
                }
                await loadBootstrap(data.date);
                pushToast(`Rolled task over to ${targetDate}.`);
              }}
              onDeleteTask={handleDeleteTask}
              onMarkDayComplete={async () => {
                await fetch("/api/route/solve", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: data.date, mode: "complete_day" }),
                });
                await loadBootstrap(data.date);
                pushToast("Day marked as Completed!");
              }}
              onOpenPaywall={(reason) => setPaywallState({ open: true, reason })}
            />
          )}

          {activeTab === "calendars" && (
            <CalendarsAndSeriesView
              key={calendarSubTab}
              user={user}
              date={data.date}
              tasks={[
                ...enrichedTasks,
                ...(data.weekTasks ?? []).filter(
                  (wt) => !enrichedTasks.some((et) => et.id === wt.id)
                ),
              ]}
              connections={data.calendarConnections}
              events={data.calendarEvents}
              series={data.series}
              initialTab={calendarSubTab}
              priceIntel={priceIntel}
              transportProfile={transportProfile}
              freeLimitCount={data.freeLimitCount}
              freeLimitMax={data.freeLimitMax}
              onUpdateTransportProfile={handleUpdateTransportProfile}
              onResetPriceIntel={handleResetPriceIntel}
              onSelectDate={(nextDate) => {
                setSelectedDate(nextDate);
                void loadBootstrap(nextDate);
              }}
              onRefresh={() => loadBootstrap(data.date)}
              onRecalculatePlan={() =>
                handleBuildPlan({ summary: "Recalculated after calendar change" })
              }
              onOpenPaywall={(reason) => setPaywallState({ open: true, reason })}
              onNotify={(msg) => pushToast(msg)}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              user={user}
              simFlags={simFlags}
              transportProfile={transportProfile}
              onUpdateTransportProfile={handleUpdateTransportProfile}
              onSaveProfile={handleSaveProfile}
              onOpenCitySwitch={() => setShowCitySwitch(true)}
              onOpenPaywall={(reason) => setPaywallState({ open: true, reason })}
              onTriggerTestPush={() =>
                triggerWebPush(
                  "Journo Leave Alert",
                  "Leave in 6 min to reach your next Astana appointment on schedule.",
                  "LEAVE_NOW"
                )
              }
              onToggleSimFlag={(key) =>
                setSimFlags((prev) => ({ ...prev, [key]: !prev[key] }))
              }
              onRefreshSubscription={async () => {
                const res = await fetch("/api/billing/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "refresh_status" }),
                });
                if (res.ok) {
                  await loadBootstrap(data.date);
                  pushToast("Subscription status synced.");
                }
              }}
              onCancelPro={async () => {
                const res = await fetch("/api/billing/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "cancel_pro" }),
                });
                if (res.ok) {
                  await loadBootstrap(data.date);
                  pushToast("Pro cancelled. Your existing tasks remain intact (Rule 9).");
                }
              }}
              onDeleteAccountConfirmed={async () => {
                const res = await fetch("/api/user", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ confirm: "DELETE" }),
                });
                if (res.ok) {
                  router.push("/");
                }
              }}
            />
          )}
        </section>

        {/* Right Column: Sticky Interactive Leaflet Map (only on Plan & Live Day tabs) */}
        {showMapAside ? (
          <aside className="min-w-0 lg:col-span-5">
            <div className="sticky top-4 space-y-3">
              <Card className="overflow-hidden p-3">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <div>
                    <div className="text-xs font-bold text-[#2F453B]">
                      {user.currentCity} Live Route Map
                    </div>
                    <div className="text-[11px] text-[#5E766B]">
                      Start: {originPoint.label}
                    </div>
                  </div>
                </div>

                <DynamicJournoMap
                  origin={originPoint}
                  tasks={enrichedTasks}
                  activeTaskId={activeTaskId}
                  onSelectTask={(id) => {
                    setActiveTaskId(id);
                    const found = data.tasks.find((t) => t.id === id);
                    if (found) {
                      pushToast(`${found.title} — ${found.locationName ?? found.address ?? ""}`);
                    }
                  }}
                  offline={simFlags.offline}
                  heightClass="h-[320px] lg:h-[520px]"
                />
              </Card>
            </div>
          </aside>
        ) : null}
      </main>

      {/* Mobile Bottom Tab Bar + Quick Add FAB (<= 5 tabs) */}
      <nav
        aria-label="Mobile workspace tabs"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DFDBD0] bg-white/95 backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-center py-1.5">
          {(
            [
              { id: "plan", label: "Plan", icon: Compass },
              { id: "live", label: "Live", icon: Play },
              { id: "review", label: "Review", icon: BarChart3 },
              { id: "calendars", label: "Cal", icon: Calendar },
              { id: "settings", label: "Settings", icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                  active ? "text-[#C67D63]" : "text-[#5E766B]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Toasts / In-App Notification Tray */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-20 right-4 z-50 flex w-full max-w-sm flex-col gap-2 lg:bottom-5"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-start gap-2.5 rounded-2xl border border-[#2F453B]/20 bg-[#2F453B] p-3.5 text-[#F6F4EF] shadow-lg"
            >
              {toast.type === "DELAY_RISK" ? (
                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#C67D63]" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E2C2B5]" />
              )}
              <div className="flex-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white">{toast.title}</span>
                  <span className="text-[10px] tabular-nums text-[#F6F4EF]/60">
                    {toast.timestamp}
                  </span>
                </div>
                <p className="mt-0.5 text-[#F6F4EF]/85">{toast.body}</p>
                {toast.actionLabel && toast.targetScreen && (
                  <button
                    type="button"
                    onClick={() => navigateScreen(toast.targetScreen!)}
                    className="mt-1.5 text-[11px] font-bold text-[#E2C2B5] underline"
                  >
                    {toast.actionLabel}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                className="text-[#F6F4EF]/60 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <OnboardingModal
        isOpen={showOnboarding}
        initialStep={onboardingStep}
        user={user}
        onClose={() => {
          setShowOnboarding(false);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem("journo_onboarding_done", "1");
          }
        }}
        onSaveProfile={handleSaveProfile}
        onOpenPaywall={(reason) => setPaywallState({ open: true, reason })}
        onOpenGoogleAuth={() => window.location.assign("/api/auth/google?intent=calendar&next=/app")}
        onNotify={(msg) => pushToast(msg)}
      />

      <TaskFormModal
        key={editingTask?.id || (showTaskModal ? "new-task" : "closed")}
        isOpen={showTaskModal}
        date={data.date}
        city={user.currentCity}
        editingTask={editingTask}
        priceIntel={priceIntel}
        initialPartySize={editingTask ? taskBudgets[editingTask.id]?.partySize : undefined}
        initialCustomPerPerson={editingTask ? taskBudgets[editingTask.id]?.customPerPerson : undefined}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
        onSubmitTask={handleSubmitTask}
      />

      <QuickAddModal
        isOpen={showQuickAdd}
        date={data.date}
        city={user.currentCity}
        tier={user.tier}
        preservedText={quickAddText}
        priceIntel={priceIntel}
        onTextChange={setQuickAddText}
        onClose={() => setShowQuickAdd(false)}
        onCommitQuickAdd={handleCommitQuickAdd}
      />

      <PlanComparisonModal
        isOpen={Boolean(planPreview)}
        preview={planPreview}
        accepting={acceptingPreview}
        onAccept={async () => {
          setAcceptingPreview(true);
          try {
            await handleBuildPlan({ summary: "Accepted Quick Add plan comparison" });
            setPlanPreview(null);
            setPendingQuickAddTaskId(null);
          } finally {
            setAcceptingPreview(false);
          }
        }}
        onDecline={async () => {
          if (pendingQuickAddTaskId) {
            await fetch(`/api/tasks?id=${encodeURIComponent(pendingQuickAddTaskId)}`, {
              method: "DELETE",
            });
          }
          setPlanPreview(null);
          setPendingQuickAddTaskId(null);
          await loadBootstrap(data.date);
          pushToast("Plan diff declined — previous schedule preserved.");
        }}
      />

      <PaywallModal
        isOpen={paywallState.open}
        reason={paywallState.reason}
        user={user}
        onClose={() => setPaywallState({ open: false, reason: "" })}
        onUpgraded={async () => {
          await loadBootstrap(data.date);
        }}
        onNotify={(msg) => pushToast(msg)}
      />

      <CitySwitchModal
        isOpen={showCitySwitch}
        user={user}
        tasks={data.tasks}
        series={data.series}
        onClose={() => setShowCitySwitch(false)}
        onSwitched={async (updatedUser) => {
          await loadBootstrap(data.date);
          pushToast(
            `Switched to ${updatedUser.currentCity} (${
              updatedUser.currentTimezone === "Asia/Almaty" ? "UTC+5" : updatedUser.currentTimezone
            })!`
          );
        }}
      />
    </div>
  );
}
