"use client";

import React, { useMemo, useState } from "react";
import {
  Building2,
  Globe,
  Home,
  MapPin,
  Plane,
  Repeat,
} from "lucide-react";
import { CITY_PRESETS } from "@/lib/astana-places";
import { TaskItem, TaskSeriesItem, UserProfile } from "@/lib/types";
import { Badge, Button, Modal, Switch, inputClass } from "@/components/ui/primitives";

interface CitySwitchModalProps {
  isOpen: boolean;
  user: UserProfile;
  tasks: TaskItem[];
  series: TaskSeriesItem[];
  onClose: () => void;
  onSwitched: (updatedUser: UserProfile) => Promise<void>;
}

export function CitySwitchModal({
  isOpen,
  user,
  tasks,
  series,
  onClose,
  onSwitched,
}: CitySwitchModalProps) {
  const defaultTarget =
    CITY_PRESETS.find((c) => c.name !== user.currentCity)?.name ?? "London";
  const [targetCity, setTargetCity] = useState<"Astana" | "Almaty" | "London" | "Tokyo">(
    defaultTarget
  );
  const selectedPreset = useMemo(
    () => CITY_PRESETS.find((c) => c.name === targetCity) ?? CITY_PRESETS[0],
    [targetCity]
  );

  const [tempBaseAddress, setTempBaseAddress] = useState<string>(
    selectedPreset.suggestedTempBase.address
  );
  const [pauseActiveSeries, setPauseActiveSeries] = useState(
    selectedPreset.name !== user.homeCity
  );
  const [decisions, setDecisions] = useState<
    Record<string, "KEEP" | "RESCHEDULE" | "DELETE">
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const urgentOldCityTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.city === user.currentCity &&
          t.status !== "DONE" &&
          t.status !== "SKIPPED" &&
          (!t.isFlexible || t.priority === "HIGH")
      ),
    [tasks, user.currentCity]
  );

  const activeSeriesCount = series.filter((s) => s.status === "ACTIVE").length;
  const returningHome = targetCity === user.homeCity;

  const handleSelectCity = (name: "Astana" | "Almaty" | "London" | "Tokyo") => {
    setTargetCity(name);
    const nextPreset = CITY_PRESETS.find((c) => c.name === name);
    if (nextPreset) {
      setTempBaseAddress(nextPreset.suggestedTempBase.address);
      setPauseActiveSeries(name !== user.homeCity);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const urgentDecisions = urgentOldCityTasks.map((t) => ({
        taskId: t.id,
        decision: decisions[t.id] ?? "KEEP",
      }));

      const res = await fetch("/api/city-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCity,
          tempBaseAddress: returningHome ? null : tempBaseAddress,
          tempBaseLat: returningHome ? null : selectedPreset.suggestedTempBase.lat,
          tempBaseLng: returningHome ? null : selectedPreset.suggestedTempBase.lng,
          pauseActiveSeries: returningHome ? false : pauseActiveSeries,
          urgentDecisions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || "Failed to switch city.");
        return;
      }
      await onSwitched(data.user);
      onClose();
    } catch {
      setErrorMsg("Network error while updating city & timezone.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="City & Timezone Switch"
      subtitle={`Currently planning in ${user.currentCity}. Switching adjusts your map and local time without affecting your saved routines.`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* City Preset Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {CITY_PRESETS.map((city) => {
            const active = city.name === targetCity;
            const isHome = city.name === user.homeCity;
            return (
              <button
                key={city.name}
                type="button"
                onClick={() => handleSelectCity(city.name)}
                className={`min-h-[70px] rounded-2xl border-2 p-3 text-left transition-[border-color,background-color] duration-150 ease-out ${
                  active
                    ? "border-[#C67D63] bg-[#F4E8E3]"
                    : "border-[#DFDBD0] bg-white hover:border-[#2F453B]/35"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold text-[#2F453B]">{city.name}</span>
                  <Badge variant={isHome ? "forest" : "neutral"}>
                    {isHome ? "Home" : city.utcOffsetLabel}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#5E766B]">
                  {isHome ? <Home className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
                  <span>
                    {city.country} · {city.timezone}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Temporary Base or Returning Home Card */}
        {returningHome ? (
          <div className="flex items-start gap-2.5 rounded-2xl border border-[#3F7A63]/25 bg-[#3F7A63]/10 px-4 py-3 text-xs text-[#2F453B]">
            <Home className="mt-0.5 h-4 w-4 shrink-0 text-[#3F7A63]" />
            <span>
              <strong>Welcome back to {user.homeCity}:</strong> Journo restores your Home address (
              {user.homeAddress}) and clears your temporary travel base.
            </span>
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF]/60 p-3.5">
            <label
              htmlFor="temp-base-address"
              className="flex items-center gap-1.5 text-xs font-bold text-[#2F453B]"
            >
              <Building2 className="h-4 w-4 text-[#C67D63]" />
              Temporary Base / Hotel in {selectedPreset.name}
            </label>
            <input
              id="temp-base-address"
              type="text"
              className={inputClass}
              value={tempBaseAddress}
              onChange={(e) => setTempBaseAddress(e.target.value)}
            />
            <p className="text-[11px] text-[#5E766B]">
              Routes in {selectedPreset.name} start from this temporary address ({selectedPreset.suggestedTempBase.name}). Your Home remains saved safely.
            </p>
          </div>
        )}

        {/* Active Recurring Series Choice */}
        {!returningHome && activeSeriesCount > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#DFDBD0] bg-white px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-[#C67D63]" />
              <div>
                <div className="text-xs font-bold text-[#2F453B]">
                  Pause {activeSeriesCount} active home recurring series?
                </div>
                <div className="text-[11px] text-[#5E766B]">
                  Pauses home habits (e.g. Gym) while you are away so they don&apos;t mark missed.
                </div>
              </div>
            </div>
            <Switch
              checked={pauseActiveSeries}
              onCheckedChange={setPauseActiveSeries}
              label="Pause active recurring series"
            />
          </div>
        )}

        {/* Urgent Tasks in Current City Triage (F7 Step 4) */}
        {urgentOldCityTasks.length > 0 && targetCity !== user.currentCity && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5E766B]">
                Urgent Tasks in {user.currentCity} ({urgentOldCityTasks.length})
              </span>
              <Badge variant="warn">Dual-TZ Aware</Badge>
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {urgentOldCityTasks.map((task) => {
                const choice = decisions[task.id] ?? "KEEP";
                return (
                  <div
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#DFDBD0] bg-white px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#2F453B]">{task.title}</div>
                      <div className="text-[11px] text-[#5E766B] tabular-nums">
                        {task.windowStart || "Flexible"} · {task.city}
                      </div>
                    </div>
                    <div className="inline-flex rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] p-0.5 text-[11px]">
                      {(
                        [
                          { id: "KEEP", label: "Keep (Dual-TZ)" },
                          { id: "RESCHEDULE", label: "+7 Days" },
                          { id: "DELETE", label: "Delete" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setDecisions((prev) => ({ ...prev, [task.id]: opt.id }))
                          }
                          className={`rounded-lg px-2 py-1 font-semibold transition-colors ${
                            choice === opt.id
                              ? "bg-[#2F453B] text-white"
                              : "text-[#5E766B] hover:text-[#2F453B]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-[#B05454]/30 bg-[#F5E6E6] px-3.5 py-2.5 text-xs text-[#B05454]">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#DFDBD0] pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            <Globe className="h-4 w-4" />
            Switch to {selectedPreset.name} ({selectedPreset.utcOffsetLabel})
          </Button>
        </div>
      </form>
    </Modal>
  );
}
