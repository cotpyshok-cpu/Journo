"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileUp,
  Fuel,
  Lock,
  MapPin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  RotateCcw,
  Sparkles,
  TrainFront,
  Trash2,
  Unlink,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { TaskFormModal } from "@/components/app/TaskFormModal";
import {
  CalendarConnectionItem,
  CalendarEventItem,
  PriceIntelEntry,
  TaskItem,
  TaskSeriesItem,
  TransportCostProfile,
  UserProfile,
} from "@/lib/types";
import { Badge, Button, Card, Modal, Switch, inputClass } from "@/components/ui/primitives";

export type CalendarsSubTab = "connections" | "grid" | "series" | "people";

interface CalendarsAndSeriesViewProps {
  user: UserProfile;
  date: string;
  tasks?: TaskItem[];
  connections: CalendarConnectionItem[];
  events: CalendarEventItem[];
  series: TaskSeriesItem[];
  initialTab?: CalendarsSubTab;
  priceIntel?: PriceIntelEntry[];
  transportProfile?: TransportCostProfile;
  freeLimitCount?: number;
  freeLimitMax?: number;
  onUpdateTransportProfile?: (next: TransportCostProfile) => void;
  onResetPriceIntel?: () => void;
  onSelectDate?: (nextDate: string) => void;
  onRefresh: () => Promise<void>;
  onRecalculatePlan?: () => Promise<void>;
  onOpenPaywall: (reason: string) => void;
  onNotify: (msg: string) => void;
}

const SAMPLE_ASTANA_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//Mac OS X//EN
BEGIN:VEVENT
UID:apple-ics-astana-01@journo.app
SUMMARY:Kazakhstan Tech Briefing (Apple Calendar)
LOCATION:Astana Hub, Mangilik El C4.6, Astana
DTSTART;TZID=Asia/Almaty:20261114T150000
DTEND;TZID=Asia/Almaty:20261114T154500
END:VEVENT
END:VCALENDAR`;

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekDaysForDate(isoDate: string) {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return [];
  const base = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dow = base.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const shortMonths = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + mondayOffset + i));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const d = dt.getUTCDate();
    return {
      iso: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      weekday: shortDays[dt.getUTCDay()],
      dayNum: d,
      monthShort: shortMonths[m],
    };
  });
}

function hhmmToMin(hhmm?: string | null): number | null {
  if (!hhmm || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minToHhmm(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMin)));
  const h = String(Math.floor(clamped / 60)).padStart(2, "0");
  const m = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function CalendarsAndSeriesView({
  user,
  date,
  tasks = [],
  connections,
  events,
  series,
  initialTab = "grid",
  priceIntel = [],
  transportProfile,
  freeLimitCount = 0,
  freeLimitMax = 5,
  onUpdateTransportProfile,
  onResetPriceIntel,
  onSelectDate,
  onRefresh,
  onRecalculatePlan,
  onOpenPaywall,
  onNotify,
}: CalendarsAndSeriesViewProps) {
  const [subTab, setSubTab] = useState<CalendarsSubTab>(initialTab);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [icsText, setIcsText] = useState("");
  const [gridViewMode, setGridViewMode] = useState<"day" | "week">("day");

  // Unified Event Creation Modal State (uses TaskFormModal mode="calendar")
  const [showEventModal, setShowEventModal] = useState(false);
  const [evDate, setEvDate] = useState(date);
  const [evStart, setEvStart] = useState("15:00");
  const [evEnd, setEvEnd] = useState("15:45");
  const [evIsHard, setEvIsHard] = useState(true);
  const [editingTaskForLoc, setEditingTaskForLoc] = useState<TaskItem | null>(null);

  // S21c Delete Event / Task Confirmation Modal
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<{
    id: string;
    kind: "EVENT" | "TASK";
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Series Edit Scope Modal
  const [editingSeries, setEditingSeries] = useState<TaskSeriesItem | null>(null);
  const [seriesEditTitle, setSeriesEditTitle] = useState("");
  const [seriesEditScope, setSeriesEditScope] = useState<
    "THIS_ONLY" | "THIS_AND_FOLLOWING" | "ALL"
  >("ALL");

  const isPro = user.tier === "PRO" || user.tier === "DEV";
  const googleConn = connections.find((c) => c.provider === "GOOGLE") ?? null;
  const appleConn = connections.find((c) => c.provider === "APPLE_ICS") ?? null;

  const weekDays = useMemo(() => getWeekDaysForDate(date), [date]);

  type ScheduleBlock = {
    key: string;
    kind: "EVENT" | "TASK";
    eventId?: string;
    taskId?: string;
    provider?: "INTERNAL" | "GOOGLE" | "APPLE_ICS";
    title: string;
    startTime: string;
    endTime: string;
    startMin: number;
    endMin: number;
    location: string;
    hasLocation: boolean;
    isHard: boolean;
    exceedsFreeLimit?: boolean;
    partySize?: number;
    status?: string;
    col?: number;
    cols?: number;
  };

  const buildScheduleForDate = useMemo(() => {
    return (targetDate: string): ScheduleBlock[] => {
      const dayEvents = events.filter((e) => e.date === targetDate);
      const linkedEventIds = new Set(dayEvents.map((e) => e.id));
      const linkedTaskIds = new Set(dayEvents.map((e) => e.linkedTaskId).filter(Boolean));
      const items: ScheduleBlock[] = [];

      for (const ev of dayEvents) {
        const startMin = hhmmToMin(ev.startTime) ?? 9 * 60;
        const rawEnd = hhmmToMin(ev.endTime) ?? startMin + 45;
        const endMin = Math.max(startMin + 25, rawEnd);
        const linkedTask = tasks.find((t) => t.id === ev.linkedTaskId);
        const hasLocation = Boolean(ev.lat != null && ev.lng != null);
        items.push({
          key: `ev-${ev.id}`,
          kind: "EVENT",
          eventId: ev.id,
          taskId: linkedTask?.id,
          provider: ev.provider,
          title: ev.title,
          startTime: ev.startTime,
          endTime: ev.endTime,
          startMin,
          endMin,
          location: ev.locationName || ev.address || "No location set",
          hasLocation,
          isHard: ev.isHard,
          exceedsFreeLimit: linkedTask?.exceedsFreeLimit,
        });
      }

      const linkedTitles = new Set(dayEvents.map((e) => e.title.trim().toLowerCase()));

      for (const task of tasks) {
        if (task.status === "SKIPPED" || task.date !== targetDate) continue;
        if (
          linkedTaskIds.has(task.id) ||
          ((task.source === "INTERNAL_CALENDAR" ||
            task.source === "GOOGLE_CALENDAR" ||
            task.source === "APPLE_ICS") &&
            (linkedEventIds.has(task.externalId || "") ||
              linkedTitles.has(task.title.trim().toLowerCase())))
        ) {
          continue;
        }
        const arrivalTime = task.eta || task.windowStart || "09:00";
        const startMin = hhmmToMin(arrivalTime) ?? 9 * 60;
        const endMin = startMin + Math.max(25, task.durationMin || 30);
        const hasLocation = task.lat != null && task.lng != null;
        items.push({
          key: `task-${task.id}`,
          kind: "TASK",
          taskId: task.id,
          title: task.title,
          startTime: minToHhmm(startMin),
          endTime: minToHhmm(endMin),
          startMin,
          endMin,
          location: task.locationName || task.address || "No location set",
          hasLocation,
          isHard: !task.isFlexible || task.priority === "HIGH",
          exceedsFreeLimit: task.exceedsFreeLimit,
          partySize: task.partySize,
          status: task.status,
        });
      }

      items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

      // Assign side-by-side layout columns for overlapping blocks (matches S21 screenshot)
      const colEnds: number[] = [];
      for (const item of items) {
        let placed = -1;
        for (let c = 0; c < colEnds.length; c++) {
          if (colEnds[c] <= item.startMin) {
            placed = c;
            colEnds[c] = item.endMin;
            break;
          }
        }
        if (placed === -1) {
          placed = colEnds.length;
          colEnds.push(item.endMin);
        }
        item.col = placed;
      }
      for (const item of items) {
        const overlapping = items.filter(
          (other) => other.startMin < item.endMin && item.startMin < other.endMin
        );
        const maxCol = overlapping.reduce((m, o) => Math.max(m, o.col ?? 0), 0);
        item.cols = maxCol + 1;
      }

      return items;
    };
  }, [events, tasks]);

  const dayScheduleItems = useMemo(
    () => buildScheduleForDate(date),
    [buildScheduleForDate, date]
  );

  const todayIso = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: user.currentTimezone || "Asia/Almaty",
      }).format(new Date());
    } catch {
      return date;
    }
  }, [user.currentTimezone, date]);

  const callGoogleSync = async (
    action: "sync" | "sandbox_sync" | "toggle_all_day" | "revoke_sim" | "disconnect" | "token_sync",
    extra?: { accessToken?: string; importAllDay?: boolean }
  ) => {
    if (
      !isPro &&
      action !== "disconnect" &&
      action !== "toggle_all_day"
    ) {
      onOpenPaywall("Connect Google Calendar with Journo Pro.");
      return;
    }

    setBusyAction(`google_${action}`);
    try {
      const res = await fetch("/api/calendars/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, date, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify(data.error?.message || "Google Calendar sync failed.");
        return;
      }
      await onRefresh();
      if (action === "sandbox_sync" || action === "sync" || action === "token_sync") {
        onNotify(`Synced ${data.importedCount ?? 0} Google Calendar event(s) into today's plan.`);
      } else if (action === "disconnect") {
        onNotify("Google Calendar disconnected. Your planned stops remain safe.");
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportIcs = async (content: string) => {
    if (!isPro) {
      onOpenPaywall("Apple Calendar (.ics) import requires Journo Pro.");
      return;
    }
    if (!content.trim()) {
      onNotify("Paste .ics contents or choose an .ics file first.");
      return;
    }
    setBusyAction("apple_ics");
    try {
      const res = await fetch("/api/calendars/ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsContent: content, overrideDate: date }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify(data.error?.message || "Failed to parse .ics file.");
        return;
      }
      await onRefresh();
      setIcsText("");
      onNotify(`Imported ${data.importedCount ?? 1} Apple Calendar (.ics) event(s) for ${date}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSubmitCalendarModal = async (payload: {
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
    isFlexible: boolean;
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
    setBusyAction("create_event");
    try {
      if (editingTaskForLoc && payload.id) {
        const patchRes = await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: payload.id,
            title: payload.title,
            locationName: payload.locationName,
            address: payload.address,
            lat: payload.lat,
            lng: payload.lng,
            date: payload.date,
            windowStart: payload.windowStart,
            windowEnd: payload.windowEnd,
            durationMin: payload.durationMin,
            isFlexible: payload.isFlexible,
          }),
        });
        if (patchRes.ok) {
          await onRefresh();
          setEditingTaskForLoc(null);
          onNotify(`Updated "${payload.title}" in your schedule.`);
        }
        return;
      }

      const startTime = payload.windowStart || evStart || "15:00";
      const sMin = hhmmToMin(startTime) ?? 15 * 60;
      const endTime = payload.windowEnd || minToHhmm(sMin + (payload.durationMin || 45));

      if (payload.repeatConfig?.enabled) {
        const seriesRes = await fetch("/api/series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title,
            locationName: payload.locationName || payload.title,
            address: payload.address || user.homeAddress || user.currentCity,
            lat: payload.lat ?? user.homeLat,
            lng: payload.lng ?? user.homeLng,
            mode: payload.repeatConfig.mode,
            daysOfWeek: payload.repeatConfig.daysOfWeek,
            timesPerWeek: payload.repeatConfig.timesPerWeek,
            windowStart: startTime,
            windowEnd: endTime,
            durationMin: payload.durationMin || 45,
            isFlexible: payload.isFlexible,
            endType: payload.repeatConfig.endType,
            endDate: payload.repeatConfig.endDate,
            totalCount: payload.repeatConfig.totalCount,
            date: payload.date,
            createTodayOccurrence: true,
          }),
        });
        if (seriesRes.ok) {
          const data = await seriesRes.json();
          await onRefresh();
          if (payload.lat != null && onRecalculatePlan) {
            await onRecalculatePlan();
          }
          setShowEventModal(false);
          onNotify(
            `Repeating event added across ${data.createdCount ?? 1} scheduled day(s).`
          );
        }
        return;
      }

      const res = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          date: payload.date,
          startTime,
          endTime,
          isHard: !payload.isFlexible,
          locationName: payload.locationName,
          address: payload.address,
          lat: payload.lat,
          lng: payload.lng,
        }),
      });
      if (res.ok) {
        await onRefresh();
        if (payload.lat != null && onRecalculatePlan) {
          await onRecalculatePlan();
        }
        setShowEventModal(false);
        onNotify(
          payload.lat != null
            ? "Event added to your calendar and route!"
            : "Event saved to calendar (needs a location to join route)."
        );
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmDeleteEvent = async (
    id: string,
    recalculate: boolean,
    kind: "EVENT" | "TASK" = "EVENT"
  ) => {
    setBusyAction(`del_ev_${id}`);
    try {
      const endpoint =
        kind === "TASK"
          ? `/api/tasks?id=${encodeURIComponent(id)}`
          : `/api/calendars?id=${encodeURIComponent(id)}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
      });
      if (res.ok) {
        setPendingDeleteEvent(null);
        await onRefresh();
        if (recalculate && onRecalculatePlan) {
          await onRecalculatePlan();
          onNotify("Removed from calendar and route recalculated.");
        } else {
          onNotify("Removed from calendar.");
        }
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSeriesAction = async (
    id: string,
    action: "PAUSE" | "RESUME" | "COMPLETE" | "EXTEND_MONTH"
  ) => {
    setBusyAction(`series_${id}_${action}`);
    try {
      const res = await fetch("/api/series", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        await onRefresh();
        onNotify(`Recurring series updated (${action.toLowerCase().replace("_", " ")}).`);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveSeriesScopeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeries || !seriesEditTitle.trim()) return;
    setBusyAction("series_update");
    try {
      const res = await fetch("/api/series", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSeries.id,
          action: "UPDATE",
          scope: seriesEditScope,
          title: seriesEditTitle.trim(),
        }),
      });
      if (res.ok) {
        await onRefresh();
        setEditingSeries(null);
        onNotify(`Series updated with scope: ${seriesEditScope.replaceAll("_", " ")}.`);
      }
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Sub-Navigation Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#DFDBD0] bg-white p-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "grid", label: "Calendar Schedule" },
              { id: "connections", label: "Connected Calendars" },
              { id: "series", label: `Recurring Series (${series.length})` },
              { id: "people", label: "Spending & Vehicle" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[40px] rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                subTab === tab.id
                  ? "bg-[#2F453B] text-[#F6F4EF]"
                  : "text-[#5E766B] hover:bg-[#F6F4EF] hover:text-[#2F453B]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEvDate(date);
            setShowEventModal(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Event
        </Button>
      </div>

      {/* TAB 1: CONNECTIONS — Internal + Google Calendar + Apple .ics */}
      {subTab === "connections" && (
        <div className="space-y-3.5">
          {/* Journo Calendar (Always ON) */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#2F453B]" />
                  <h3 className="text-sm font-bold text-[#2F453B]">Journo Calendar</h3>
                  <Badge variant="safe">Always Active · Free &amp; Pro</Badge>
                </div>
                <p className="mt-1 text-xs text-[#5E766B]">
                  Your built-in schedule inside Journo. Any event with a place becomes a stop in your route automatically.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowEventModal(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add Event
              </Button>
            </div>
          </Card>

          {/* Google Calendar */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#C67D63]" />
                  <h3 className="text-sm font-bold text-[#2F453B]">Google Calendar</h3>
                  {googleConn?.status === "NEEDS_RECONNECT" ? (
                    <Badge variant="danger">Needs Reconnect</Badge>
                  ) : googleConn?.status === "CONNECTED" ? (
                    <Badge variant="safe">
                      Connected {googleConn.accountEmail ? `· ${googleConn.accountEmail}` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Not connected</Badge>
                  )}
                  {!isPro ? (
                    <Badge variant="coral">
                      <Lock className="mr-1 h-3 w-3" />
                      Pro
                    </Badge>
                  ) : null}
                </div>
                {googleConn?.status === "CONNECTED" && googleConn.accountEmail ? (
                  <p className="mt-1 text-xs font-semibold text-[#3F7A63]">
                    Connected Google account: <span className="underline">{googleConn.accountEmail}</span>
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-[#5E766B]">
                  Connect your Google account so your meetings appear in your daily route — Journo never edits or deletes your calendar.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={isPro ? "/api/auth/google?intent=calendar&next=/app" : "#"}
                  onClick={(e) => {
                    if (!isPro) {
                      e.preventDefault();
                      onOpenPaywall("Connect your Google Calendar with Journo Pro.");
                    }
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl bg-[#2F453B] px-4 py-2 text-xs font-semibold text-[#F6F4EF] hover:bg-[#3D564B]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect Google Calendar
                </a>
                <Button
                  variant="primary"
                  size="sm"
                  loading={busyAction === "google_sandbox_sync"}
                  onClick={() => callGoogleSync("sandbox_sync")}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Load Sample Meetings
                </Button>
              </div>
            </div>

            {googleConn?.status === "NEEDS_RECONNECT" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#B05454]/30 bg-[#F5E6E6] px-3.5 py-2.5 text-xs text-[#B05454]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Google Calendar access expired or was disconnected. Sign in again to keep syncing events.
                  </span>
                </div>
                <a
                  href="/api/auth/google?intent=calendar&next=/app"
                  className="font-bold underline"
                >
                  Reconnect Google
                </a>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#DFDBD0] pt-3">
              <Switch
                checked={Boolean(googleConn?.importAllDay)}
                onCheckedChange={(checked) =>
                  callGoogleSync("toggle_all_day", { importAllDay: checked })
                }
                label="Include all-day events in your plan"
              />

              <div className="flex flex-wrap items-center gap-2">
                {googleConn && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={busyAction === "google_sync"}
                      onClick={() => callGoogleSync("sync")}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Sync Now
                    </Button>
                    <button
                      type="button"
                      onClick={() => callGoogleSync("disconnect")}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#DFDBD0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#B05454] hover:bg-[#F5E6E6]"
                    >
                      <Unlink className="h-3 w-3" />
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Apple Calendar */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-[#3F7A63]" />
                  <h3 className="text-sm font-bold text-[#2F453B]">Apple Calendar</h3>
                  {!isPro ? (
                    <Badge variant="coral">Pro</Badge>
                  ) : appleConn ? (
                    <Badge variant="safe">Imported ({appleConn.lastSyncedAt ? "Active" : "Ready"})</Badge>
                  ) : (
                    <Badge variant="neutral">File / Paste</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#5E766B]">
                  Upload any standard <code className="font-semibold">.ics</code> calendar export from Apple Calendar to pull stops into {date}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF] px-3.5 text-xs font-semibold text-[#2F453B] hover:bg-[#ECE9E1]">
                  <FileUp className="h-3.5 w-3.5 text-[#C67D63]" />
                  Upload .ics File
                  <input
                    type="file"
                    accept=".ics,text/calendar"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const txt = await file.text();
                      setIcsText(txt);
                      await handleImportIcs(txt);
                    }}
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIcsText(SAMPLE_ASTANA_ICS)}
                >
                  Load Sample Astana .ics
                </Button>
              </div>
            </div>

            {icsText && (
              <div className="mt-3 space-y-2">
                <textarea
                  rows={4}
                  value={icsText}
                  onChange={(e) => setIcsText(e.target.value)}
                  className="w-full rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF]/50 p-3 font-mono text-[11px] text-[#2F453B]"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIcsText("")}>
                    Clear
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={busyAction === "apple_ics"}
                    onClick={() => handleImportIcs(icsText)}
                  >
                    Import .ics Events
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: CALENDAR SCHEDULE (S21 Day & S21b Week Views) */}
      {subTab === "grid" && (() => {
        const GRID_START_MIN = 8 * 60; // 08:00
        const GRID_END_MIN = 20 * 60; // 20:00
        const PX_PER_HOUR = 56;
        const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

        const missingLocItems = dayScheduleItems.filter((item) => !item.hasLocation);
        const overflowItems = dayScheduleItems.filter((item) => item.exceedsFreeLimit);

        const getBlockClasses = (item: ScheduleBlock) => {
          if (!item.hasLocation) {
            return "border border-dashed border-[#D6B476] bg-[#FAF3E3] text-[#2F453B]";
          }
          if (item.exceedsFreeLimit) {
            return "border border-[#DFDBD0] bg-[#ECE9E1] text-[#5E766B]";
          }
          if (item.provider === "GOOGLE") {
            return "border border-[#7D9CC9] bg-[#E3ECF7] text-[#1E3A5F]";
          }
          if (item.provider === "APPLE_ICS") {
            return "border border-[#5AA37E] bg-[#DFF2E8] text-[#1D4B35]";
          }
          return "border border-[#6DA389] bg-[#DCEBE3] text-[#1F3F31]";
        };

        const openSlotModal = (slotDate: string, hour: number) => {
          setEditingTaskForLoc(null);
          setEvDate(slotDate);
          setEvStart(`${String(hour).padStart(2, "0")}:00`);
          setEvEnd(`${String(Math.min(23, hour)).padStart(2, "0")}:45`);
          setEvIsHard(true);
          setShowEventModal(true);
        };

        return (
          <div className="space-y-4">
            {/* Top Calendar Bar (matches S21 / S21b screenshot) */}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#2F453B]">Calendar Schedule</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#5E766B]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#3F7A63]" />
                      Journo Calendar
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#5B82BD]" />
                      Google Calendar
                    </span>
                    {!isPro ? (
                      <span className="rounded-full bg-[#F6EFE2] px-2.5 py-0.5 font-semibold text-[#9C6B3B] tabular-nums">
                        Free limit: {freeLimitCount} of {freeLimitMax} tasks today
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Day | Week Segmented Switch */}
                  <div className="inline-flex rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setGridViewMode("day")}
                      className={`min-h-[34px] rounded-lg px-3 font-semibold transition-colors ${
                        gridViewMode === "day" ? "bg-white text-[#2F453B] shadow-xs" : "text-[#5E766B]"
                      }`}
                    >
                      Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setGridViewMode("week")}
                      className={`min-h-[34px] rounded-lg px-3 font-semibold transition-colors ${
                        gridViewMode === "week" ? "bg-white text-[#2F453B] shadow-xs" : "text-[#5E766B]"
                      }`}
                    >
                      Week
                    </button>
                  </div>

                  {/* < Date > Navigator */}
                  <div className="inline-flex items-center rounded-xl border border-[#DFDBD0] bg-[#FAF6EA] p-0.5 text-xs">
                    <button
                      type="button"
                      aria-label={gridViewMode === "week" ? "Previous week" : "Previous day"}
                      onClick={() => {
                        const prev = shiftIsoDate(date, gridViewMode === "week" ? -7 : -1);
                        onSelectDate?.(prev);
                        setEvDate(prev);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5E766B] hover:bg-white hover:text-[#2F453B]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectDate?.(todayIso);
                        setEvDate(todayIso);
                      }}
                      className="px-2.5 font-semibold text-[#2F453B] tabular-nums hover:underline"
                    >
                      {gridViewMode === "week" && weekDays.length === 7
                        ? `${weekDays[0].monthShort} ${weekDays[0].dayNum} – ${weekDays[6].monthShort} ${weekDays[6].dayNum}`
                        : date === todayIso
                          ? `Today · ${date.slice(5)}`
                          : date}
                    </button>
                    <button
                      type="button"
                      aria-label={gridViewMode === "week" ? "Next week" : "Next day"}
                      onClick={() => {
                        const next = shiftIsoDate(date, gridViewMode === "week" ? 7 : 1);
                        onSelectDate?.(next);
                        setEvDate(next);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5E766B] hover:bg-white hover:text-[#2F453B]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingTaskForLoc(null);
                      setEvDate(date);
                      setEvStart("15:00");
                      setEvEnd("15:45");
                      setEvIsHard(true);
                      setShowEventModal(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Event
                  </Button>
                </div>
              </div>
            </Card>

            {gridViewMode === "day" ? (
              <div className="grid gap-4 lg:grid-cols-12">
                {/* S21 Day Timeline Grid */}
                <div className="lg:col-span-8">
                  <Card className="p-0 overflow-hidden">
                    <div className="relative flex bg-[#FAF6EA]/40">
                      {/* Hour Labels Gutter */}
                      <div className="w-16 shrink-0 border-r border-[#DFDBD0]/80 bg-white/70 select-none">
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            style={{ height: `${PX_PER_HOUR}px` }}
                            className="pr-2.5 pt-1 text-right text-[11px] font-medium tabular-nums text-[#5E766B]"
                          >
                            {`${String(hour).padStart(2, "0")}:00`}
                          </div>
                        ))}
                      </div>

                      {/* Hourly Interactive Rows + Positioned Event Blocks */}
                      <div
                        className="relative flex-1"
                        style={{ height: `${HOURS.length * PX_PER_HOUR}px` }}
                      >
                        {HOURS.map((hour) => (
                          <button
                            key={hour}
                            type="button"
                            onClick={() => openSlotModal(date, hour)}
                            aria-label={`Add event at ${String(hour).padStart(2, "0")}:00`}
                            style={{ height: `${PX_PER_HOUR}px` }}
                            className="block w-full border-b border-[#DFDBD0]/60 text-left hover:bg-white/60 transition-colors cursor-pointer"
                          />
                        ))}

                        {/* Positioned Colored Calendar Blocks */}
                        {dayScheduleItems.map((item) => {
                          const clampedStart = Math.max(GRID_START_MIN, Math.min(GRID_END_MIN - 25, item.startMin));
                          const clampedEnd = Math.min(GRID_END_MIN, Math.max(clampedStart + 25, item.endMin));
                          const topPx = ((clampedStart - GRID_START_MIN) / 60) * PX_PER_HOUR + 2;
                          const heightPx = Math.max(28, ((clampedEnd - clampedStart) / 60) * PX_PER_HOUR - 4);
                          const totalCols = Math.max(1, item.cols ?? 1);
                          const colIdx = item.col ?? 0;
                          const widthPct = 100 / totalCols;
                          const leftPct = colIdx * widthPct;

                          return (
                            <div
                              key={item.key}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                left: `calc(${leftPct}% + 6px)`,
                                width: `calc(${widthPct}% - 12px)`,
                              }}
                              className={`absolute z-10 flex items-start justify-between gap-2 overflow-hidden rounded-xl px-3 py-1.5 shadow-xs ${getBlockClasses(
                                item
                              )}`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate text-xs font-bold leading-tight">
                                    {item.title}
                                  </span>
                                  {item.isHard && !item.exceedsFreeLimit ? (
                                    <span className="shrink-0 rounded bg-white/75 px-1.5 py-0.5 text-[10px] font-semibold text-[#9C6B3B]">
                                      Fixed
                                    </span>
                                  ) : null}
                                  {!item.hasLocation ? (
                                    <span className="shrink-0 rounded bg-[#E6D6B8] px-1.5 py-0.5 text-[10px] font-semibold text-[#75512B]">
                                      No place
                                    </span>
                                  ) : null}
                                  {item.exceedsFreeLimit ? (
                                    <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-[#5E766B]">
                                      Not in plan
                                    </span>
                                  ) : null}
                                </div>
                                {heightPx >= 42 ? (
                                  <div className="mt-0.5 truncate text-[11px] opacity-80 tabular-nums">
                                    {item.startTime}–{item.endTime} · {item.location}
                                  </div>
                                ) : null}
                              </div>

                              {(item.eventId || item.taskId) ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const deleteAsEvent =
                                      item.kind === "EVENT" &&
                                      Boolean(item.eventId);
                                    const targetId = deleteAsEvent
                                      ? item.eventId!
                                      : item.taskId || item.eventId!;
                                    setPendingDeleteEvent({
                                      id: targetId,
                                      kind: deleteAsEvent || !item.taskId ? "EVENT" : "TASK",
                                      title: item.title,
                                      date,
                                      startTime: item.startTime,
                                      endTime: item.endTime,
                                    });
                                  }}
                                  aria-label={`Delete ${item.title}`}
                                  title="Delete from calendar"
                                  className="shrink-0 rounded-lg p-1 text-[#B05454] hover:bg-white/70 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Right Sidebar: Free Limit + Needs Attention (matches S21 screenshot) */}
                <div className="space-y-3 lg:col-span-4">
                  {!isPro ? (
                    <Card>
                      <div className="text-[11px] font-semibold text-[#5E766B]">Free plan limit</div>
                      <div className="mt-1 text-xl font-bold text-[#2F453B] tabular-nums">
                        {freeLimitCount} of {freeLimitMax}
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#ECE9E1]">
                        <div
                          className={`h-full transition-[width] duration-200 ${
                            freeLimitCount >= freeLimitMax ? "bg-[#C67D63]" : "bg-[#3F7A63]"
                          }`}
                          style={{
                            width: `${Math.min(100, (freeLimitCount / Math.max(1, freeLimitMax)) * 100)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[#5E766B]">
                        Events with an address count toward your {freeLimitMax} routed stops per date.
                      </p>
                    </Card>
                  ) : null}

                  <Card>
                    <h4 className="text-sm font-bold text-[#2F453B]">Needs Attention</h4>
                    {missingLocItems.length === 0 && overflowItems.length === 0 ? (
                      <p className="mt-2 text-xs text-[#5E766B]">
                        All scheduled stops for {date} have places and fit in your route.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2.5">
                        {missingLocItems.map((item) => {
                          const linkedTask = tasks.find((t) => t.id === item.taskId);
                          return (
                            <div
                              key={item.key}
                              className="rounded-xl border border-[#DFDBD0] bg-[#FAF6EA]/60 p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-xs font-bold text-[#2F453B]">
                                  {item.title}
                                </span>
                                <span className="shrink-0 rounded bg-[#F6EFE2] px-2 py-0.5 text-[10px] font-semibold text-[#9C6B3B]">
                                  No place
                                </span>
                              </div>
                              {linkedTask ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => {
                                    setEditingTaskForLoc(linkedTask);
                                    setShowEventModal(true);
                                  }}
                                >
                                  <MapPin className="h-3.5 w-3.5 text-[#C67D63]" />
                                  Add location
                                </Button>
                              ) : null}
                            </div>
                          );
                        })}

                        {overflowItems.map((item) => (
                          <div
                            key={item.key}
                            className="rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-bold text-[#2F453B]">
                                {item.title}
                              </span>
                              <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-[#5E766B]">
                                Over Free limit
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                onOpenPaywall("Include more than 5 stops in one daily route.")
                              }
                            >
                              Unlock in Pro
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <div className="rounded-2xl border border-[#DFDBD0] bg-[#ECE9E1]/60 p-3 text-xs text-[#5E766B]">
                    No place yet? The event stays safely in your calendar and enters your route as soon as you add an address.
                  </div>
                </div>
              </div>
            ) : (
              /* S21b 7-Day Week Hourly Column Grid */
              <Card className="p-0 overflow-x-auto">
                <div className="min-w-[760px]">
                  {/* Week Day Headers */}
                  <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-[#DFDBD0] bg-white">
                    <div className="border-r border-[#DFDBD0]" />
                    {weekDays.map((day) => {
                      const isSelected = day.iso === date;
                      return (
                        <button
                          key={day.iso}
                          type="button"
                          onClick={() => {
                            onSelectDate?.(day.iso);
                            setEvDate(day.iso);
                          }}
                          className={`border-r border-[#DFDBD0] last:border-r-0 py-2.5 text-center text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[#DCEBE3]/60 font-bold text-[#2F453B]"
                              : "text-[#5E766B] hover:bg-[#FAF6EA]"
                          }`}
                        >
                          <span className="uppercase">{day.weekday}</span>{" "}
                          <span className="tabular-nums">{day.dayNum}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Week Hourly Columns */}
                  <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))] bg-[#FAF6EA]/30">
                    {/* Time Gutter */}
                    <div className="border-r border-[#DFDBD0] bg-white/80 select-none">
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          style={{ height: `${PX_PER_HOUR}px` }}
                          className="pr-2 pt-1 text-right text-[11px] font-medium tabular-nums text-[#5E766B]"
                        >
                          {`${String(hour).padStart(2, "0")}:00`}
                        </div>
                      ))}
                    </div>

                    {/* 7 Day Columns */}
                    {weekDays.map((day) => {
                      const colItems = buildScheduleForDate(day.iso);
                      const isSelected = day.iso === date;
                      return (
                        <div
                          key={day.iso}
                          className={`relative border-r border-[#DFDBD0] last:border-r-0 ${
                            isSelected ? "bg-white/40" : ""
                          }`}
                          style={{ height: `${HOURS.length * PX_PER_HOUR}px` }}
                        >
                          {HOURS.map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => openSlotModal(day.iso, hour)}
                              aria-label={`Add event on ${day.iso} at ${String(hour).padStart(2, "0")}:00`}
                              style={{ height: `${PX_PER_HOUR}px` }}
                              className="block w-full border-b border-[#DFDBD0]/55 hover:bg-white/70 cursor-pointer"
                            />
                          ))}

                          {colItems.map((item) => {
                            const clampedStart = Math.max(GRID_START_MIN, Math.min(GRID_END_MIN - 25, item.startMin));
                            const clampedEnd = Math.min(GRID_END_MIN, Math.max(clampedStart + 25, item.endMin));
                            const topPx = ((clampedStart - GRID_START_MIN) / 60) * PX_PER_HOUR + 2;
                            const heightPx = Math.max(24, ((clampedEnd - clampedStart) / 60) * PX_PER_HOUR - 4);

                            return (
                              <div
                                key={item.key}
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                title={`${item.title} (${item.startTime}–${item.endTime})`}
                                className={`group absolute inset-x-1 z-10 flex items-start justify-between gap-1 overflow-hidden rounded-lg px-2 py-1 text-[11px] shadow-xs ${getBlockClasses(
                                  item
                                )}`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-bold leading-tight">{item.title}</div>
                                  {heightPx >= 38 ? (
                                    <div className="truncate text-[10px] opacity-75 tabular-nums">
                                      {item.startTime}
                                    </div>
                                  ) : null}
                                </div>
                                {(item.eventId || item.taskId) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const deleteAsEvent =
                                        item.kind === "EVENT" &&
                                        Boolean(item.eventId);
                                      const targetId = deleteAsEvent
                                        ? item.eventId!
                                        : item.taskId || item.eventId!;
                                      setPendingDeleteEvent({
                                        id: targetId,
                                        kind: deleteAsEvent || !item.taskId ? "EVENT" : "TASK",
                                        title: item.title,
                                        date: day.iso,
                                        startTime: item.startTime,
                                        endTime: item.endTime,
                                      });
                                    }}
                                    aria-label={`Delete ${item.title}`}
                                    className="shrink-0 rounded p-0.5 text-[#B05454] opacity-75 hover:bg-white/80 hover:opacity-100 cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}
          </div>
        );
      })()}

      {/* TAB 3: RECURRING SERIES (S21) */}
      {subTab === "series" && (
        <div className="space-y-3">
          {series.length === 0 ? (
            <Card className="p-6 text-center text-xs text-[#5E766B]">
              No recurring series yet. Create one in <strong>+ Add Task → Make Recurring Series</strong>.
            </Card>
          ) : (
            series.map((item) => {
              const pct = Math.min(
                100,
                Math.round((item.completedCount / Math.max(1, item.totalCount)) * 100)
              );
              return (
                <Card key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Repeat className="h-4 w-4 text-[#C67D63]" />
                        <h3 className="text-sm font-bold text-[#2F453B]">{item.title}</h3>
                        <Badge
                          variant={
                            item.status === "ACTIVE"
                              ? "safe"
                              : item.status === "PAUSED"
                              ? "warn"
                              : "neutral"
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-[#5E766B]">
                        {item.locationName} ·{" "}
                        {item.mode === "SPECIFIC_DAYS"
                          ? item.daysOfWeek || "Custom days"
                          : `${item.timesPerWeek ?? 3}× / week`}{" "}
                        · Window {item.windowStart || "Flexible"}
                      </div>
                    </div>

                    <div className="text-right tabular-nums">
                      <div className="text-sm font-bold text-[#2F453B]">
                        {item.completedCount} / {item.totalCount}
                      </div>
                      <div className="text-[11px] text-[#5E766B]">Ends {item.endDate}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#F6F4EF]">
                    <div
                      className="h-full rounded-full bg-[#C67D63] transition-[width] duration-200 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status === "ACTIVE" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        loading={busyAction === `series_${item.id}_PAUSE`}
                        onClick={() => handleSeriesAction(item.id, "PAUSE")}
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busyAction === `series_${item.id}_RESUME`}
                        onClick={() => handleSeriesAction(item.id, "RESUME")}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      loading={busyAction === `series_${item.id}_EXTEND_MONTH`}
                      onClick={() => handleSeriesAction(item.id, "EXTEND_MONTH")}
                    >
                      +1 Month
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingSeries(item);
                        setSeriesEditTitle(item.title);
                        setSeriesEditScope("ALL");
                      }}
                    >
                      Edit Scope
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TAB 4: SELF-LEARNING PRICE INTELLIGENCE, VEHICLE/TRANSIT PROFILE & PEOPLE V2 RESERVE (S19) */}
      {subTab === "people" && (
        <div className="space-y-4">
          {/* Self-Learning Personal Price Intelligence */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2F453B] text-[#F6F4EF]">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[#2F453B]">
                      Your Place Spending Memory
                    </h3>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#5E766B]">
                    On your first visit to a place, Journo uses typical local prices. Each time you
                    save a receipt, future estimates automatically reflect what you actually spend.
                  </p>
                </div>
              </div>
              {onResetPriceIntel ? (
                <Button variant="secondary" size="sm" onClick={onResetPriceIntel}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset Spending History
                </Button>
              ) : null}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DFDBD0] text-[11px] font-semibold uppercase tracking-wide text-[#5E766B]">
                    <th className="py-2 pr-3">Venue</th>
                    <th className="py-2 px-3">Visits</th>
                    <th className="py-2 px-3">Your Avg / Person</th>
                    <th className="py-2 px-3">Typical Local Price</th>
                    <th className="py-2 pl-3">Estimate Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFDBD0]/60 tabular-nums">
                  {priceIntel.map((item) => {
                    const activePersonal = item.visitCount >= 1;
                    return (
                      <tr key={item.venueKey} className="text-[#2F453B]">
                        <td className="py-2.5 pr-3">
                          <div className="font-bold">{item.venueName}</div>
                          <div className="text-[11px] text-[#5E766B]">{item.category}</div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{item.visitCount}</td>
                        <td className="py-2.5 px-3 font-bold text-[#C67D63]">
                          {item.visitCount > 0 ? `$${item.avgSpendPerPerson.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[#5E766B]">
                          ${item.benchmarkPerPerson.toFixed(2)}
                        </td>
                        <td className="py-2.5 pl-3">
                          <Badge variant={activePersonal ? "safe" : "neutral"}>
                            {activePersonal
                              ? "Your history"
                              : "Local estimate"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Vehicle & Transit Cost Profile */}
          {transportProfile && onUpdateTransportProfile ? (
            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-[#2F453B]">
                    Vehicle &amp; Transit Cost Profile
                  </h3>
                </div>
                <div className="inline-flex rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTransportProfile({ ...transportProfile, vehicleType: "GAS" })
                    }
                    className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-3 font-semibold cursor-pointer ${
                      transportProfile.vehicleType === "GAS"
                        ? "bg-[#2F453B] text-[#F6F4EF]"
                        : "text-[#5E766B]"
                    }`}
                  >
                    <Fuel className="h-3.5 w-3.5" aria-hidden="true" />
                    Gas (MPG)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTransportProfile({ ...transportProfile, vehicleType: "EV" })
                    }
                    className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-3 font-semibold cursor-pointer ${
                      transportProfile.vehicleType === "EV"
                        ? "bg-[#2F453B] text-[#F6F4EF]"
                        : "text-[#5E766B]"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                    EV (kWh)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs tabular-nums">
                {transportProfile.vehicleType === "GAS" ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5E766B] mb-1">
                        Fuel Efficiency (MPG)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        className={inputClass}
                        value={transportProfile.fuelEfficiencyMpg}
                        onChange={(e) =>
                          onUpdateTransportProfile({
                            ...transportProfile,
                            fuelEfficiencyMpg: Math.max(5, Number(e.target.value) || 28),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5E766B] mb-1">
                        Gas Price ($ / gal)
                      </label>
                      <input
                        type="number"
                        min={0.5}
                        step="0.05"
                        className={inputClass}
                        value={transportProfile.gasPricePerGal}
                        onChange={(e) =>
                          onUpdateTransportProfile({
                            ...transportProfile,
                            gasPricePerGal: Math.max(0.5, Number(e.target.value) || 3.45),
                          })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5E766B] mb-1">
                        EV Draw (kWh / 100km)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={45}
                        step="0.5"
                        className={inputClass}
                        value={transportProfile.evKwhPer100Km}
                        onChange={(e) =>
                          onUpdateTransportProfile({
                            ...transportProfile,
                            evKwhPer100Km: Math.max(5, Number(e.target.value) || 17.5),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5E766B] mb-1">
                        Charging ($ / kWh)
                      </label>
                      <input
                        type="number"
                        min={0.02}
                        step="0.01"
                        className={inputClass}
                        value={transportProfile.elecPricePerKwh}
                        onChange={(e) =>
                          onUpdateTransportProfile({
                            ...transportProfile,
                            elecPricePerKwh: Math.max(0.02, Number(e.target.value) || 0.16),
                          })
                        }
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-[#5E766B] mb-1">
                    Avg Parking Fee ($ / stop)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    className={inputClass}
                    value={transportProfile.defaultParkingCost}
                    onChange={(e) =>
                      onUpdateTransportProfile({
                        ...transportProfile,
                        defaultParkingCost: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#5E766B] mb-1">
                    Transit Fare / Daily Cap ($)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      aria-label="Transit base fare"
                      className={inputClass}
                      value={transportProfile.transitBaseFare}
                      onChange={(e) =>
                        onUpdateTransportProfile({
                          ...transportProfile,
                          transitBaseFare: Math.max(0, Number(e.target.value) || 0.5),
                        })
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      aria-label="Transit daily cap per person"
                      className={inputClass}
                      value={transportProfile.transitDailyCapPerPerson}
                      onChange={(e) =>
                        onUpdateTransportProfile({
                          ...transportProfile,
                          transitDailyCapPerPerson: Math.max(0, Number(e.target.value) || 2),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF]/65 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-xs text-[#2F453B]">
                  <Car className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                  <span>
                    <strong>No personal car:</strong> hide car fuel &amp; parking estimates and compare Walk, Transit, Taxi &amp; Friends Ride instead.
                  </span>
                </div>
                <Switch
                  checked={transportProfile.hasPersonalCar === false}
                  onCheckedChange={(checked) =>
                    onUpdateTransportProfile({
                      ...transportProfile,
                      hasPersonalCar: !checked,
                    })
                  }
                  label="I do not own a personal car"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF]/65 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-xs text-[#2F453B]">
                  <TrainFront className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                  <span>
                    <strong>Unlimited Monthly Transit Pass:</strong> sets per-ride Bus/Metro/LRT cost to $0.00 across your daily route.
                  </span>
                </div>
                <Switch
                  checked={transportProfile.hasUnlimitedTransitPass}
                  onCheckedChange={(checked) =>
                    onUpdateTransportProfile({
                      ...transportProfile,
                      hasUnlimitedTransitPass: checked,
                    })
                  }
                  label="Unlimited transit pass"
                />
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2F453B] text-[#F6F4EF]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#2F453B]">
                    Share &amp; Handoff Errands
                  </h3>
                  <Badge variant="neutral">Coming Soon</Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#5E766B]">
                  Soon you&apos;ll be able to share a single errand stop (like a pharmacy pickup) with a family member or friend — with live ETA updates while keeping the rest of your schedule private.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Unified Calendar Event Form (matches Day Task & Quick Add) */}
      <TaskFormModal
        isOpen={showEventModal}
        mode="calendar"
        date={evDate}
        city={user.currentCity}
        editingTask={editingTaskForLoc}
        initialWindowStart={evStart}
        initialWindowEnd={evEnd}
        initialIsFlexible={!evIsHard}
        allowLocationless={!editingTaskForLoc}
        priceIntel={priceIntel}
        onClose={() => {
          setShowEventModal(false);
          setEditingTaskForLoc(null);
        }}
        onSubmitTask={handleSubmitCalendarModal}
      />

      {/* S21c Delete Event Confirmation Modal */}
      <Modal
        isOpen={Boolean(pendingDeleteEvent)}
        onClose={() => setPendingDeleteEvent(null)}
        title="Delete event?"
        subtitle={
          pendingDeleteEvent
            ? `${pendingDeleteEvent.title} · ${pendingDeleteEvent.date}, ${pendingDeleteEvent.startTime}–${pendingDeleteEvent.endTime}`
            : undefined
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-[#5E766B]">
            The linked stop will be removed from your plan while the rest of your schedule stays in place.
          </p>
          <div className="rounded-xl bg-[#E6F1EC] px-3.5 py-2.5 text-xs text-[#2F453B]">
            Recalculate your route now? On Pro, routes update automatically.
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={busyAction === `del_ev_${pendingDeleteEvent?.id}`}
              onClick={() =>
                pendingDeleteEvent &&
                handleConfirmDeleteEvent(pendingDeleteEvent.id, false, pendingDeleteEvent.kind)
              }
            >
              Delete without recalculating
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={busyAction === `del_ev_${pendingDeleteEvent?.id}`}
              onClick={() =>
                pendingDeleteEvent &&
                handleConfirmDeleteEvent(pendingDeleteEvent.id, true, pendingDeleteEvent.kind)
              }
            >
              Delete &amp; Recalculate
            </Button>
          </div>
        </div>
      </Modal>

      {/* S21 Series Edit Scope Modal */}
      <Modal
        isOpen={Boolean(editingSeries)}
        onClose={() => setEditingSeries(null)}
        title="Edit Recurring Series Scope"
        subtitle="Choose whether edits affect only one instance, future instances, or the whole series."
      >
        <form onSubmit={handleSaveSeriesScopeEdit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#2F453B]">Series Title</label>
            <input
              type="text"
              required
              className={inputClass}
              value={seriesEditTitle}
              onChange={(e) => setSeriesEditTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {(
              [
                { id: "THIS_ONLY", label: "Only this occurrence" },
                { id: "THIS_AND_FOLLOWING", label: "This & following occurrences" },
                { id: "ALL", label: "Entire series" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-2 text-xs font-semibold ${
                  seriesEditScope === opt.id
                    ? "border-[#C67D63] bg-[#F4E8E3] text-[#2F453B]"
                    : "border-[#DFDBD0] bg-white text-[#5E766B]"
                }`}
              >
                <input
                  type="radio"
                  name="series-scope"
                  checked={seriesEditScope === opt.id}
                  onChange={() => setSeriesEditScope(opt.id)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditingSeries(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busyAction === "series_update"}>
              Apply Scope Update
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
