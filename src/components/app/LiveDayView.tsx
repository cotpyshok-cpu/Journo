"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellOff,
  Car,
  CarTaxiFront,
  Check,
  Clock,
  ExternalLink,
  Footprints,
  LocateFixed,
  MapPin,
  MapPinOff,
  Navigation,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  SkipForward,
  Sparkles,
  Timer,
  TrainFront,
  Wallet,
  WifiOff,
} from "lucide-react";
import {
  DayPlanItem,
  TaskItem,
  UserProfile,
} from "@/lib/types";
import { formatMinutesToTime, parseTimeToMinutes } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui/primitives";

interface LiveDayViewProps {
  user: UserProfile;
  date: string;
  tasks: TaskItem[];
  dayPlan: DayPlanItem | null;
  offline: boolean;
  geolocationDenied: boolean;
  pushDenied: boolean;
  recalculating: boolean;
  onStartTask: (task: TaskItem) => Promise<void>;
  onCompleteTask: (task: TaskItem) => Promise<void>;
  onExtendTask: (task: TaskItem, extraMin: number) => Promise<void>;
  onSkipTask: (task: TaskItem, action: "SKIP" | "MOVE_TOMORROW" | "DELETE") => Promise<void>;
  onSelectTask: (taskId: string) => void;
  onRecalculateRoute: (summary?: string) => Promise<void>;
  onOpenQuickAdd: () => void;
  onFinishDay: () => Promise<void>;
  onOpenPaywall: (reason: string) => void;
  onNotify: (msg: string) => void;
  onRecordActualCheck?: (payload: {
    task: TaskItem;
    actualVenueSpend: number | null;
    actualTransportSpend: number | null;
    partySize: number;
  }) => void;
}

function buildNavUrl(task: TaskItem): string {
  if (task.lat == null || task.lng == null) return "#";
  const coords = `${task.lat},${task.lng}`;
  const mode =
    task.legMode === "WALK"
      ? "walking"
      : task.legMode === "CAR" || task.legMode === "TAXI" || task.legMode === "CARPOOL"
        ? "driving"
        : "transit";
  return `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=${mode}`;
}

function formatModeLabel(mode?: TaskItem["legMode"]): string {
  if (mode === "WALK") return "Walk";
  if (mode === "CAR") return "Car";
  if (mode === "TAXI") return "Taxi";
  if (mode === "CARPOOL") return "Friends Ride";
  return "Transit";
}

export function LiveDayView({
  user,
  date,
  tasks,
  dayPlan: _dayPlan,
  offline,
  geolocationDenied,
  pushDenied,
  recalculating,
  onStartTask,
  onCompleteTask,
  onExtendTask,
  onSkipTask,
  onSelectTask,
  onRecalculateRoute,
  onOpenQuickAdd,
  onFinishDay,
  onOpenPaywall,
  onNotify,
  onRecordActualCheck,
}: LiveDayViewProps) {
  void _dayPlan;
  const [checkDrafts, setCheckDrafts] = useState<
    Record<string, { venue: string; transport: string }>
  >({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [lastVisibleRefresh, setLastVisibleRefresh] = useState<string>(() =>
    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
  const [geofencePromptTaskId, setGeofencePromptTaskId] = useState<string | null>(null);
  const [pickingAnotherTask, setPickingAnotherTask] = useState(false);
  const [skipModalTask, setSkipModalTask] = useState<TaskItem | null>(null);
  const [earlyFinishBanner, setEarlyFinishBanner] = useState<string | null>(null);
  const [delayShiftBanner, setDelayShiftBanner] = useState<{
    extraMin: number;
    shiftedSummary: string;
  } | null>(null);

  // Tick every second for tabular-nums MM:SS timer and E3.2 tab-return freshness
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setNowMs(Date.now());
        setLastVisibleRefresh(
          new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
        );
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const orderedRouteTasks = useMemo(() => {
    return tasks
      .filter((t) => t.lat != null && t.lng != null && !t.exceedsFreeLimit)
      .slice()
      .sort((a, b) => (a.plannedOrder ?? 99) - (b.plannedOrder ?? 99));
  }, [tasks]);

  const inProgressTask = orderedRouteTasks.find((t) => t.status === "IN_PROGRESS") ?? null;
  const upcomingTasks = orderedRouteTasks.filter((t) => t.status === "PLANNED" || t.status === "CONFLICT");
  const nextTask = inProgressTask ?? upcomingTasks[0] ?? null;
  const completedCount = orderedRouteTasks.filter((t) => t.status === "DONE").length;
  const allFinished = orderedRouteTasks.length > 0 && !nextTask;

  // Compute live elapsed MM:SS for IN_PROGRESS task
  const elapsedSeconds = useMemo(() => {
    if (!inProgressTask?.startedAt) return 0;
    const startMs = new Date(inProgressTask.startedAt).getTime();
    if (Number.isNaN(startMs)) return 0;
    return Math.max(0, Math.floor((nowMs - startMs) / 1000));
  }, [inProgressTask?.startedAt, nowMs]);

  const elapsedFormatted = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(
    elapsedSeconds % 60
  ).padStart(2, "0")}`;

  // Compute simulated countdown to departure based on current time in user's timezone
  const departureCountdownLabel = useMemo(() => {
    if (!nextTask?.departureTime) return "Ready to go";
    if (nextTask.status === "IN_PROGRESS") return "Currently active";
    try {
      const nowInTz = new Intl.DateTimeFormat("en-GB", {
        timeZone: user.currentTimezone || "Asia/Almaty",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(nowMs));
      const nowMin = parseTimeToMinutes(nowInTz) ?? 540;
      const depMin = parseTimeToMinutes(nextTask.departureTime) ?? 540;
      const diff = depMin - nowMin;
      if (diff > 60) {
        return `Leave in ${Math.floor(diff / 60)}h ${diff % 60}m`;
      }
      if (diff > 0) {
        return `Leave in ${diff} min`;
      }
      if (diff >= -15) {
        return "Leave now";
      }
      return `Scheduled window (${nextTask.departureTime})`;
    } catch {
      return `Depart ${nextTask.departureTime}`;
    }
  }, [nextTask, nowMs, user.currentTimezone]);

  const handleExtend = async (task: TaskItem, extraMin: number) => {
    await onExtendTask(task, extraMin);
    const baseEtaMin = parseTimeToMinutes(task.eta) ?? 600;
    const newFinish = formatMinutesToTime(baseEtaMin + task.durationMin + task.extendedMin + extraMin);
    setDelayShiftBanner({
      extraMin,
      shiftedSummary: `Task duration extended by +${extraMin} min (finishes ~${newFinish}). Next stop buffer updated.`,
    });
    if (user.tier !== "FREE" && !offline) {
      await onRecalculateRoute(`Auto-adjusted after +${extraMin} min task extension`);
    }
  };

  const handleComplete = async (task: TaskItem) => {
    const startMs = task.startedAt ? new Date(task.startedAt).getTime() : nowMs;
    const activeMinutes = Math.max(0, (nowMs - startMs) / 60_000);
    await onCompleteTask(task);
    setDelayShiftBanner(null);
    // E5.1: If finished more than 5 min early, offer to pull forward next flexible stop
    if (upcomingTasks.some((t) => t.id !== task.id) && activeMinutes < Math.max(10, task.durationMin - 5)) {
      setEarlyFinishBanner(
        `Finished "${task.title}" early. You can pull forward upcoming flexible errands.`
      );
    }
  };

  const activeGeofenceTask =
    orderedRouteTasks.find((t) => t.id === geofencePromptTaskId) ?? null;

  return (
    <div className="space-y-4">
      {/* Freshness & GPS/Push Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#DFDBD0] bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-[#5E766B]">
          <span className="h-2 w-2 rounded-full bg-[#3F7A63]" />
          <span className="font-semibold text-[#2F453B]">Live Day · {date}</span>
          <span className="text-[#DFDBD0]">|</span>
          <span className="tabular-nums">Updated at {lastVisibleRefresh}</span>
        </div>
        <div className="flex items-center gap-2">
          {!geolocationDenied && nextTask && (
            <button
              type="button"
              onClick={() => {
                setGeofencePromptTaskId(nextTask.id);
                setPickingAnotherTask(false);
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] px-3 text-xs font-semibold text-[#2F453B] hover:bg-[#ECE9E1]"
            >
              <LocateFixed className="h-3.5 w-3.5 text-[#C67D63]" />
              I&apos;m Arriving
            </button>
          )}
          <Button variant="primary" size="sm" onClick={onOpenQuickAdd}>
            <Plus className="h-3.5 w-3.5" />
            Quick Add
          </Button>
        </div>
      </div>

      {/* System Failure / Permission Banners (A7, A8, Offline) */}
      {offline && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#C67D63]/35 bg-[#C67D63]/10 px-4 py-3 text-xs text-[#2F453B]">
          <WifiOff className="h-4 w-4 shrink-0 text-[#C67D63]" />
          <span>
            <strong>Offline mode:</strong> Showing your saved itinerary and ETAs in read-only mode. Task check-offs sync once connected.
          </span>
        </div>
      )}

      {geolocationDenied && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#9C6B3B]/30 bg-[#F6EFE2] px-4 py-3 text-xs text-[#75512B]">
          <MapPinOff className="h-4 w-4 shrink-0 text-[#9C6B3B]" />
          <span>
            <strong>Location access disabled:</strong> Automatic arrival detection is paused. Use manual <strong>Start Task</strong> / <strong>Done</strong> buttons below.
          </span>
        </div>
      )}

      {pushDenied && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF] px-4 py-2.5 text-xs text-[#5E766B]">
          <BellOff className="h-4 w-4 shrink-0 text-[#C67D63]" />
          <span>
            <strong>Notifications off:</strong> Departure reminders appear inside Journo when you keep this view open.
          </span>
        </div>
      )}

      {/* E4.1: Geofence Arrival Check-in Card */}
      {activeGeofenceTask && (
        <Card className="border-2 border-[#C67D63] bg-[#F4E8E3]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="coral">Arrival Check-in</Badge>
                <span className="text-xs font-medium text-[#5E766B]">
                  Near {activeGeofenceTask.locationName || activeGeofenceTask.title}
                </span>
              </div>
              <h3 className="mt-1.5 text-base font-bold text-[#2F453B]">
                Have you arrived at &ldquo;{activeGeofenceTask.title}&rdquo;?
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setGeofencePromptTaskId(null)}
              className="text-xs font-semibold text-[#5E766B] hover:text-[#2F453B]"
            >
              Dismiss
            </button>
          </div>

          {!pickingAnotherTask ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  await onStartTask(activeGeofenceTask);
                  setGeofencePromptTaskId(null);
                  onNotify(`Timer started for "${activeGeofenceTask.title}"`);
                }}
              >
                <Check className="h-4 w-4" />
                Yes, Start Timer
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPickingAnotherTask(true)}
              >
                This is another task
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGeofencePromptTaskId(null)}
              >
                Just passing by
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-2 border-t border-[#DFDBD0] pt-3">
              <p className="text-xs font-semibold text-[#2F453B]">
                Select which planned task you actually started:
              </p>
              <div className="flex flex-wrap gap-2">
                {upcomingTasks.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={async () => {
                      await onStartTask(candidate);
                      setGeofencePromptTaskId(null);
                      setPickingAnotherTask(false);
                      onNotify(`Checked into "${candidate.title}" instead.`);
                    }}
                    className="rounded-xl border border-[#2F453B]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#2F453B] hover:border-[#C67D63] hover:text-[#C67D63]"
                  >
                    {candidate.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Delay / Shift Banner with Free Manual Update vs Pro Auto-Recalc */}
      {delayShiftBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C67D63]/35 bg-[#C67D63]/10 px-4 py-3 text-xs text-[#2F453B]">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-[#C67D63]" />
            <span>{delayShiftBanner.shiftedSummary}</span>
          </div>
          {user.tier === "FREE" ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={recalculating}
                disabled={offline}
                onClick={async () => {
                  await onRecalculateRoute("Manual route update after extension");
                  setDelayShiftBanner(null);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Update Route
              </Button>
              <button
                type="button"
                onClick={() =>
                  onOpenPaywall("Enable Pro for automatic background route recalculation on delays.")
                }
                className="text-xs font-semibold text-[#C67D63] underline"
              >
                Auto in Pro
              </button>
            </div>
          ) : (
            <Badge variant="safe">Auto-recalculated (Pro)</Badge>
          )}
        </div>
      )}

      {/* E5.1 Early Completion Pull-Forward Banner */}
      {earlyFinishBanner && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3F7A63]/30 bg-[#3F7A63]/10 px-4 py-3 text-xs text-[#2F453B]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[#3F7A63]" />
            <span>{earlyFinishBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={recalculating}
              disabled={offline}
              onClick={async () => {
                await onRecalculateRoute("Pulled forward remaining stops after early completion");
                setEarlyFinishBanner(null);
              }}
            >
              Pull Forward Next Stops
            </Button>
            <button
              type="button"
              onClick={() => setEarlyFinishBanner(null)}
              className="text-xs text-[#5E766B] hover:text-[#2F453B]"
            >
              Keep current times
            </button>
          </div>
        </div>
      )}

      {/* Deep Forest "Next Step" Hero Card */}
      {nextTask ? (
        <Card dark className="relative overflow-hidden p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C67D63] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                  {nextTask.status === "IN_PROGRESS" ? "Active Stop" : "Next Step"}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#F6F4EF]">
                  {nextTask.isFlexible ? "Flexible" : "Fixed Time"}
                </span>
                <span className="text-xs font-medium tabular-nums text-[#F6F4EF]/80">
                  {departureCountdownLabel}
                </span>
              </div>

              <h2 className="pt-1 text-2xl font-bold tracking-tight text-white">
                {nextTask.title}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-[#F6F4EF]/80">
                <MapPin className="h-4 w-4 shrink-0 text-[#C67D63]" />
                <span>
                  {nextTask.locationName || nextTask.address || "Pinned location"}
                  {nextTask.address && nextTask.locationName ? ` — ${nextTask.address}` : ""}
                </span>
              </p>
            </div>

            {/* Live Timer or ETA Pill */}
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right">
              {nextTask.status === "IN_PROGRESS" ? (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#F6F4EF]/70">
                    Task Timer
                  </div>
                  <div className="mt-0.5 flex items-center justify-end gap-1.5 text-2xl font-bold tabular-nums text-white">
                    <Timer className="h-5 w-5 text-[#C67D63]" />
                    {elapsedFormatted}
                  </div>
                  <div className="text-[11px] tabular-nums text-[#F6F4EF]/75">
                    Target {nextTask.durationMin + nextTask.extendedMin} min
                    {nextTask.extendedMin > 0 ? ` (+${nextTask.extendedMin}m)` : ""}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#F6F4EF]/70">
                    Depart → Arrive
                  </div>
                  <div className="mt-0.5 text-xl font-bold tabular-nums text-white">
                    {nextTask.departureTime || "--:--"} → {nextTask.eta || nextTask.windowStart || "--:--"}
                  </div>
                  <div className="text-[11px] tabular-nums text-[#F6F4EF]/75">
                    {formatModeLabel(nextTask.legMode)} ·{" "}
                    {nextTask.legDistanceKm?.toFixed(1) ?? "0.0"} km ·{" "}
                    {nextTask.bufferMin ?? 10} min spare
                  </div>
                </>
              )}
            </div>
          </div>

          {/* One-Tap Check & Expense Logging */}
          {onRecordActualCheck ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs text-[#F6F4EF]">
              <div className="flex flex-wrap items-center gap-2 tabular-nums">
                <Receipt className="h-4 w-4 shrink-0 text-[#C67D63]" aria-hidden="true" />
                <span className="font-semibold">
                  {nextTask.actualVenueSpend != null
                    ? `Saved receipt: $${nextTask.actualVenueSpend.toFixed(2)}`
                    : `Est. spend: $${(nextTask.estimatedVenueTotal ?? 0).toFixed(2)} (${nextTask.partySize ?? 1} ${(nextTask.partySize ?? 1) === 1 ? "person" : "people"})`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.25"
                  aria-label="Actual venue spend ($)"
                  value={
                    checkDrafts[nextTask.id]?.venue ??
                    String(
                      nextTask.actualVenueSpend ??
                        nextTask.estimatedVenueTotal ??
                        0
                    )
                  }
                  onChange={(e) =>
                    setCheckDrafts((prev) => ({
                      ...prev,
                      [nextTask.id]: {
                        venue: e.target.value,
                        transport:
                          prev[nextTask.id]?.transport ??
                          String(nextTask.actualTransportSpend ?? 0.5),
                      },
                    }))
                  }
                  className="h-9 w-24 rounded-xl border border-white/25 bg-white/95 px-2.5 text-xs font-bold text-[#2F453B] tabular-nums"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const draft = checkDrafts[nextTask.id];
                    const venueNum = Number(
                      draft?.venue ??
                        nextTask.actualVenueSpend ??
                        nextTask.estimatedVenueTotal ??
                        0
                    );
                    onRecordActualCheck({
                      task: nextTask,
                      actualVenueSpend: Number.isFinite(venueNum) ? venueNum : 0,
                      actualTransportSpend: nextTask.actualTransportSpend ?? null,
                      partySize: nextTask.partySize ?? 1,
                    });
                  }}
                >
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                  Save Receipt
                </Button>
              </div>
            </div>
          ) : null}

          {/* Primary Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-white/15 pt-4">
            {nextTask.status !== "IN_PROGRESS" ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => onStartTask(nextTask)}
              >
                <Play className="h-4 w-4" />
                Arrived & Start Task
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleComplete(nextTask)}
                >
                  <Check className="h-4 w-4" />
                  Done
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => handleExtend(nextTask, 10)}
                >
                  +10 min Extend
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="md"
              className="border border-white/20 text-white hover:bg-white/10"
              onClick={() => setSkipModalTask(nextTask)}
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>

            {/* Navigation Deep Link */}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <a
                href={buildNavUrl(nextTask)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-[#F6F4EF] px-4 py-2 text-sm font-semibold text-[#2F453B] transition-colors hover:bg-white"
              >
                <Navigation className="h-4 w-4 text-[#C67D63]" />
                Navigate
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </div>
          </div>
        </Card>
      ) : (
        <Card dark className="p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#C67D63]/20 text-[#C67D63]">
            <Check className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-xl font-bold text-white">
            {orderedRouteTasks.length === 0
              ? "No route stops planned yet"
              : "All planned stops completed!"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#F6F4EF]/75">
            {orderedRouteTasks.length === 0
              ? "Add tasks in Morning Plan or use Quick Add to build an active Live Day timeline."
              : "Review your saved travel time, distance, and analytics in Evening Review."}
          </p>
          <div className="mt-4 flex justify-center gap-2.5">
            {allFinished && (
              <Button variant="primary" onClick={onFinishDay}>
                Open Evening Review
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Inline Skip Confirmation Modal/Panel (Hard Anchor warning + Move/Delete) */}
      {skipModalTask && (
        <Card className="border-2 border-[#C67D63] bg-[#F4E8E3]">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#C67D63]" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-[#2F453B]">
                Skip &ldquo;{skipModalTask.title}&rdquo;?
              </h3>
              <p className="mt-1 text-xs text-[#5E766B]">
                {!skipModalTask.isFlexible
                  ? `This task has a fixed time (${skipModalTask.windowStart ?? "scheduled"}). Skipping will remove it from today's route unless you move it.`
                  : "Flexible errand — skipping frees up extra time for the rest of your day."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await onSkipTask(skipModalTask, "MOVE_TOMORROW");
                    setSkipModalTask(null);
                  }}
                >
                  Move to Tomorrow
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await onSkipTask(skipModalTask, "SKIP");
                    setSkipModalTask(null);
                  }}
                >
                  Mark Skipped Today
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await onSkipTask(skipModalTask, "DELETE");
                    setSkipModalTask(null);
                  }}
                >
                  Delete Task
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSkipModalTask(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Full Day Timeline */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#2F453B]">Today&apos;s Live Timeline</h3>
            <p className="text-xs text-[#5E766B] tabular-nums">
              {completedCount} of {orderedRouteTasks.length} stops done
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onFinishDay}>
            Finish Day → Review
          </Button>
        </div>

        <div className="space-y-2.5">
          {orderedRouteTasks.map((task, idx) => {
            const isDone = task.status === "DONE";
            const isSkipped = task.status === "SKIPPED";
            const isCurrent = task.id === nextTask?.id;
            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={`cursor-pointer rounded-2xl border p-3.5 transition-[border-color,background-color] duration-150 ease-out ${
                  isCurrent
                    ? "border-[#C67D63] bg-[#F6F4EF]"
                    : isDone || isSkipped
                    ? "border-[#DFDBD0]/70 bg-[#F6F4EF]/40 opacity-65"
                    : "border-[#DFDBD0] bg-white hover:border-[#2F453B]/30"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                        isDone
                          ? "bg-[#3F7A63] text-white"
                          : isCurrent
                          ? "bg-[#C67D63] text-white"
                          : "bg-[#2F453B]/10 text-[#2F453B]"
                      }`}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold text-[#2F453B] ${
                            isDone ? "line-through" : ""
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.status === "IN_PROGRESS" && <Badge variant="coral">In progress</Badge>}
                        {isSkipped && <Badge variant="neutral">Skipped</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E766B]">
                        <span>{task.locationName || task.address}</span>
                        {task.legMode && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            {task.legMode === "WALK" ? (
                              <Footprints className="h-3 w-3" />
                            ) : task.legMode === "CAR" || task.legMode === "CARPOOL" ? (
                              <Car className="h-3 w-3" />
                            ) : task.legMode === "TAXI" ? (
                              <CarTaxiFront className="h-3 w-3" />
                            ) : (
                              <TrainFront className="h-3 w-3" />
                            )}
                            {formatModeLabel(task.legMode)}
                          </span>
                        )}
                        {(task.actualVenueSpend != null || (task.estimatedVenueTotal ?? 0) > 0) && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                              task.actualVenueSpend != null
                                ? "bg-[#E6EFEA] text-[#3F7A63]"
                                : "bg-[#ECE9E1] text-[#2F453B]"
                            }`}
                          >
                            {task.actualVenueSpend != null
                              ? `Paid $${task.actualVenueSpend.toFixed(2)}`
                              : `Est. $${task.estimatedVenueTotal?.toFixed(2)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right tabular-nums">
                    <div className="text-xs font-bold text-[#2F453B]">
                      {task.eta || task.windowStart || "--:--"}
                    </div>
                    <div className="text-[11px] text-[#5E766B]">
                      {task.durationMin + task.extendedMin} min
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
