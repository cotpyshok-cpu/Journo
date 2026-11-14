"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  Lock,
  MapPin,
  Route,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { PlacePreset, resolvePlaceByWords, searchPlacesLocal } from "@/lib/astana-places";
import { estimateVenueBudget } from "@/lib/budget-intelligence";
import { resolveAddressWithLiveFallback, searchLivePlaces } from "@/lib/geocode-client";
import { parseQuickAddText } from "@/lib/quick-add-parser";
import { PriceIntelEntry, UserTier } from "@/lib/types";
import { Button, Modal, inputClass } from "@/components/ui/primitives";

export interface QuickAddPlaceCandidate {
  id: string;
  name: string;
  address: string;
  category: string;
  city: string;
  lat: number;
  lng: number;
  detourMin: number;
  distanceKm: number;
}

interface QuickAddModalProps {
  isOpen: boolean;
  date: string;
  city: string;
  tier: UserTier;
  preservedText: string;
  priceIntel?: PriceIntelEntry[];
  onTextChange: (val: string) => void;
  onClose: () => void;
  onCommitQuickAdd: (
    text: string,
    selectedPlace: QuickAddPlaceCandidate | null
  ) => Promise<void>;
}

const PRESET_CHIPS = [
  "Pharmacy, 10 min, flexible",
  "Coffee, 20 min, flexible",
  "Bank, 30 min, 14:00-16:00",
  "Cinema for two at 19:30",
  "Кино на двоих в 19:30",
];

export function QuickAddModal({
  isOpen,
  date,
  city,
  tier,
  preservedText,
  priceIntel,
  onTextChange,
  onClose,
  onCommitQuickAdd,
}: QuickAddModalProps) {
  const [candidates, setCandidates] = useState<QuickAddPlaceCandidate[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [customPlaceQuery, setCustomPlaceQuery] = useState("");
  const [pickedCustomPlace, setPickedCustomPlace] = useState<PlacePreset | null>(null);
  const [livePlaceMatches, setLivePlaceMatches] = useState<PlacePreset[]>([]);
  const [placeManuallyLocked, setPlaceManuallyLocked] = useState(false);
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);
  const [loadingParse, setLoadingParse] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedLocal = parseQuickAddText(preservedText || "Pharmacy, 10 min, flexible");

  useEffect(() => {
    if (!isOpen) {
      setShowPlaceDropdown(false);
      return;
    }
    setPlaceManuallyLocked(false);
    setCustomPlaceQuery("");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const queryText = preservedText.trim() || "Pharmacy, 10 min, flexible";
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingParse(true);
      try {
        const res = await fetch("/api/tasks/quick-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: queryText, date, action: "parse" }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          const list = (data.suggestions ?? []) as QuickAddPlaceCandidate[];
          setCandidates(list);
          if (!placeManuallyLocked) {
            setSelectedPlaceId((prev) =>
              list.some((item) => item.id === prev) ? prev : list[0]?.id ?? null
            );
          }
        }
      } catch {
        // Abort or offline fallback; local parse remains visible
      } finally {
        setLoadingParse(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, preservedText, date, placeManuallyLocked]);

  useEffect(() => {
    if (!isOpen) return;
    const q = customPlaceQuery.trim();
    if (q.length < 2) {
      setLivePlaceMatches([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const results = await searchLivePlaces(q, city, controller.signal);
      setLivePlaceMatches(results);
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, customPlaceQuery, city]);

  const wordMatches = useMemo(
    () =>
      livePlaceMatches.length > 0
        ? livePlaceMatches
        : searchPlacesLocal(customPlaceQuery, city),
    [livePlaceMatches, customPlaceQuery, city]
  );

  const selectedCandidate = useMemo<QuickAddPlaceCandidate | null>(() => {
    if (selectedPlaceId) {
      const fromDetour = candidates.find((c) => c.id === selectedPlaceId);
      if (fromDetour) return fromDetour;
    }
    if (placeManuallyLocked && pickedCustomPlace) {
      return {
        id: pickedCustomPlace.id,
        name: pickedCustomPlace.name,
        address: pickedCustomPlace.address,
        category: pickedCustomPlace.category,
        city: pickedCustomPlace.city,
        lat: pickedCustomPlace.lat,
        lng: pickedCustomPlace.lng,
        detourMin: 6,
        distanceKm: 1.8,
      };
    }
    if (placeManuallyLocked && customPlaceQuery.trim()) {
      const topLive = livePlaceMatches[0];
      const resolved = topLive ?? resolvePlaceByWords(customPlaceQuery.trim(), city);
      return {
        id: resolved.id,
        name: resolved.name,
        address: resolved.address,
        category: resolved.category,
        city: resolved.city,
        lat: resolved.lat,
        lng: resolved.lng,
        detourMin: 6,
        distanceKm: 1.8,
      };
    }
    return candidates[0] ?? null;
  }, [selectedPlaceId, candidates, placeManuallyLocked, pickedCustomPlace, customPlaceQuery, livePlaceMatches, city]);

  const localBudgetEst = estimateVenueBudget({
    locationName: selectedCandidate?.name ?? (customPlaceQuery.trim() || null),
    title: parsedLocal.title,
    partySize: parsedLocal.partySize,
    priceIntel: priceIntel ?? [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preservedText.trim()) {
      setErrorMsg("Enter an errand or choose a quick preset chip above.");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      let finalCandidate = selectedCandidate;
      if (placeManuallyLocked && !pickedCustomPlace && customPlaceQuery.trim()) {
        const resolved = await resolveAddressWithLiveFallback(customPlaceQuery.trim(), city);
        finalCandidate = {
          id: `live-${Date.now()}`,
          name: resolved.name,
          address: resolved.address,
          category: "Address",
          city,
          lat: resolved.lat,
          lng: resolved.lng,
          detourMin: 6,
          distanceKm: 1.8,
        };
      }
      await onCommitQuickAdd(preservedText.trim(), finalCandidate);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not add quick stop.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Add Along Route"
      subtitle={`Add a quick errand in ${city} — your fixed meetings stay protected.`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Fill Presets */}
        <div className="rounded-2xl border border-[#DFDBD0] bg-[#FAF6EA]/70 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2F453B]">
            <Zap className="h-3.5 w-3.5 text-[#C67D63]" aria-hidden="true" />
            Quick fill from a phrase
          </div>
          <input
            id="quick-add-input"
            type="text"
            autoFocus
            className={`${inputClass} bg-white`}
            value={preservedText}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder='e.g. "Coffee for 2 at 15:00" or "Pharmacy, 10 min, flexible"'
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {PRESET_CHIPS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onTextChange(preset)}
                className={`min-h-[34px] rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  preservedText === preset
                    ? "border-[#C67D63] bg-[#C67D63] text-white"
                    : "border-[#DFDBD0] bg-white text-[#2F453B] hover:border-[#2F453B]/40"
                }`}
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Editable Place / Address Search with Word Autocomplete */}
        <div className="relative space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="quick-add-place"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#2F453B]"
            >
              <MapPin className="h-3.5 w-3.5 text-[#C67D63]" aria-hidden="true" />
              Place / Address (optional override — search by words)
            </label>
            {placeManuallyLocked ? (
              <button
                type="button"
                onClick={() => {
                  setPlaceManuallyLocked(false);
                  setCustomPlaceQuery("");
                  setSelectedPlaceId(candidates[0]?.id ?? null);
                }}
                className="text-[11px] font-semibold text-[#C67D63] hover:underline"
              >
                Auto-match
              </button>
            ) : null}
          </div>
          <input
            id="quick-add-place"
            type="text"
            className={inputClass}
            value={customPlaceQuery}
            onFocus={() => setShowPlaceDropdown(true)}
            onBlur={() => {
              window.setTimeout(() => setShowPlaceDropdown(false), 160);
            }}
            onChange={(e) => {
              const val = e.target.value;
              setCustomPlaceQuery(val);
              setPickedCustomPlace(null);
              setShowPlaceDropdown(true);
              if (val.trim().length > 0) {
                setPlaceManuallyLocked(true);
                setSelectedPlaceId(null);
              } else {
                setPlaceManuallyLocked(false);
                setSelectedPlaceId(candidates[0]?.id ?? null);
              }
            }}
            placeholder={
              selectedCandidate
                ? `Auto: ${selectedCandidate.name} (type to change address)`
                : `Type street & house in ${city} (e.g. Кабанбай Батыра 55)...`
            }
          />
          {showPlaceDropdown && customPlaceQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-[#DFDBD0] bg-white shadow-lg">
              {wordMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCustomPlaceQuery(p.address && p.address !== p.name ? `${p.name} — ${p.address}` : p.name);
                    setPickedCustomPlace(p);
                    setPlaceManuallyLocked(true);
                    setSelectedPlaceId(null);
                    setShowPlaceDropdown(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 border-b border-[#DFDBD0]/50 px-3.5 py-2 text-left text-xs hover:bg-[#F6F4EF] last:border-b-0"
                >
                  <div>
                    <div className="font-bold text-[#2F453B]">{p.name}</div>
                    <div className="text-[11px] text-[#5E766B]">{p.address}</div>
                  </div>
                  <span className="rounded bg-[#ECE9E1] px-2 py-0.5 text-[10px] font-medium text-[#2F453B]">
                    {p.category}
                  </span>
                </button>
              ))}
              {wordMatches.length === 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setPlaceManuallyLocked(true);
                    setSelectedPlaceId(null);
                    setShowPlaceDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs hover:bg-[#F6F4EF]"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#C67D63]" />
                  <span>
                    Use custom address: <strong>{customPlaceQuery.trim()}</strong> ({city})
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Unified Details Summary (matches Task & Event Form fields) */}
        {preservedText.trim().length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF]/75 p-3 text-xs tabular-nums">
            <div>
              <div className="text-[11px] text-[#5E766B]">Title</div>
              <div className="font-semibold text-[#2F453B] truncate">{parsedLocal.title}</div>
            </div>
            <div>
              <div className="text-[11px] text-[#5E766B]">Time &amp; Duration</div>
              <div className="font-semibold text-[#2F453B] flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#C67D63] shrink-0" />
                {parsedLocal.windowStart && parsedLocal.windowEnd
                  ? `${parsedLocal.windowStart}–${parsedLocal.windowEnd}`
                  : `Flexible · ${parsedLocal.durationMin}m`}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#5E766B]">People</div>
              <div className="font-semibold text-[#2F453B] flex items-center gap-1">
                <Users className="h-3 w-3 text-[#C67D63] shrink-0" />
                {parsedLocal.partySize} {parsedLocal.partySize === 1 ? "person" : "people"}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#5E766B]">Est. Spend</div>
              <div className="font-semibold text-[#2F453B] flex items-center gap-1">
                <Wallet className="h-3 w-3 text-[#C67D63] shrink-0" />
                ~${localBudgetEst.total.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Top 3 Closest Detour Candidates (E2.2) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5E766B]">
              Top 3 Stops Near Your Route
            </span>
            {loadingParse && (
              <span className="text-[11px] text-[#5E766B]">Calculating detours...</span>
            )}
          </div>

          <div className="space-y-2">
            {candidates.map((place, index) => {
              const selected = selectedCandidate?.id === place.id;
              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlaceId(place.id);
                    setCustomPlaceQuery(place.name);
                    setPlaceManuallyLocked(true);
                  }}
                  className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color] duration-150 ease-out ${
                    selected
                      ? "border-[#C67D63] bg-[#F4E8E3]"
                      : "border-[#DFDBD0] bg-white hover:border-[#2F453B]/35"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        selected
                          ? "bg-[#C67D63] text-white"
                          : "bg-[#2F453B]/10 text-[#2F453B]"
                      }`}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-[#2F453B]">{place.name}</div>
                      <div className="flex items-center gap-1 text-xs text-[#5E766B]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{place.address}</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <div className="text-xs font-bold text-[#C67D63]">
                      +{place.detourMin} min detour
                    </div>
                    <div className="text-[11px] text-[#5E766B]">
                      {place.distanceKm.toFixed(1)} km away
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fixed Time Protection */}
        <div className="flex items-start gap-2 rounded-2xl border border-[#3F7A63]/25 bg-[#3F7A63]/10 px-3.5 py-2.5 text-xs text-[#2F453B]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#3F7A63]" />
          <div>
            <strong>Protected meetings:</strong>{" "}
            {tier === "FREE"
              ? "You'll see a before-and-after preview before updating your route. Fixed meetings stay right on time."
              : "Fits this stop along your lowest-detour stretch without moving any fixed meetings."}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-2xl border border-[#B05454]/30 bg-[#F5E6E6] px-3.5 py-2.5 text-xs font-medium text-[#B05454]">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#DFDBD0] pt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            <Route className="h-4 w-4" />
            {tier === "FREE" ? "Preview Update" : "Add to Route"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
