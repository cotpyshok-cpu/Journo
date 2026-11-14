"use client";

import React, { useState } from "react";
import {
  Bell,
  Briefcase,
  Calendar,
  Check,
  Footprints,
  Home,
  LocateFixed,
  Lock,
  Sparkles,
  TrainFront,
} from "lucide-react";
import { resolvePlaceByWords, searchPlacesLocal } from "@/lib/astana-places";
import { TransportPref, UserProfile } from "@/lib/types";
import { Badge, Button, Modal, inputClass } from "@/components/ui/primitives";

interface OnboardingModalProps {
  isOpen: boolean;
  initialStep?: number;
  user: UserProfile;
  onClose: () => void;
  onSaveProfile: (patch: Partial<UserProfile>) => Promise<void>;
  onOpenPaywall: (reason: string) => void;
  onOpenGoogleAuth: () => void;
  onNotify: (msg: string) => void;
}

export function OnboardingModal({
  isOpen,
  initialStep = 3,
  user,
  onClose,
  onSaveProfile,
  onOpenPaywall,
  onOpenGoogleAuth,
  onNotify,
}: OnboardingModalProps) {
  const [step, setStep] = useState<number>(Math.min(6, Math.max(3, initialStep)));
  const [transport, setTransport] = useState<TransportPref>(user.transportModes);
  const [homeAddress, setHomeAddress] = useState(user.homeAddress);
  const [homeLat, setHomeLat] = useState(user.homeLat);
  const [homeLng, setHomeLng] = useState(user.homeLng);
  const [workAddress, setWorkAddress] = useState(user.workAddress || "");
  const [workLat, setWorkLat] = useState<number | null>(user.workLat);
  const [workLng, setWorkLng] = useState<number | null>(user.workLng);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [pushStatus, setPushStatus] = useState<"idle" | "granted" | "denied">("idle");

  const homeSuggestions = searchPlacesLocal(homeAddress, user.currentCity).slice(0, 5);
  const workSuggestions = searchPlacesLocal(workAddress, user.currentCity).slice(0, 4);

  const handleNextStep = async () => {
    if (step === 3) {
      await onSaveProfile({ transportModes: transport, onboardingStep: 4 });
      setStep(4);
      return;
    }
    if (step === 4) {
      // A5: Home cannot be skipped because it is the morning departure anchor
      if (!homeAddress.trim()) {
        setHomeError("Home is required as your starting departure base (only Work can be skipped).");
        return;
      }
      setHomeError(null);
      await onSaveProfile({
        homeAddress,
        homeLat,
        homeLng,
        workAddress: workAddress.trim() ? workAddress : null,
        workLat: workAddress.trim() ? workLat : null,
        workLng: workAddress.trim() ? workLng : null,
        onboardingStep: 5,
      });
      setStep(5);
      return;
    }
    if (step === 5) {
      await onSaveProfile({ onboardingStep: 6 });
      setStep(6);
      return;
    }
    await onSaveProfile({ onboardingStep: 9 });
    onNotify("Onboarding complete! Ready to build your Astana morning plan.");
    onClose();
  };

  const requestGeo = () => {
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setGeoStatus("granted");
          onNotify("Geolocation enabled for active Live Day arrivals.");
        },
        () => {
          setGeoStatus("denied");
        },
        { timeout: 4000 }
      );
    } else {
      setGeoStatus("denied");
    }
  };

  const requestPush = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        setPushStatus("granted");
        onNotify("Push reminders are turned on.");
      } else {
        setPushStatus("denied");
      }
    } else {
      setPushStatus("denied");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Quick Setup · Step ${step - 2} of 4`}
      subtitle="Personalize how you travel, your starting point, and your calendars"
      maxWidth="max-w-xl"
    >
      {/* Stepper indicator */}
      <div className="flex items-center gap-2 mb-5">
        {[3, 4, 5, 6].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`flex-1 h-2 rounded-full transition-colors cursor-pointer ${
              s <= step ? "bg-[#C67D63]" : "bg-[#DFDBD0]"
            }`}
            aria-label={`Jump to onboarding step ${s - 2}`}
          />
        ))}
      </div>

      {/* S03: Transport Modes */}
      {step === 3 ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold">How do you usually get around {user.currentCity}?</h3>
            <p className="text-sm text-[#5E766B] mt-1">
              Both walking and transit are free to compare. Choosing both lets Journo pick the
              quickest option for every leg of your day.
            </p>
          </div>

          <div className="grid gap-3">
            {(
              [
                {
                  id: "BOTH",
                  title: "Walk + Public Transit (Recommended)",
                  desc: "Shows walking and transit options side by side so you can switch anytime.",
                  icon: (
                    <div className="flex items-center gap-1 text-[#C67D63]">
                      <Footprints className="h-5 w-5" aria-hidden="true" />
                      <TrainFront className="h-5 w-5" aria-hidden="true" />
                    </div>
                  ),
                },
                {
                  id: "WALK",
                  title: "Walking Only",
                  desc: "Great for compact neighborhoods — lets you know if a trip is a long walk.",
                  icon: <Footprints className="h-5 w-5 text-[#2F453B]" aria-hidden="true" />,
                },
                {
                  id: "TRANSIT",
                  title: "Public Transit Only",
                  desc: "Focuses on bus & rail routes, using walking only for short hops nearby.",
                  icon: <TrainFront className="h-5 w-5 text-[#2F453B]" aria-hidden="true" />,
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTransport(opt.id)}
                className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors cursor-pointer min-h-[64px] ${
                  transport === opt.id
                    ? "border-[#C67D63] bg-[#F4E8E3]/60"
                    : "border-[#DFDBD0] bg-white hover:bg-[#ECE9E1]/50"
                }`}
              >
                <div className="mt-0.5">{opt.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-[#2F453B]">{opt.title}</span>
                    {transport === opt.id ? (
                      <Check className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                    ) : null}
                  </div>
                  <p className="text-xs text-[#5E766B] mt-1">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* S04: Saved Places (Home & Work) */}
      {step === 4 ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold">Set your daily start &amp; work places</h3>
            <p className="text-sm text-[#5E766B] mt-1">
              Home is your morning route departure point (required). Work is optional.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-[#DFDBD0] bg-white p-4">
            <label htmlFor="onb-home" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#2F453B]">
              <Home className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
              Home Address (Required)
            </label>
            <input
              id="onb-home"
              value={homeAddress}
              onChange={(e) => {
                const val = e.target.value;
                setHomeAddress(val);
                if (val.trim()) {
                  const resolved = resolvePlaceByWords(val, user.currentCity);
                  setHomeLat(resolved.lat);
                  setHomeLng(resolved.lng);
                  setHomeError(null);
                }
              }}
              placeholder="Search street or building by words..."
              className={inputClass}
            />
            <div className="flex flex-wrap gap-1.5">
              {homeSuggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setHomeAddress(`${p.name}, ${p.address}`);
                    setHomeLat(p.lat);
                    setHomeLng(p.lng);
                    setHomeError(null);
                  }}
                  className="rounded-lg border border-[#DFDBD0] bg-[#F6F4EF] px-2.5 py-1.5 text-xs font-medium text-[#2F453B] hover:bg-[#ECE9E1] cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
            {homeError ? (
              <p role="alert" className="text-xs font-medium text-[#B05454]">
                {homeError}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-[#DFDBD0] bg-white p-4">
            <div className="flex items-center justify-between">
              <label htmlFor="onb-work" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#2F453B]">
                <Briefcase className="h-4 w-4 text-[#5E766B]" aria-hidden="true" />
                Work / Studio (Optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  setWorkAddress("");
                  setWorkLat(null);
                  setWorkLng(null);
                }}
                className="text-xs font-semibold text-[#5E766B] hover:text-[#2F453B] cursor-pointer"
              >
                Skip Work
              </button>
            </div>
            <input
              id="onb-work"
              value={workAddress}
              onChange={(e) => {
                const val = e.target.value;
                setWorkAddress(val);
                if (val.trim()) {
                  const resolved = resolvePlaceByWords(val, user.currentCity);
                  setWorkLat(resolved.lat);
                  setWorkLng(resolved.lng);
                } else {
                  setWorkLat(null);
                  setWorkLng(null);
                }
              }}
              placeholder="Optional — type office or address..."
              className={inputClass}
            />
            {workSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {workSuggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setWorkAddress(`${p.name}, ${p.address}`);
                      setWorkLat(p.lat);
                      setWorkLng(p.lng);
                    }}
                    className="rounded-lg border border-[#DFDBD0] bg-[#F6F4EF] px-2.5 py-1.5 text-xs font-medium text-[#2F453B] hover:bg-[#ECE9E1] cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* S05: Calendars */}
      {step === 5 ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold">Choose your calendars</h3>
            <p className="text-sm text-[#5E766B] mt-1">
              Events with a location automatically become scheduled stops in your Morning Plan.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#C6DDD2] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E6F1EC] text-[#3F7A63]">
                  <Calendar className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Journo Calendar</p>
                  <p className="text-xs text-[#5E766B]">
                    Included for everyone · Works side-by-side with your connected calendars
                  </p>
                </div>
              </div>
              <Badge variant="safe">Included</Badge>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#DFDBD0] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4E8E3] text-[#C67D63]">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">Google Calendar</p>
                    <Badge variant={user.tier === "FREE" ? "coral" : "forest"}>
                      {user.tier === "FREE" ? "Pro" : "Unlocked"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#5E766B] mt-0.5">
                    Brings in your upcoming meetings automatically so Journo plans around them — your calendar stays untouched.
                  </p>
                </div>
              </div>
              {user.tier === "FREE" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenPaywall("External Google Calendar Sync")}
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  See Pro
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={onOpenGoogleAuth}>
                  Connect
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Permissions (Geolocation + Reminders) */}
      {step === 6 ? (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold">Arrival check-ins &amp; reminders</h3>
            <p className="text-sm text-[#5E766B] mt-1">
              Location runs only while you&apos;re using Journo after pressing Start Day.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[#DFDBD0] bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <LocateFixed className="h-5 w-5 text-[#C67D63]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm">Location Check-Ins</p>
                    <p className="text-xs text-[#5E766B]">
                      Automatically asks &ldquo;Have you arrived?&rdquo; and updates travel times as you move.
                    </p>
                  </div>
                </div>
                <Button
                  variant={geoStatus === "granted" ? "secondary" : "primary"}
                  size="sm"
                  onClick={requestGeo}
                >
                  {geoStatus === "granted" ? "Allowed" : "Allow Location"}
                </Button>
              </div>
              {geoStatus === "denied" ? (
                <p className="rounded-xl bg-[#F6EFE2] px-3 py-2 text-xs text-[#9C6B3B]">
                  Location access is blocked in your browser settings. Journo will use your Home
                  address to estimate travel times instead.
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#DFDBD0] bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Bell className="h-5 w-5 text-[#2F453B]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm">Departure Reminders</p>
                    <p className="text-xs text-[#5E766B]">
                      {user.tier === "FREE"
                        ? 'Evening wrap-up reminders on Free; "Leave now" alerts are included in Pro.'
                        : 'Sends timely "Leave in 5 min" notifications so you never have to watch the clock.'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={pushStatus === "granted" ? "secondary" : "outline"}
                  size="sm"
                  onClick={requestPush}
                >
                  {pushStatus === "granted" ? "Allowed" : "Allow Push"}
                </Button>
              </div>
              {pushStatus === "denied" ? (
                <p className="rounded-xl bg-[#F6EFE2] px-3 py-2 text-xs text-[#9C6B3B]">
                  Notifications are blocked in browser settings. In-app alert banners and
                  tab title alerts remain active as a fallback.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-[#DFDBD0]">
        {step > 3 ? (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Skip to Workspace
          </Button>
        )}

        <Button variant="primary" onClick={handleNextStep}>
          {step === 6 ? "Finish Setup & Open Morning Plan" : "Continue"}
        </Button>
      </div>
    </Modal>
  );
}
