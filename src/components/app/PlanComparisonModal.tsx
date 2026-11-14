"use client";

import React from "react";
import { ArrowRight, Check, Lock, Route, ShieldCheck, X } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui/primitives";

export interface PlanComparisonPreview {
  title: string;
  deltaMinutes: number;
  deltaKm: number;
  newTotalTravelMin: number;
  newTotalKm: number;
  shiftedTasks: {
    taskId: string;
    title: string;
    oldEta: string | null;
    newEta: string | null;
  }[];
}

interface PlanComparisonModalProps {
  isOpen: boolean;
  preview: PlanComparisonPreview | null;
  accepting: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}

export function PlanComparisonModal({
  isOpen,
  preview,
  accepting,
  onAccept,
  onDecline,
}: PlanComparisonModalProps) {
  if (!preview) return null;

  const isFasterOrZero = preview.deltaMinutes <= 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDecline}
      title="Updated Plan Preview — Before vs. After"
      subtitle={preview.title}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Delta Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF] p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5E766B]">
              Travel Time Change
            </div>
            <div
              className={`mt-1 text-xl font-bold tabular-nums ${
                isFasterOrZero ? "text-[#3F7A63]" : "text-[#C67D63]"
              }`}
            >
              {preview.deltaMinutes > 0
                ? `+${preview.deltaMinutes} min`
                : `${preview.deltaMinutes} min`}
            </div>
          </div>

          <div className="rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF] p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5E766B]">
              Distance Change
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-[#2F453B]">
              {preview.deltaKm > 0
                ? `+${preview.deltaKm.toFixed(1)} km`
                : `${preview.deltaKm.toFixed(1)} km`}
            </div>
          </div>

          <div className="col-span-2 rounded-2xl border border-[#DFDBD0] bg-white p-3.5 sm:col-span-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5E766B]">
              Updated Total
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-[#2F453B]">
              {preview.newTotalTravelMin}m · {preview.newTotalKm.toFixed(1)} km
            </div>
          </div>
        </div>

        {/* Fixed Meetings Protection Confirmation */}
        <div className="flex items-center gap-2 rounded-2xl border border-[#3F7A63]/25 bg-[#3F7A63]/10 px-3.5 py-2.5 text-xs font-medium text-[#2F453B]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#3F7A63]" />
          <span>
            Your fixed meetings keep their scheduled times. Flexible errands adjusted smoothly around them.
          </span>
        </div>

        {/* Shifted Tasks Diff */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5E766B]">
              Affected Stop Timings
            </span>
            <Badge variant="neutral">{preview.shiftedTasks.length} stops compared</Badge>
          </div>

          {preview.shiftedTasks.length === 0 ? (
            <div className="rounded-2xl border border-[#DFDBD0] bg-white p-4 text-xs text-[#5E766B]">
              Existing ETAs stay unchanged — the new stop slots smoothly into an open gap.
            </div>
          ) : (
            <div className="max-h-60 divide-y divide-[#DFDBD0] overflow-y-auto rounded-2xl border border-[#DFDBD0] bg-white">
              {preview.shiftedTasks.map((row) => {
                const changed = row.oldEta !== row.newEta;
                return (
                  <div
                    key={row.taskId}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 font-semibold text-[#2F453B]">
                      <Route className="h-3.5 w-3.5 shrink-0 text-[#C67D63]" />
                      <span>{row.title}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-[#5E766B]">{row.oldEta || "--:--"}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[#5E766B]" />
                      <span
                        className={`font-bold ${
                          changed ? "text-[#C67D63]" : "text-[#3F7A63]"
                        }`}
                      >
                        {row.newEta || "--:--"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#DFDBD0] pt-3">
          <span className="flex items-center gap-1 text-[11px] text-[#5E766B]">
            <Lock className="h-3 w-3" />
            Declining rolls back safely without modifying existing stops
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onDecline}
              disabled={accepting}
            >
              <X className="h-4 w-4" />
              Decline
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={accepting}
              onClick={onAccept}
            >
              <Check className="h-4 w-4" />
              Accept New Plan
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
