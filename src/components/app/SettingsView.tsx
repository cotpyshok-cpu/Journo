"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  Car,
  Clock,
  Download,
  Footprints,
  Globe,
  Home,
  RefreshCw,
  Sparkles,
  TrainFront,
  Trash2,
} from "lucide-react";
import { PlacePreset, searchPlacesLocal } from "@/lib/astana-places";
import { resolveAddressWithLiveFallback, searchLivePlaces } from "@/lib/geocode-client";
import {
  SystemSimulationFlags,
  TransportCostProfile,
  TransportPref,
  UserProfile,
} from "@/lib/types";
import { Badge, Button, Card, Switch, inputClass } from "@/components/ui/primitives";

interface SettingsViewProps {
  user: UserProfile;
  simFlags: SystemSimulationFlags;
  transportProfile?: TransportCostProfile;
  onUpdateTransportProfile?: (next: TransportCostProfile) => void;
  onSaveProfile: (patch: Partial<UserProfile>) => Promise<void>;
  onOpenCitySwitch: () => void;
  onOpenPaywall: (reason: string) => void;
  onTriggerTestPush: () => Promise<void>;
  onToggleSimFlag: (key: keyof SystemSimulationFlags) => void;
  onRefreshSubscription: () => Promise<void>;
  onCancelPro: () => Promise<void>;
  onDeleteAccountConfirmed: () => Promise<void>;
}

export function SettingsView({
  user,
  simFlags: _simFlags,
  transportProfile,
  onUpdateTransportProfile,
  onSaveProfile,
  onOpenCitySwitch,
  onOpenPaywall,
  onTriggerTestPush,
  onToggleSimFlag: _onToggleSimFlag,
  onRefreshSubscription,
  onCancelPro,
  onDeleteAccountConfirmed,
}: SettingsViewProps) {
  void _simFlags;
  void _onToggleSimFlag;
  const [homeAddress, setHomeAddress] = useState(user.homeAddress);
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>({
    lat: user.homeLat,
    lng: user.homeLng,
  });
  const [workAddress, setWorkAddress] = useState(user.workAddress ?? "");
  const [workCoords, setWorkCoords] = useState<{ lat: number; lng: number } | null>(
    user.workLat != null && user.workLng != null
      ? { lat: user.workLat, lng: user.workLng }
      : null
  );
  const [delayThreshold, setDelayThreshold] = useState(user.delayThresholdMin);
  const [quietStart, setQuietStart] = useState(user.quietHoursStart);
  const [quietEnd, setQuietEnd] = useState(user.quietHoursEnd);
  const [saving, setSaving] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [liveHomeMatches, setLiveHomeMatches] = useState<PlacePreset[]>([]);
  const [liveWorkMatches, setLiveWorkMatches] = useState<PlacePreset[]>([]);

  useEffect(() => {
    const q = homeAddress.trim();
    if (q.length < 2) {
      setLiveHomeMatches([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const res = await searchLivePlaces(q, user.currentCity, controller.signal);
      setLiveHomeMatches(res.slice(0, 5));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [homeAddress, user.currentCity]);

  useEffect(() => {
    const q = workAddress.trim();
    if (q.length < 2) {
      setLiveWorkMatches([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const res = await searchLivePlaces(q, user.currentCity, controller.signal);
      setLiveWorkMatches(res.slice(0, 5));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [workAddress, user.currentCity]);

  const homeMatches =
    liveHomeMatches.length > 0
      ? liveHomeMatches
      : searchPlacesLocal(homeAddress, user.currentCity).slice(0, 4);
  const workMatches =
    liveWorkMatches.length > 0
      ? liveWorkMatches
      : searchPlacesLocal(workAddress, user.currentCity).slice(0, 4);

  const handleSaveAddressesAndAlerts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanHome = homeAddress.trim() || user.homeAddress;
      const resolvedHome =
        homeCoords ?? (await resolveAddressWithLiveFallback(cleanHome, user.currentCity));
      const cleanWork = workAddress.trim();
      const resolvedWork = cleanWork
        ? workCoords ?? (await resolveAddressWithLiveFallback(cleanWork, user.currentCity))
        : null;
      await onSaveProfile({
        homeAddress: cleanHome,
        homeLat: resolvedHome.lat,
        homeLng: resolvedHome.lng,
        workAddress: cleanWork || null,
        workLat: resolvedWork?.lat ?? null,
        workLng: resolvedWork?.lng ?? null,
        delayThresholdMin: delayThreshold,
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile & Plan Summary */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#2F453B]">{user.name}</h2>
              <Badge variant={user.tier === "FREE" ? "neutral" : "coral"}>
                {user.tier}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-[#5E766B]">{user.email}</p>
            {user.subscriptionEndsAt && (
              <p className="mt-0.5 text-[11px] tabular-nums text-[#3F7A63]">
                Pro active until {user.subscriptionEndsAt.slice(0, 10)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {user.tier === "FREE" ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenPaywall("Upgrade to Journo Pro from Settings.")}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Upgrade to Pro
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={onRefreshSubscription}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh Status
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancelPro}>
                  Cancel Pro (Keep Tasks)
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Transport Modes */}
      <Card>
        <h3 className="text-sm font-bold text-[#2F453B]">Transport Preferences</h3>
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-semibold text-[#5E766B]">
            Preferred Ways to Travel
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: "CAR", label: "Personal Car", icon: Car },
                { id: "BOTH", label: "Walk + Transit", icon: Footprints },
                { id: "WALK", label: "Walk Only", icon: Footprints },
                { id: "TRANSIT", label: "Transit Only", icon: TrainFront },
              ] as { id: TransportPref; label: string; icon: typeof Footprints }[]
            ).map((opt) => {
              const Icon = opt.icon;
              const active = user.transportModes === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSaveProfile({ transportModes: opt.id });
                    if (opt.id === "CAR" && transportProfile && !transportProfile.hasPersonalCar && onUpdateTransportProfile) {
                      onUpdateTransportProfile({ ...transportProfile, hasPersonalCar: true });
                    }
                  }}
                  className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold transition-colors ${
                    active
                      ? "border-[#C67D63] bg-[#F4E8E3] text-[#2F453B]"
                      : "border-[#DFDBD0] bg-white text-[#5E766B] hover:border-[#2F453B]/40"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 text-[#C67D63]" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {transportProfile && onUpdateTransportProfile ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF] px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <Car className="h-4 w-4 text-[#C67D63] shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[#2F453B]">
                    I don&apos;t have a personal car
                  </p>
                  <p className="text-[11px] text-[#5E766B]">
                    {transportProfile.hasPersonalCar === false
                      ? "Personal car costs hidden — use Walk, Transit, Taxi, or Friends Ride."
                      : "Personal car fuel & parking included in route comparisons."}
                  </p>
                </div>
              </div>
              <Switch
                checked={transportProfile.hasPersonalCar === false}
                onCheckedChange={(checked) => {
                  onUpdateTransportProfile({
                    ...transportProfile,
                    hasPersonalCar: !checked,
                  });
                  if (checked && user.transportModes === "CAR") {
                    void onSaveProfile({ transportModes: "BOTH" });
                  }
                }}
                label="No personal car"
              />
            </div>
          ) : null}
        </div>
      </Card>

      {/* City & Timezone Card */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#C67D63]" />
              <h3 className="text-sm font-bold text-[#2F453B]">Active City &amp; Timezone</h3>
            </div>
            <p className="mt-1 text-xs text-[#5E766B]">
              Current: <strong>{user.currentCity}</strong> (
              {user.currentTimezone === "Asia/Almaty"
                ? "UTC+5"
                : user.currentTimezone}
              )
              {user.tempBaseAddress ? ` · Temp Base: ${user.tempBaseAddress}` : ""}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onOpenCitySwitch}>
            Switch City / Travel Base
          </Button>
        </div>
      </Card>

      {/* Places, Delay Threshold & Quiet Hours Form */}
      <Card>
        <form onSubmit={handleSaveAddressesAndAlerts} className="space-y-3.5">
          <h3 className="text-sm font-bold text-[#2F453B]">
            Home, Work &amp; Notification Hours
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#2F453B]">
                <Home className="h-3.5 w-3.5 text-[#C67D63]" />
                Home Base Address
              </label>
              <input
                type="text"
                className={inputClass}
                value={homeAddress}
                onChange={(e) => {
                  setHomeAddress(e.target.value);
                  setHomeCoords(null);
                }}
                placeholder="Type street & house (e.g. Кабанбай Батыра 55)..."
              />
              {homeMatches.length > 0 ? (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] divide-y divide-[#DFDBD0]/60">
                  {homeMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setHomeAddress(p.address || `${p.name}, ${user.currentCity}`);
                        setHomeCoords({ lat: p.lat, lng: p.lng });
                      }}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-white cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#2F453B] truncate">{p.name}</div>
                        <div className="text-[11px] text-[#5E766B] truncate">{p.address}</div>
                      </div>
                      <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#5E766B] border border-[#DFDBD0]">
                        {p.category}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className="mb-1 block text-xs font-semibold text-[#2F453B]">
                Work / Office Address (optional)
              </label>
              <input
                type="text"
                className={inputClass}
                value={workAddress}
                onChange={(e) => {
                  setWorkAddress(e.target.value);
                  setWorkCoords(null);
                }}
                placeholder="Type office street & house..."
              />
              {workMatches.length > 0 ? (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] divide-y divide-[#DFDBD0]/60">
                  {workMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setWorkAddress(p.address || `${p.name}, ${user.currentCity}`);
                        setWorkCoords({ lat: p.lat, lng: p.lng });
                      }}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-white cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#2F453B] truncate">{p.name}</div>
                        <div className="text-[11px] text-[#5E766B] truncate">{p.address}</div>
                      </div>
                      <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#5E766B] border border-[#DFDBD0]">
                        {p.category}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF]/60 p-3.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#2F453B]">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#C67D63]" />
                Delay Alert Threshold
              </span>
              <span className="tabular-nums font-bold text-[#C67D63]">{delayThreshold} min</span>
            </div>
            <input
              type="range"
              min={3}
              max={20}
              value={delayThreshold}
              onChange={(e) => setDelayThreshold(Number(e.target.value))}
              className="mt-2 w-full accent-[#C67D63]"
            />
            <p className="mt-1 text-[11px] text-[#5E766B]">
              Only alert me if traffic pushes an arrival past {delayThreshold} min delay.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#2F453B]">
                Quiet Hours Start
              </label>
              <input
                type="time"
                className={inputClass}
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#2F453B]">
                Quiet Hours End
              </label>
              <input
                type="time"
                className={inputClass}
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-[#5E766B]">
            Gentle reminders stay quiet overnight; urgent departure alerts for fixed meetings still notify you.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onTriggerTestPush}>
              <Bell className="h-3.5 w-3.5" />
              Send Test Notification
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>
              Save Settings
            </Button>
          </div>
        </form>
      </Card>

      {/* Export & Permanent Delete Account */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DFDBD0] pb-4">
          <div>
            <h3 className="text-sm font-bold text-[#2F453B]">Export Personal Route Data</h3>
            <p className="text-xs text-[#5E766B]">
              Download all your tasks, recurring series, calendar events, and plans as JSON.
            </p>
          </div>
          <a
            href="/api/user?export=1"
            download="journo-export.json"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-[#2F453B]/20 bg-[#F6F4EF] px-4 text-xs font-semibold text-[#2F453B] hover:bg-[#ECE9E1]"
          >
            <Download className="h-4 w-4 text-[#C67D63]" />
            Export JSON
          </a>
        </div>

        <div className="pt-4">
          <h3 className="text-sm font-bold text-[#B05454]">Danger Zone — Delete Account</h3>
          <p className="mt-0.5 text-xs text-[#5E766B]">
            Permanently wipes all your data and signs out to the home screen. Type{" "}
            <strong>DELETE</strong> below to unlock confirmation.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder='Type "DELETE" to confirm'
              className={`${inputClass} max-w-xs`}
            />
            <Button
              variant="danger"
              size="sm"
              disabled={deleteConfirmText !== "DELETE"}
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await onDeleteAccountConfirmed();
                } finally {
                  setDeleting(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
