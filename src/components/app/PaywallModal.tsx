"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { UserProfile } from "@/lib/types";
import { Badge, Button, Modal } from "@/components/ui/primitives";

interface PaywallModalProps {
  isOpen: boolean;
  reason: string;
  user: UserProfile;
  onClose: () => void;
  onUpgraded: (updatedUser: UserProfile) => void;
  onNotify: (msg: string) => void;
}

const COMPARISON_ROWS = [
  { label: "Daily routed stops", free: "Up to 5 / day", pro: "Unlimited" },
  { label: "Calendars", free: "Internal only", pro: "Google OAuth + Apple .ics" },
  { label: "Traffic & delay reaction", free: "Manual Update button", pro: "Auto re-optimization" },
  { label: "Evening analytics", free: "Today summary", pro: "7-day Charts + Accuracy" },
  { label: "Recurring series", free: "Basic 1 active", pro: "Unlimited + Multi-scope edit" },
];

export function PaywallModal({
  isOpen,
  reason,
  user,
  onClose,
  onUpgraded,
  onNotify,
}: PaywallModalProps) {
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [loadingMode, setLoadingMode] = useState<string | null>(null);
  const [pendingWebhook, setPendingWebhook] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runCheckout = async (
    mode: "auto" | "sandbox_success" | "sandbox_delay" | "sandbox_error"
  ) => {
    setErrorMsg(null);
    setLoadingMode(mode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, mode, returnScreen: "S15" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(
          data.error?.message || "Payment authorization declined. Your current plan is unchanged."
        );
        return;
      }

      if (data.provider === "STRIPE" && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }

      if (data.status === "PENDING_WEBHOOK") {
        setPendingWebhook(true);
        return;
      }

      if (data.status === "ACTIVATED" && data.user) {
        onUpgraded(data.user);
        onNotify("Journo Pro activated! Typed inputs and drafts are preserved.");
        onClose();
      }
    } catch {
      setErrorMsg("Network error while reaching billing service. Please retry.");
    } finally {
      setLoadingMode(null);
    }
  };

  const handleRefreshStatus = async () => {
    setLoadingMode("verify");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh_status", plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || "Could not verify payment status.");
        return;
      }
      if (data.user) {
        setPendingWebhook(false);
        onUpgraded(data.user);
        onNotify("Subscription confirmed via webhook check — Journo Pro active.");
        onClose();
      }
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upgrade to Journo Pro"
      subtitle="Unlimited daily stops, Google & Apple Calendar sync, and hands-free schedule updates."
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Reason Banner */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#C67D63]/35 bg-[#C67D63]/10 px-4 py-3 text-xs text-[#2F453B]">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C67D63]" />
          <div>
            <span>{reason || "Unlock unlimited daily stops and automatic calendar routing."}</span>
            {user.tier !== "FREE" && (
              <Badge variant="safe" className="ml-2">
                Active: {user.tier}
              </Badge>
            )}
          </div>
        </div>

        {/* Plan Selector ($8/mo vs $70/yr) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPlan("monthly")}
            className={`min-h-[82px] rounded-2xl border-2 p-4 text-left transition-[border-color,background-color] duration-150 ease-out ${
              plan === "monthly"
                ? "border-[#C67D63] bg-[#F4E8E3]"
                : "border-[#DFDBD0] bg-white hover:border-[#2F453B]/40"
            }`}
          >
            <div className="text-xs font-semibold text-[#5E766B]">Monthly Flex</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#2F453B]">
              $8 <span className="text-xs font-normal text-[#5E766B]">/ month</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#5E766B]">Cancel anytime</div>
          </button>

          <button
            type="button"
            onClick={() => setPlan("yearly")}
            className={`relative min-h-[82px] rounded-2xl border-2 p-4 text-left transition-[border-color,background-color] duration-150 ease-out ${
              plan === "yearly"
                ? "border-[#C67D63] bg-[#F4E8E3]"
                : "border-[#DFDBD0] bg-white hover:border-[#2F453B]/40"
            }`}
          >
            <span className="absolute -top-2.5 right-3 rounded-full bg-[#2F453B] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F6F4EF]">
              Save $26/yr
            </span>
            <div className="text-xs font-semibold text-[#5E766B]">Annual Pro</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#2F453B]">
              $70 <span className="text-xs font-normal text-[#5E766B]">/ year</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#3F7A63] font-medium">$5.83/mo equivalent</div>
          </button>
        </div>

        {/* Comparison Table */}
        <div className="overflow-hidden rounded-2xl border border-[#DFDBD0] bg-white">
          <div className="grid grid-cols-12 border-b border-[#DFDBD0] bg-[#F6F4EF] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#5E766B]">
            <div className="col-span-5">Capability</div>
            <div className="col-span-3">Free</div>
            <div className="col-span-4 text-[#C67D63]">Journo Pro</div>
          </div>
          <div className="divide-y divide-[#DFDBD0] text-xs">
            {COMPARISON_ROWS.map((row) => (
              <div key={row.label} className="grid grid-cols-12 items-center px-4 py-2.5">
                <div className="col-span-5 font-semibold text-[#2F453B]">{row.label}</div>
                <div className="col-span-3 text-[#5E766B]">{row.free}</div>
                <div className="col-span-4 flex items-center gap-1 font-semibold text-[#2F453B]">
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#3F7A63]" />
                  <span>{row.pro}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhook Delay Checking State */}
        {pendingWebhook && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#9C6B3B]/30 bg-[#F6EFE2] px-4 py-3 text-xs text-[#75512B]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#9C6B3B]" />
              <span>
                <strong>Checking payment...</strong> Stripe webhook confirmation delayed in sandbox.
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={loadingMode === "verify"}
              onClick={handleRefreshStatus}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Subscription Status
            </Button>
          </div>
        )}

        {/* Payment Declined Error State */}
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-2xl border border-[#B05454]/30 bg-[#F5E6E6] px-4 py-3 text-xs text-[#B05454]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Primary Checkout */}
        <div className="space-y-2.5 border-t border-[#DFDBD0] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-[#5E766B]">
              <ShieldCheck className="h-4 w-4 text-[#3F7A63]" />
              Cancel anytime · Your tasks and places are always saved
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Not Now
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={loadingMode === "auto"}
                onClick={() => runCheckout("auto")}
              >
                <CreditCard className="h-4 w-4" />
                Upgrade Now ({plan === "yearly" ? "$70/yr" : "$8/mo"})
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
