"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Car,
  CarTaxiFront,
  Clock,
  Footprints,
  Fuel,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TrainFront,
  Trash2,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { PLACE_PRESETS } from "@/lib/astana-places";
import { MultiModalLegBreakdown } from "@/lib/budget-intelligence";
import {
  ConflictResolutionOption,
  DailyBudgetSummary,
  DayPlanItem,
  LegEstimate,
  RouteConflict,
  ShiftedTaskNotice,
  TaskBudgetRecord,
  TaskItem,
  TransportCostProfile,
  TravelMode,
  UserProfile,
} from "@/lib/types";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { formatMinutesToTime, parseTimeToMinutes } from "@/lib/utils";

interface MorningPlanViewProps {
  user: UserProfile;
  date: string;
  todayDate: string;
  isPastDate: boolean;
  tasks: TaskItem[];
  dayPlan: DayPlanItem | null;
  legs: LegEstimate[];
  legBreakdowns?: Map<string, MultiModalLegBreakdown>;
  budgetSummary?: DailyBudgetSummary;
  transportProfile?: TransportCostProfile;
  taskBudgets?: Record<string, TaskBudgetRecord>;
  onUpdateTransportProfile?: (next: TransportCostProfile) => void;
  onUpdateTaskPartySize?: (taskId: string, partySize: number) => void;
  onUpdateFriendRide?: (taskId: string, note: string, cost: number | null) => void;
  conflict: RouteConflict | null;
  planAdjustments?: ShiftedTaskNotice[];
  autoOptimizeNotes?: string[];
  needsCriticalDecision?: boolean;
  onDismissAutoOptimize?: () => void;
  onAutoOptimize?: () => void;
  onDismissAdjustment?: (taskId: string) => void;
  onRejectAdjustment?: (adj: ShiftedTaskNotice) => void;
  freeLimitCount: number;
  freeLimitMax: number;
  building: boolean;
  calendarChanged: boolean;
  offline: boolean;
  onChangeDate: (offsetDays: number) => void;
  onOpenNewTask: () => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (taskId: string) => void;
  onAssignLocation: (taskId: string, place: { name: string; address: string; lat: number; lng: number }) => void;
  onBuildPlan: () => void;
  onStartDay: () => void;
  onSelectLegMode: (taskId: string, mode: TravelMode | "RESTORE_FASTEST") => void;
  onMoveTaskOrder: (taskId: string, direction: "UP" | "DOWN") => void;
  onResolveConflict: (optionId: ConflictResolutionOption["id"], targetTaskId?: string) => void;
  onTestConflict: () => void;
  onOpenPaywall: (reason: string) => void;
  onOpenCalendars: () => void;
}

export function MorningPlanView({
  user,
  date,
  todayDate,
  isPastDate,
  tasks,
  dayPlan,
  legs,
  legBreakdowns,
  budgetSummary,
  transportProfile,
  taskBudgets,
  onUpdateTransportProfile,
  onUpdateTaskPartySize,
  onUpdateFriendRide,
  conflict,
  planAdjustments = [],
  autoOptimizeNotes = [],
  needsCriticalDecision = false,
  onDismissAutoOptimize,
  onAutoOptimize,
  onDismissAdjustment,
  onRejectAdjustment,
  freeLimitCount,
  freeLimitMax,
  building,
  calendarChanged,
  offline,
  onChangeDate: _onChangeDate,
  onOpenNewTask,
  onEditTask,
  onDeleteTask,
  onAssignLocation,
  onBuildPlan,
  onStartDay,
  onSelectLegMode,
  onMoveTaskOrder,
  onResolveConflict,
  onTestConflict,
  onOpenPaywall,
  onOpenCalendars,
}: MorningPlanViewProps) {
  void _onChangeDate;
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const legByTaskId = new Map(legs.map((l) => [l.toTaskId, l]));
  const cityPlaces = PLACE_PRESETS.filter((p) => p.city === user.currentCity).slice(0, 4);

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.exceedsFreeLimit !== b.exceedsFreeLimit) return a.exceedsFreeLimit ? 1 : -1;
    if ((a.lat == null) !== (b.lat == null)) return a.lat == null ? 1 : -1;
    return (a.plannedOrder ?? 999) - (b.plannedOrder ?? 999);
  });

  const activeRoutableTasks = sortedTasks.filter(
    (t) => t.lat != null && !t.exceedsFreeLimit && t.status !== "SKIPPED"
  );

  return (
    <div className="space-y-4">
      {/* Header Row: Highlighted Today Summary Card */}
      <Card className="bg-[#2F453B] text-[#F6F4EF] border-[#25372F] shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-[#F6F4EF] tabular-nums">
                {date === todayDate ? "Today" : date}
              </h1>
              {isPastDate ? (
                <span className="inline-flex items-center rounded-full bg-[#C67D63]/20 border border-[#C67D63]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[#F4D3C6]">
                  Past Date · Read-Only
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[#C6D5CC] tabular-nums mt-0.5">{date}</p>
          </div>

          <div className="flex items-center gap-2.5">
            {user.tier === "FREE" ? (
              <button
                type="button"
                onClick={() =>
                  freeLimitCount >= freeLimitMax
                    ? onOpenPaywall("6th task on a single calendar date")
                    : undefined
                }
                className="flex flex-col items-end gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-right cursor-pointer hover:bg-white/15 transition-colors"
              >
                <span className="text-xs font-bold text-[#F6F4EF] tabular-nums">
                  {freeLimitCount} of {freeLimitMax} Free tasks
                </span>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
                  <div
                    className={`h-full transition-[width,background-color] duration-200 ease-out ${
                      freeLimitCount >= freeLimitMax ? "bg-[#C67D63]" : "bg-[#7FC3A5]"
                    }`}
                    style={{ width: `${Math.min(100, (freeLimitCount / freeLimitMax) * 100)}%` }}
                  />
                </div>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#F6F4EF]">
                <Sparkles className="h-3.5 w-3.5 text-[#E8A086]" aria-hidden="true" />
                Pro · Unlimited
              </span>
            )}
          </div>
        </div>

        {/* Plan Summary Metrics Strip */}
        {dayPlan && activeRoutableTasks.length > 0 ? (
          <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
              <span>
                <strong className="text-sm font-bold text-[#F6F4EF]">{dayPlan.totalKm} km</strong>{" "}
                <span className="text-[#C6D5CC]">total route</span>
              </span>
              <span>
                <strong className="text-sm font-bold text-[#F6F4EF]">
                  {dayPlan.totalTravelMin} min
                </strong>{" "}
                <span className="text-[#C6D5CC]">transit/walk</span>
              </span>
              <span className="inline-flex items-center rounded-full bg-[#3F7A63] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Saved {dayPlan.savedMin} min of travel
              </span>
            </div>
          </div>
        ) : null}

        {/* Morning Daily Budget Forecast + Vehicle/Pass Quick Toggles */}
        {budgetSummary && activeRoutableTasks.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs tabular-nums">
              <span className="inline-flex items-center gap-1.5 font-bold text-[#F6F4EF]">
                <Wallet className="h-3.5 w-3.5 text-[#E8A086]" aria-hidden="true" />
                Daily Budget:
              </span>
              <span className="text-[#C6D5CC]">
                Transport{" "}
                <strong className="text-[#F6F4EF]">
                  ${budgetSummary.plannedTransportTotal.toFixed(2)}
                </strong>
              </span>
              <span className="text-[#C6D5CC]">+</span>
              <span className="text-[#C6D5CC]">
                Venues{" "}
                <strong className="text-[#F6F4EF]">
                  ${budgetSummary.plannedVenueTotal.toFixed(2)}
                </strong>
              </span>
              <span className="text-[#C6D5CC]">=</span>
              <span className="rounded-lg bg-[#C67D63] px-2.5 py-0.5 font-bold text-white">
                ${budgetSummary.plannedGrandTotal.toFixed(2)} Total
              </span>
              {budgetSummary.transitDailyCapReached ? (
                <span className="inline-flex items-center rounded-full bg-[#3F7A63] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Transit Daily Cap Active
                </span>
              ) : null}
            </div>

            {transportProfile && onUpdateTransportProfile ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTransportProfile({
                      ...transportProfile,
                      hasPersonalCar: transportProfile.hasPersonalCar === false,
                    })
                  }
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    transportProfile.hasPersonalCar === false
                      ? "border-[#E8A086]/60 bg-[#C67D63] text-white"
                      : "border-white/20 bg-white/10 text-[#F6F4EF] hover:bg-white/15"
                  }`}
                >
                  <Car className="h-3.5 w-3.5" aria-hidden="true" />
                  {transportProfile.hasPersonalCar === false ? "No personal car" : "Personal car: Yes"}
                </button>
                {transportProfile.hasPersonalCar !== false ? (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTransportProfile({
                        ...transportProfile,
                        vehicleType: transportProfile.vehicleType === "GAS" ? "EV" : "GAS",
                      })
                    }
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                      transportProfile.vehicleType === "EV"
                        ? "border-[#7FC3A5]/60 bg-[#3F7A63] text-white"
                        : "border-white/20 bg-white/10 text-[#F6F4EF] hover:bg-white/15"
                    }`}
                  >
                    {transportProfile.vehicleType === "EV" ? (
                      <Zap className="h-3.5 w-3.5 text-[#A7E6CA]" aria-hidden="true" />
                    ) : (
                      <Fuel className="h-3.5 w-3.5 text-[#E8A086]" aria-hidden="true" />
                    )}
                    Car: {transportProfile.vehicleType === "EV" ? "EV (kWh)" : "Gas (MPG)"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    onUpdateTransportProfile({
                      ...transportProfile,
                      hasUnlimitedTransitPass: !transportProfile.hasUnlimitedTransitPass,
                    })
                  }
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                    transportProfile.hasUnlimitedTransitPass
                      ? "border-[#7FC3A5]/60 bg-[#3F7A63] text-white"
                      : "border-white/20 bg-white/10 text-[#DDE8E2] hover:bg-white/15"
                  }`}
                >
                  <TrainFront className="h-3.5 w-3.5" aria-hidden="true" />
                  {transportProfile.hasUnlimitedTransitPass ? "Transit Pass ($0)" : "Transit: Per-Ride"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

      </Card>

      {/* Calendar Changed Banner */}
      {calendarChanged ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2C2B5] bg-[#F4E8E3] px-4 py-3 text-sm">
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 text-[#C67D63] shrink-0" aria-hidden="true" />
            <span>
              <strong>Calendar changed:</strong> &quot;Client Pitch&quot; shifted by 15 min in Google Calendar.
            </span>
          </div>
          <Button variant="primary" size="sm" onClick={onBuildPlan} disabled={offline}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Recalculate
          </Button>
        </div>
      ) : null}

      {/* Automatic Plan Adjustment Notice (User can accept or reject shifted time) */}
      {planAdjustments.length > 0 ? (
        <Card className="border-[#E08A3C]/50 bg-[#FEF6EE] p-4 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-[#E08A3C] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <h2 className="font-display text-sm font-bold text-[#2F453B]">
                Schedule Adjusted Automatically
              </h2>
              <p className="text-xs text-[#5E766B] mt-0.5">
                Journo moved {planAdjustments.length === 1 ? "a flexible task" : "flexible tasks"} into
                an open slot around your busier commitments. Keep the updated time or decline to lock
                the original window.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {planAdjustments.map((adj) => (
              <div
                key={adj.taskId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DFDBD0] bg-white px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#2F453B]">
                    {adj.title}{" "}
                    <span className="font-mono text-xs text-[#C67D63]">
                      {adj.oldEta ?? "Original"} → {adj.newEta ?? "New"}
                    </span>
                  </p>
                  {adj.reason ? (
                    <p className="text-xs text-[#5E766B] mt-0.5">{adj.reason}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {onRejectAdjustment ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={building || offline}
                      onClick={() => onRejectAdjustment(adj)}
                    >
                      Decline · Keep {adj.oldEta ?? "Original"}
                    </Button>
                  ) : null}
                  {onDismissAdjustment ? (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={building}
                      onClick={() => onDismissAdjustment(adj.taskId)}
                    >
                      Keep {adj.newEta ?? "New Time"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {onAutoOptimize ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E08A3C]/25">
              <p className="text-xs text-[#5E766B]">
                Apply all safe shifts and recalculate time savings in one click.
              </p>
              <Button
                variant="dark"
                size="sm"
                disabled={building || offline}
                onClick={onAutoOptimize}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#E8A086]" aria-hidden="true" />
                Optimize All
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Auto-Optimization Summary Banner (after clicking Optimize) */}
      {!conflict && autoOptimizeNotes.length > 0 ? (
        <Card className="border-[#3F7A63]/40 bg-[#EEF5F1] p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-5 w-5 text-[#2F453B] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-display text-sm font-bold text-[#2F453B]">
                  Plan Auto-Optimized{" "}
                  {dayPlan ? `· Saved ${dayPlan.savedMin} min total` : ""}
                </h2>
                <ul className="mt-1 space-y-0.5 text-xs text-[#5E766B] list-disc list-inside">
                  {autoOptimizeNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
            {onDismissAutoOptimize ? (
              <Button variant="ghost" size="sm" onClick={onDismissAutoOptimize}>
                Dismiss
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* S10: Plan Conflict Resolution Panel (E6.1) */}
      {conflict ? (
        <Card className="border-[#B05454] bg-[#F5E6E6]/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#B05454] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold text-[#B05454]">
                  {needsCriticalDecision
                    ? "Critical Overlap — Your Confirmation Needed"
                    : "Schedule Conflict Detected"}
                </h2>
                {conflict.recommendedMode ? (
                  <Badge variant="warn">
                    {conflict.recommendedMode === "TAXI"
                      ? "Taxi Recommended to Make Fixed Time"
                      : "Car Recommended to Make Fixed Time"}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-[#2F453B] mt-1">{conflict.reason}</p>
              <p className="text-xs text-[#5E766B] mt-1">
                Affected tasks: <strong>{conflict.affectedTitles.join(", ")}</strong>. Your schedule is
                too tight to fit everything — pick how you&apos;d like to handle it:
              </p>
              {autoOptimizeNotes.length > 0 ? (
                <div className="mt-2 rounded-lg bg-white/80 border border-[#DFDBD0] px-3 py-2 text-xs text-[#2F453B]">
                  <strong>Already optimized automatically:</strong>{" "}
                  {autoOptimizeNotes.join(" · ")}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            {conflict.options.map((opt) => {
              const isFastModeOption =
                opt.id === "SWITCH_TO_TAXI" || opt.id === "SWITCH_TO_CAR";
              return (
                <button
                  key={`${opt.id}-${opt.targetTaskId ?? "all"}`}
                  type="button"
                  onClick={() => onResolveConflict(opt.id, opt.targetTaskId)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer min-h-[44px] ${
                    isFastModeOption
                      ? "border-[#2F453B] bg-[#EEF5F1] hover:border-[#C67D63]"
                      : "border-[#DFDBD0] bg-white hover:border-[#C67D63]"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-[#2F453B]">{opt.label}</p>
                    <p className="text-xs text-[#5E766B]">{opt.description}</p>
                  </div>
                  <span className="text-xs font-bold text-[#C67D63] whitespace-nowrap">Apply →</span>
                </button>
              );
            })}
          </div>

          {onAutoOptimize && !needsCriticalDecision ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#B05454]/20">
              <p className="text-xs text-[#5E766B]">
                Don&apos;t want to pick one by one? Auto-apply safe fixes and ask only about critical overlaps.
              </p>
              <Button
                variant="dark"
                size="sm"
                disabled={building || offline}
                onClick={onAutoOptimize}
              >
                <Sparkles className="h-3.5 w-3.5 text-[#E8A086]" aria-hidden="true" />
                Optimize
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Primary Action Toolbar */}
      {!isPastDate ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" onClick={onOpenNewTask} disabled={offline}>
            <Plus className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
            Add Task
          </Button>
          <Button
            variant="dark"
            onClick={onBuildPlan}
            disabled={building || offline || activeRoutableTasks.length === 0}
          >
            <RefreshCw className={`h-4 w-4 ${building ? "animate-spin" : ""}`} aria-hidden="true" />
            {building ? "Calculating route..." : "Build Plan"}
          </Button>
          <Button
            variant="primary"
            onClick={onStartDay}
            disabled={offline || activeRoutableTasks.length === 0}
            className="ml-auto"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Start Day
          </Button>
        </div>
      ) : null}

      {/* Empty State (Section 16) */}
      {sortedTasks.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4E8E3] text-[#C67D63]">
            <MapPin className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">No tasks planned for {date}</h2>
            <p className="text-sm text-[#5E766B] mt-1">
              Add your first stop or connect a calendar to weave errands into one clean route.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <Button variant="primary" onClick={onOpenNewTask}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add First Task
            </Button>
            {user.tier !== "FREE" ? (
              <Button variant="secondary" onClick={onOpenCalendars}>
                Connect Calendar
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task, idx) => {
            const leg = legByTaskId.get(task.id);
            const hasLocation = task.lat != null && task.lng != null;
            const walkMin = leg?.walkMin ?? task.legDurationWalkMin;
            const transitMin = leg?.transitMin ?? task.legDurationTransitMin;
            const diffMin =
              walkMin != null && transitMin != null ? Math.abs(walkMin - transitMin) : 0;
            const isEqualSpeed = leg ? leg.isEqualSpeed : diffMin < 3;
            const fastestMode: TravelMode | null = isEqualSpeed
              ? null
              : walkMin != null && transitMin != null
                ? walkMin <= transitMin
                  ? "WALK"
                  : "TRANSIT"
                : null;
            const activeIndex = activeRoutableTasks.findIndex((t) => t.id === task.id);

            const startStr = task.eta || task.windowStart || null;
            const startMin = parseTimeToMinutes(startStr);
            const endStr =
              task.windowEnd && !task.isFlexible
                ? task.windowEnd
                : startMin != null
                  ? formatMinutesToTime(startMin + (task.durationMin || 30))
                  : null;

            const prevTask = idx > 0 ? sortedTasks[idx - 1] : null;
            const prevStartMin = prevTask
              ? parseTimeToMinutes(prevTask.eta || prevTask.windowStart)
              : null;
            const prevEndMin =
              prevTask && prevTask.windowEnd && !prevTask.isFlexible
                ? parseTimeToMinutes(prevTask.windowEnd)
                : prevStartMin != null && prevTask
                  ? prevStartMin + (prevTask.durationMin || 30)
                  : null;
            const freeGapMin =
              prevEndMin != null && startMin != null && startMin > prevEndMin
                ? startMin - prevEndMin
                : null;

            const railBorderColor =
              task.status === "DONE"
                ? "border-r-[#3F7A63]"
                : !hasLocation || task.exceedsFreeLimit
                  ? "border-r-[#DFDBD0]"
                  : task.isFlexible
                    ? "border-r-[#C67D63]"
                    : "border-r-[#2F453B]";

            const hasPersonalCar = transportProfile?.hasPersonalCar !== false;
            const budgetRec = taskBudgets?.[task.id];

            return (
              <div key={task.id} className="space-y-1.5">
                {/* Calendar Gap / Travel Interval Connector */}
                {hasLocation && !task.exceedsFreeLimit && (task.departureTime || freeGapMin != null) ? (
                  <div className="flex items-stretch gap-3">
                    <div className="w-16 sm:w-20 shrink-0 pr-3 border-r-2 border-dashed border-[#DFDBD0] flex items-center justify-end">
                      <span className="text-[10px] font-semibold tabular-nums text-[#5E766B]">
                        {task.departureTime || ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 py-0.5 text-[11px] text-[#5E766B] tabular-nums">
                      <Clock className="h-3 w-3 text-[#C67D63]" aria-hidden="true" />
                      {task.departureTime && task.eta ? (
                        <span>
                          Leave <strong className="text-[#2F453B]">{task.departureTime}</strong> → Arrive{" "}
                          <strong className="text-[#2F453B]">{task.eta}</strong>
                        </span>
                      ) : null}
                      {freeGapMin != null && freeGapMin > 0 ? (
                        <span>· {freeGapMin}m between stops</span>
                      ) : null}
                      {task.bufferMin != null ? (
                        <span
                          className={`font-semibold ${
                            task.bufferMin < 8 ? "text-[#9C6B3B]" : "text-[#3F7A63]"
                          }`}
                        >
                          ·{" "}
                          {task.bufferMin >= 0
                            ? `${task.bufferMin}m spare`
                            : `${Math.abs(task.bufferMin)}m late`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-stretch gap-3">
                  {/* Left Calendar Time Gutter + Vertical Accent Strip */}
                  <div
                    className={`w-16 sm:w-20 shrink-0 pr-3 py-3 border-r-[3px] ${railBorderColor} flex flex-col items-end justify-start text-right tabular-nums select-none`}
                  >
                    {startStr ? (
                      <>
                        <span className="text-xs font-bold text-[#2F453B] leading-tight">
                          {startStr}
                        </span>
                        {endStr ? (
                          <span className="text-[11px] text-[#5E766B] leading-tight mt-0.5">
                            {endStr}
                          </span>
                        ) : null}
                        <span className="mt-1.5 text-[10px] font-medium text-[#5E766B]">
                          {task.durationMin}m
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#5E766B]">
                        {task.durationMin}m
                      </span>
                    )}
                  </div>

                  {/* Clean Task Card (No Tag Clutter) */}
                  <Card
                    className={`flex-1 min-w-0 p-4 ${
                      task.status === "CONFLICT"
                        ? "border-[#B05454] bg-[#F5E6E6]/30"
                        : task.exceedsFreeLimit
                          ? "opacity-80 border-dashed"
                          : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold tabular-nums ${
                            task.status === "DONE"
                              ? "bg-[#3F7A63] text-white"
                              : !hasLocation || task.exceedsFreeLimit
                                ? "bg-[#ECE9E1] text-[#5E766B]"
                                : task.isFlexible
                                  ? "bg-[#C67D63] text-white"
                                  : "bg-[#2F453B] text-[#F6F4EF]"
                          }`}
                        >
                          {task.status === "DONE" ? "✓" : task.plannedOrder ?? "·"}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="font-display text-base font-bold text-[#2F453B] leading-snug">
                            {task.title}
                          </h3>

                          <p className="text-xs text-[#5E766B] flex items-center gap-1.5">
                            <MapPin
                              className="h-3.5 w-3.5 shrink-0 text-[#C67D63]"
                              aria-hidden="true"
                            />
                            <span className="truncate">
                              {hasLocation
                                ? `${task.locationName || ""}${task.address ? ` · ${task.address}` : ""}`
                                : "No location set — assign a stop to include in route"}
                            </span>
                          </p>

                          {(task.estimatedVenueTotal ?? 0) > 0 ||
                          (!isPastDate && onUpdateTaskPartySize) ? (
                            <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-[#5E766B] tabular-nums">
                              {(task.estimatedVenueTotal ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-1 font-medium text-[#2F453B]">
                                  <Wallet
                                    className="h-3 w-3 text-[#C67D63]"
                                    aria-hidden="true"
                                  />
                                  ~${task.estimatedVenueTotal?.toFixed(2)}
                                </span>
                              ) : null}
                              {!isPastDate && onUpdateTaskPartySize ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateTaskPartySize(
                                      task.id,
                                      ((task.partySize ?? 1) % 4) + 1
                                    )
                                  }
                                  title="Tap to change number of people"
                                  className="inline-flex items-center gap-1 text-[#5E766B] hover:text-[#2F453B] cursor-pointer"
                                >
                                  <Users
                                    className="h-3 w-3 text-[#C67D63]"
                                    aria-hidden="true"
                                  />
                                  {(task.partySize ?? 1) === 1
                                    ? "1 person"
                                    : `${task.partySize} people`}
                                </button>
                              ) : null}
                              {task.exceedsFreeLimit ? (
                                <span className="font-semibold text-[#B05454]">
                                  Waiting for Pro or open slot
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Card Actions (Reorder, Edit, Delete) */}
                      {!isPastDate ? (
                        <div className="flex items-center gap-1 shrink-0">
                          {activeIndex > 0 ? (
                            <button
                              type="button"
                              onClick={() => onMoveTaskOrder(task.id, "UP")}
                              aria-label={`Move ${task.title} earlier`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#ECE9E1] cursor-pointer"
                            >
                              <ArrowUp className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                          {activeIndex >= 0 && activeIndex < activeRoutableTasks.length - 1 ? (
                            <button
                              type="button"
                              onClick={() => onMoveTaskOrder(task.id, "DOWN")}
                              aria-label={`Move ${task.title} later`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#ECE9E1] cursor-pointer"
                            >
                              <ArrowDown className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onEditTask(task)}
                            aria-label={`Edit ${task.title}`}
                            className="inline-flex h-9 px-2.5 items-center justify-center rounded-lg text-xs font-semibold hover:bg-[#ECE9E1] cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            aria-label={`Delete ${task.title}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#B05454] hover:bg-[#F5E6E6] cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {/* Inline Needs Location resolver */}
                    {!hasLocation && !isPastDate ? (
                      <div className="mt-3 pt-3 border-t border-[#DFDBD0] flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-[#9C6B3B]">
                          Needs location
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAssigningId(assigningId === task.id ? null : task.id)
                          }
                          className="text-xs font-semibold text-[#C67D63] hover:underline cursor-pointer"
                        >
                          {assigningId === task.id
                            ? "Hide quick places"
                            : "Pick Astana place →"}
                        </button>
                        {assigningId === task.id ? (
                          <div className="w-full flex flex-wrap gap-1.5 pt-1">
                            {cityPlaces.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  onAssignLocation(task.id, p);
                                  setAssigningId(null);
                                }}
                                className="rounded-lg border border-[#DFDBD0] bg-[#F6F4EF] px-2.5 py-1.5 text-xs font-medium hover:bg-[#ECE9E1] cursor-pointer"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Free Overflow CTA */}
                    {task.exceedsFreeLimit ? (
                      <div className="mt-3 pt-3 border-t border-[#DFDBD0] flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#5E766B]">
                          Saved for later — Free plans include up to 5 stops in one route.
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onOpenPaywall("6th task on a single calendar date")}
                        >
                          Unlock in Pro
                        </Button>
                      </div>
                    ) : null}

                    {/* Multi-Modal Transport Bar (Walk / Transit / Car / Taxi / Friends Ride) */}
                    {hasLocation &&
                    !task.exceedsFreeLimit &&
                    walkMin != null &&
                    task.status !== "DONE" &&
                    task.status !== "SKIPPED" ? (
                      (() => {
                        const breakdown = legBreakdowns?.get(task.id);
                        const effFastest = breakdown?.fastestMode ?? fastestMode;
                        const orderedModes: {
                          id: TravelMode;
                          label: string;
                          min: number;
                          cost: number;
                          icon: React.ReactNode;
                          hidden?: boolean;
                        }[] = [
                          {
                            id: "WALK",
                            label: "Walk",
                            min: walkMin,
                            cost: 0,
                            icon: <Footprints className="h-3.5 w-3.5" aria-hidden="true" />,
                          },
                          {
                            id: "TRANSIT",
                            label: "Transit",
                            min: transitMin ?? breakdown?.transitMin ?? 10,
                            cost: breakdown?.transitCost ?? 0.5,
                            icon: <TrainFront className="h-3.5 w-3.5" aria-hidden="true" />,
                            hidden: transitMin == null || Boolean(leg?.secondModeNotCalculated),
                          },
                          {
                            id: "CAR",
                            label:
                              transportProfile?.vehicleType === "EV" ? "Car (EV)" : "Car",
                            min:
                              breakdown?.carMin ??
                              Math.max(4, Math.round((task.legDistanceKm ?? 2) * 2.1 + 3)),
                            cost: breakdown?.carCost ?? 2.4,
                            icon: <Car className="h-3.5 w-3.5" aria-hidden="true" />,
                            hidden: !hasPersonalCar,
                          },
                          {
                            id: "TAXI",
                            label: "Taxi",
                            min:
                              breakdown?.taxiMin ??
                              Math.max(4, Math.round((task.legDistanceKm ?? 2) * 1.85 + 2)),
                            cost: breakdown?.taxiCost ?? 4.2,
                            icon: <CarTaxiFront className="h-3.5 w-3.5" aria-hidden="true" />,
                          },
                          {
                            id: "CARPOOL",
                            label: "Friends Ride",
                            min:
                              breakdown?.carpoolMin ??
                              Math.max(4, Math.round((task.legDistanceKm ?? 2) * 2.1 + 3)),
                            cost: breakdown?.carpoolCost ?? 0,
                            icon: <Users className="h-3.5 w-3.5" aria-hidden="true" />,
                          },
                        ];
                        const modeButtons =
                          user.transportModes === "CAR" && hasPersonalCar
                            ? [
                                ...orderedModes.filter((m) => m.id === "CAR"),
                                ...orderedModes.filter((m) => m.id !== "CAR"),
                              ]
                            : orderedModes;

                        return (
                          <div className="mt-3 pt-3 border-t border-[#DFDBD0] space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                                {modeButtons
                                  .filter((m) => !m.hidden)
                                  .map((m) => {
                                    const active =
                                      task.legMode === m.id ||
                                      (!hasPersonalCar &&
                                        task.legMode === "CAR" &&
                                        m.id === "TRANSIT");
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        disabled={isPastDate || offline}
                                        onClick={() => onSelectLegMode(task.id, m.id)}
                                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                                          active
                                            ? "border-[#2F453B] bg-[#2F453B] text-[#F6F4EF]"
                                            : "border-[#DFDBD0] bg-[#F6F4EF] text-[#2F453B] hover:bg-[#ECE9E1]"
                                        }`}
                                      >
                                        {m.icon}
                                        <span>
                                          {m.label} {m.min}m ·{" "}
                                          <strong>
                                            {m.cost === 0 ? "$0" : `$${m.cost.toFixed(2)}`}
                                          </strong>
                                        </span>
                                      </button>
                                    );
                                  })}

                                {task.legDistanceKm != null ? (
                                  <span className="text-[#5E766B]">{task.legDistanceKm} km</span>
                                ) : null}
                              </div>

                              {task.legModeChosenByUser ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectLegMode(task.id, "RESTORE_FASTEST")}
                                  className="inline-flex min-h-[34px] items-center gap-1 text-xs font-semibold text-[#2F453B] hover:text-[#C67D63] cursor-pointer"
                                >
                                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                                  Auto-pick fastest
                                </button>
                              ) : null}
                            </div>

                            {task.legMode === "CARPOOL" && onUpdateFriendRide && !isPastDate ? (
                              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] px-3 py-2 text-xs">
                                <span className="font-semibold text-[#2F453B]">
                                  Friends ride:
                                </span>
                                <input
                                  type="text"
                                  value={budgetRec?.friendRideNote ?? ""}
                                  onChange={(e) =>
                                    onUpdateFriendRide(
                                      task.id,
                                      e.target.value,
                                      budgetRec?.friendRideCost ?? 0
                                    )
                                  }
                                  placeholder="Who gives you a lift (e.g. Alex)"
                                  className="min-w-[160px] flex-1 rounded-lg border border-[#DFDBD0] bg-white px-2.5 py-1 text-xs text-[#2F453B]"
                                />
                                <label className="flex items-center gap-1 text-[#5E766B]">
                                  Share $
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={budgetRec?.friendRideCost ?? 0}
                                    onChange={(e) =>
                                      onUpdateFriendRide(
                                        task.id,
                                        budgetRec?.friendRideNote ?? "",
                                        e.target.value === ""
                                          ? 0
                                          : Math.max(0, Number(e.target.value))
                                      )
                                    }
                                    className="w-16 rounded-lg border border-[#DFDBD0] bg-white px-2 py-1 text-xs font-semibold tabular-nums text-[#2F453B]"
                                  />
                                </label>
                              </div>
                            ) : null}

                            {breakdown ? (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#5E766B] tabular-nums">
                                <span>Transit: {breakdown.transitNote}</span>
                                {hasPersonalCar ? (
                                  <span>Car: {breakdown.carNote}</span>
                                ) : (
                                  <span>
                                    No personal car · Friends ride available
                                  </span>
                                )}
                                {!isEqualSpeed && effFastest && diffMin >= 3 ? (
                                  <span className="font-medium text-[#3F7A63]">
                                    {diffMin} min faster by{" "}
                                    {effFastest === "WALK"
                                      ? "walking"
                                      : effFastest === "CAR"
                                        ? "car"
                                        : "transit"}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()
                    ) : null}
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {budgetSummary?.carContinuityActive && activeRoutableTasks.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#DFDBD0] bg-[#FAF6EA]/90 px-4 py-3 text-xs text-[#2F453B]">
          <span className="flex items-center gap-2 font-medium">
            <Car className="h-4 w-4 text-[#C67D63] shrink-0" aria-hidden="true" />
            <span>
              <strong>Round-trip by car:</strong> You left Home in your car — Journo keeps driving
              legs continuous and reserves ~{budgetSummary.returnHomeCarMin ?? 10} min (
              {budgetSummary.returnHomeCarKm ?? 2.5} km · $
              {(budgetSummary.returnHomeCarCost ?? 0).toFixed(2)}) for the drive home.
            </span>
          </span>
        </div>
      ) : null}

      {!isPastDate && !conflict && activeRoutableTasks.length >= 2 ? (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onTestConflict}
            className="text-xs font-medium text-[#5E766B] hover:text-[#C67D63] underline cursor-pointer"
          >
            Preview schedule overlap check
          </button>
        </div>
      ) : null}
    </div>
  );
}
