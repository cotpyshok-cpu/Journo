"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Globe,
  RotateCcw,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { ScreenId, SystemSimulationFlags, UserTier } from "@/lib/types";

interface JuryControlBarProps {
  tier: UserTier;
  onTierChange: (tier: UserTier) => void;
  simFlags: SystemSimulationFlags;
  onToggleSimFlag: (key: keyof SystemSimulationFlags) => void;
  currentScreen: ScreenId;
  onNavigateScreen: (screen: ScreenId) => void;
  onSimulateTrafficPush: () => void;
  onOpenOnboarding: () => void;
  onOpenCitySwitch: () => void;
  onResetDemo: () => void;
}

export function JuryControlBar({
  tier,
  onTierChange,
  onSimulateTrafficPush,
  onOpenOnboarding,
  onOpenCitySwitch,
  onResetDemo,
}: JuryControlBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[#DFDBD0] bg-[#1F312A] text-[#F6F4EF]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#3D564B] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#E2C2B5]">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Preview Mode
          </span>

          <div className="inline-flex rounded-lg bg-[#2F453B] p-0.5">
            {(
              [
                { id: "FREE" as const, label: "Free Plan" },
                { id: "PRO" as const, label: "Pro Plan" },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onTierChange(opt.id)}
                className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                  (tier === "DEV" ? "PRO" : tier) === opt.id
                    ? "bg-[#C67D63] text-white"
                    : "text-[#F6F4EF]/80 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenCitySwitch}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#3D564B] px-2.5 text-xs font-medium text-[#F6F4EF] hover:bg-[#31685A] transition-colors cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5 text-[#E2C2B5]" aria-hidden="true" />
            Switch City
          </button>

          <button
            type="button"
            onClick={onOpenOnboarding}
            className="min-h-[34px] rounded-lg bg-[#3D564B] px-2.5 text-xs font-medium hover:bg-[#31685A] cursor-pointer"
          >
            Quick Setup
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex min-h-[34px] items-center rounded-lg border border-[#5E766B] px-2.5 text-xs font-medium text-[#F6F4EF]/90 hover:bg-[#3D564B]"
          >
            Home
          </Link>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#3D564B] px-2.5 text-xs font-medium hover:bg-[#31685A] cursor-pointer"
          >
            Demo Actions
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-[#2F453B] bg-[#192822] px-4 py-2.5 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-xs">
            <span className="mr-1 font-medium text-[#F6F4EF]/70">Sample day controls:</span>

            <button
              type="button"
              onClick={onSimulateTrafficPush}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-[#C67D63] px-2.5 font-semibold text-white hover:bg-[#B26B52] cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              Simulate +12m Traffic Delay
            </button>

            <button
              type="button"
              onClick={onResetDemo}
              className="ml-auto inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#5E766B] px-2.5 font-medium text-[#F6F4EF] hover:bg-[#2F453B] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset Sample Day
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
