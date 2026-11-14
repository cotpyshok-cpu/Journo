"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Repeat, Sparkles, Users, Wallet, Zap } from "lucide-react";
import { PlacePreset, resolvePlaceByWords, searchPlacesLocal } from "@/lib/astana-places";
import { estimateVenueBudget } from "@/lib/budget-intelligence";
import { resolveAddressWithLiveFallback, searchLivePlaces } from "@/lib/geocode-client";
import { parseQuickAddText } from "@/lib/quick-add-parser";
import { PriceIntelEntry, TaskItem, TaskPriority } from "@/lib/types";
import { parseTimeToMinutes } from "@/lib/utils";
import { Badge, Button, Modal, Switch, inputClass } from "@/components/ui/primitives";

interface TaskFormModalProps {
  isOpen: boolean;
  mode?: "task" | "calendar";
  date: string;
  city: string;
  editingTask?: TaskItem | null;
  initialTitle?: string;
  initialWindowStart?: string | null;
  initialWindowEnd?: string | null;
  initialIsFlexible?: boolean;
  allowLocationless?: boolean;
  priceIntel?: PriceIntelEntry[];
  initialPartySize?: number;
  initialCustomPerPerson?: number | null;
  onClose: () => void;
  onSubmitTask: (payload: {
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
    priority: TaskPriority;
    isFlexible: boolean;
    partySize?: number;
    customPerPerson?: number | null;
    repeatConfig?: {
      enabled: boolean;
      mode: "SPECIFIC_DAYS" | "N_PER_WEEK";
      daysOfWeek: string;
      timesPerWeek: number;
      endType: "UNTIL_DATE" | "N_OCCURRENCES" | "THREE_MONTHS" | "ENDLESS";
      endDate: string;
      totalCount: number;
    };
  }) => Promise<void>;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TaskFormModal({
  isOpen,
  mode = "task",
  date,
  city,
  editingTask,
  initialTitle,
  initialWindowStart,
  initialWindowEnd,
  initialIsFlexible,
  allowLocationless = false,
  priceIntel,
  initialPartySize,
  initialCustomPerPerson,
  onClose,
  onSubmitTask,
}: TaskFormModalProps) {
  const [quickPhrase, setQuickPhrase] = useState("");
  const [formDate, setFormDate] = useState(editingTask?.date || date);
  const [title, setTitle] = useState(editingTask?.title || initialTitle || "");
  const [locationQuery, setLocationQuery] = useState(editingTask?.locationName || "");
  const [address, setAddress] = useState(editingTask?.address || "");
  const [lat, setLat] = useState<number | null>(editingTask?.lat ?? null);
  const [lng, setLng] = useState<number | null>(editingTask?.lng ?? null);
  const [showPlaceDropdown, setShowPlaceDropdown] = useState(false);
  const [windowStart, setWindowStart] = useState(
    editingTask?.windowStart ?? initialWindowStart ?? ""
  );
  const [windowEnd, setWindowEnd] = useState(
    editingTask?.windowEnd ?? initialWindowEnd ?? ""
  );
  const [durationMin, setDurationMin] = useState(editingTask?.durationMin ?? 30);
  const [priority, setPriority] = useState<TaskPriority>(editingTask?.priority || "MEDIUM");
  const [isFlexible, setIsFlexible] = useState(
    editingTask?.isFlexible ?? initialIsFlexible ?? (mode === "calendar" ? false : true)
  );
  const [partySize, setPartySize] = useState<number>(
    initialPartySize ?? editingTask?.partySize ?? 1
  );
  const [customPerPersonInput, setCustomPerPersonInput] = useState<string>(
    initialCustomPerPerson != null ? String(initialCustomPerPerson) : ""
  );

  useEffect(() => {
    if (!isOpen) return;
    setFormDate(editingTask?.date || date);
    setTitle(editingTask?.title || initialTitle || "");
    setLocationQuery(editingTask?.locationName || "");
    setAddress(editingTask?.address || "");
    setLat(editingTask?.lat ?? null);
    setLng(editingTask?.lng ?? null);
    const nextStart = editingTask?.windowStart ?? initialWindowStart ?? "";
    const nextEnd = editingTask?.windowEnd ?? initialWindowEnd ?? "";
    setWindowStart(nextStart);
    setWindowEnd(nextEnd);
    const sMin = parseTimeToMinutes(nextStart);
    const eMin = parseTimeToMinutes(nextEnd);
    setDurationMin(
      editingTask?.durationMin ??
        (sMin != null && eMin != null && eMin > sMin ? eMin - sMin : 30)
    );
    setPriority(editingTask?.priority || "MEDIUM");
    setIsFlexible(
      editingTask?.isFlexible ?? initialIsFlexible ?? (mode === "calendar" ? false : true)
    );
    setPartySize(initialPartySize ?? editingTask?.partySize ?? 1);
    setCustomPerPersonInput(
      initialCustomPerPerson != null ? String(initialCustomPerPerson) : ""
    );
    setQuickPhrase("");
    setErrorMsg(null);
  }, [
    isOpen,
    mode,
    date,
    editingTask,
    initialTitle,
    initialWindowStart,
    initialWindowEnd,
    initialIsFlexible,
    initialPartySize,
    initialCustomPerPerson,
  ]);

  const [livePlaceSuggestions, setLivePlaceSuggestions] = useState<PlacePreset[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [manualPickedPlace, setManualPickedPlace] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setManualPickedPlace(Boolean(editingTask?.lat != null));
  }, [isOpen, editingTask]);

  useEffect(() => {
    if (!isOpen) return;
    const q = locationQuery.trim();
    if (q.length < 2) {
      setLivePlaceSuggestions([]);
      setSearchingPlaces(false);
      return;
    }
    const controller = new AbortController();
    setSearchingPlaces(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchLivePlaces(q, city, controller.signal);
        setLivePlaceSuggestions(results);
        if (!manualPickedPlace && results.length > 0) {
          setAddress(results[0].address);
          setLat(results[0].lat);
          setLng(results[0].lng);
        }
      } finally {
        setSearchingPlaces(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, locationQuery, city, manualPickedPlace]);

  const applyQuickPhrase = (phrase: string) => {
    if (!phrase.trim()) return;
    const parsed = parseQuickAddText(phrase);
    if (parsed.title) setTitle(parsed.title);
    if (parsed.windowStart) setWindowStart(parsed.windowStart);
    if (parsed.windowEnd) setWindowEnd(parsed.windowEnd);
    setDurationMin(parsed.durationMin);
    setPriority(parsed.priority);
    setIsFlexible(parsed.isFlexible);
    if (parsed.partySize) setPartySize(parsed.partySize);
    const resolved = resolvePlaceByWords(phrase, city);
    if (resolved && resolved.lat && resolved.lng && !resolved.id.startsWith("custom-")) {
      setLocationQuery(resolved.name);
      setAddress(resolved.address);
      setLat(resolved.lat);
      setLng(resolved.lng);
    }
  };

  const calcWindowDurationMin = (start: string, end: string): number | null => {
    if (!start || !end) return null;
    const sMin = parseTimeToMinutes(start);
    const eMin = parseTimeToMinutes(end);
    if (sMin == null || eMin == null || eMin <= sMin) return null;
    return eMin - sMin;
  };

  const customPerPersonVal =
    customPerPersonInput.trim() !== "" && Number.isFinite(Number(customPerPersonInput))
      ? Math.max(0, Number(customPerPersonInput))
      : null;

  const budgetForecast = useMemo(
    () =>
      estimateVenueBudget({
        locationName: locationQuery,
        title,
        partySize,
        priceIntel: priceIntel ?? [],
        customPerPerson: customPerPersonVal,
      }),
    [locationQuery, title, partySize, priceIntel, customPerPersonVal]
  );

  // Recurring Task block (Section 6.2)
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"SPECIFIC_DAYS" | "N_PER_WEEK">("SPECIFIC_DAYS");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [timesPerWeek, setTimesPerWeek] = useState(3);
  const [endType, setEndType] = useState<"THREE_MONTHS" | "UNTIL_DATE" | "N_OCCURRENCES" | "ENDLESS">("THREE_MONTHS");
  const [endDate, setEndDate] = useState("2027-02-14");
  const [nOccurrences, setNOccurrences] = useState(39);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const citySuggestions = useMemo(
    () => searchPlacesLocal(locationQuery, city).slice(0, 6),
    [locationQuery, city]
  );

  const repeatSummary = useMemo(() => {
    const count =
      endType === "N_OCCURRENCES"
        ? nOccurrences
        : repeatMode === "N_PER_WEEK"
          ? timesPerWeek * (endType === "THREE_MONTHS" ? 13 : 12)
          : Math.max(1, selectedDays.length) * (endType === "THREE_MONTHS" ? 13 : 12);
    const label =
      repeatMode === "SPECIFIC_DAYS"
        ? selectedDays.join(", ") || "No days"
        : `${timesPerWeek}x per week (auto-picked)`;
    const suffix =
      endType === "ENDLESS"
        ? "Ongoing (auto-extends monthly)"
        : `until ${endDate} · ${count} sessions total`;
    return `${label} · ${suffix}`;
  }, [repeatMode, selectedDays, timesPerWeek, endType, endDate, nOccurrences]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please enter a task title.");
      return;
    }
    let finalLat = lat;
    let finalLng = lng;
    let finalLocationName = locationQuery.trim();
    let finalAddress = address.trim();

    if ((finalLat == null || finalLng == null) && finalLocationName) {
      const resolved = resolvePlaceByWords(finalLocationName, city);
      finalLat = resolved.lat;
      finalLng = resolved.lng;
      if (!finalAddress) finalAddress = resolved.address;
      if (resolved.id && !resolved.id.startsWith("custom-")) {
        finalLocationName = resolved.name;
      }
    }

    if ((finalLat == null || finalLng == null) && !allowLocationless) {
      setErrorMsg("Please type an address or place name to locate your stop.");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const effectiveFlex = !windowStart || !windowEnd ? true : isFlexible;
      await onSubmitTask({
        id: editingTask?.id,
        title: title.trim(),
        locationName: finalLocationName || finalAddress || null,
        address: finalAddress || finalLocationName || null,
        lat: finalLat,
        lng: finalLng,
        date: formDate || date,
        windowStart: windowStart || null,
        windowEnd: windowEnd || null,
        durationMin,
        priority,
        isFlexible: effectiveFlex,
        partySize,
        customPerPerson: customPerPersonVal,
        repeatConfig: repeatEnabled
          ? {
              enabled: true,
              mode: repeatMode,
              daysOfWeek: selectedDays.join(","),
              timesPerWeek,
              endType,
              endDate,
              totalCount:
                endType === "N_OCCURRENCES"
                  ? nOccurrences
                  : Math.max(1, selectedDays.length) * 13,
            }
          : undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const modalHeading = editingTask
    ? "Edit Stop / Event"
    : mode === "calendar"
      ? "New Event"
      : "Add Stop / Event";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalHeading}
      subtitle={`${formDate || date} · ${city}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Fill Bar (Shared natural-language parser) */}
        {!editingTask ? (
          <div className="rounded-2xl border border-[#DFDBD0] bg-[#FAF6EA]/70 p-3 space-y-2">
            <label
              htmlFor="task-quick-fill"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#2F453B]"
            >
              <Zap className="h-3.5 w-3.5 text-[#C67D63]" aria-hidden="true" />
              Quick fill from a phrase (optional)
            </label>
            <div className="flex gap-2">
              <input
                id="task-quick-fill"
                value={quickPhrase}
                onChange={(e) => setQuickPhrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyQuickPhrase(quickPhrase);
                  }
                }}
                placeholder='e.g. "Coffee for 2 at 15:00" or "Pharmacy, 10 min"'
                className={`${inputClass} bg-white`}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applyQuickPhrase(quickPhrase)}
              >
                Fill
              </Button>
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="task-title" className="block text-xs font-semibold text-[#2F453B] mb-1">
            Title
          </label>
          <input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              mode === "calendar"
                ? "e.g. Client coffee or Dentist"
                : "e.g. Drop off passport at Visa Center"
            }
            className={inputClass}
          />
        </div>

        {/* Date, Start & End Times + Auto Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="task-date" className="block text-xs font-semibold text-[#2F453B] mb-1">
              Date
            </label>
            <input
              id="task-date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label htmlFor="task-wstart" className="block text-xs font-semibold text-[#2F453B] mb-1">
              Start Time
            </label>
            <input
              id="task-wstart"
              type="time"
              value={windowStart}
              onChange={(e) => {
                const nextStart = e.target.value;
                setWindowStart(nextStart);
                if (nextStart && windowEnd) {
                  setIsFlexible(false);
                  const autoDur = calcWindowDurationMin(nextStart, windowEnd);
                  if (autoDur != null && autoDur >= 5) {
                    setDurationMin(autoDur);
                  }
                }
              }}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label htmlFor="task-wend" className="block text-xs font-semibold text-[#2F453B] mb-1">
              End Time
            </label>
            <input
              id="task-wend"
              type="time"
              value={windowEnd}
              onChange={(e) => {
                const nextEnd = e.target.value;
                setWindowEnd(nextEnd);
                if (windowStart && nextEnd) {
                  setIsFlexible(false);
                  const autoDur = calcWindowDurationMin(windowStart, nextEnd);
                  if (autoDur != null && autoDur >= 5) {
                    setDurationMin(autoDur);
                  }
                }
              }}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label htmlFor="task-dur" className="block text-xs font-semibold text-[#2F453B] mb-1">
              Duration (min)
            </label>
            <input
              id="task-dur"
              type="number"
              min={5}
              max={480}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value) || 30)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
        </div>

        {/* Word-based Address Autocomplete & Place Presets */}
        <div className="relative space-y-2 rounded-2xl border border-[#DFDBD0] bg-white p-3.5">
          <label htmlFor="task-place" className="flex items-center gap-1.5 text-xs font-semibold text-[#2F453B]">
            <MapPin className="h-3.5 w-3.5 text-[#C67D63]" aria-hidden="true" />
            Place or Address ({city}){allowLocationless ? " · optional" : ""}
          </label>
          <input
            id="task-place"
            value={locationQuery}
            onFocus={() => setShowPlaceDropdown(true)}
            onBlur={() => {
              window.setTimeout(async () => {
                setShowPlaceDropdown(false);
                if (lat == null && locationQuery.trim()) {
                  const resolved = await resolveAddressWithLiveFallback(locationQuery, city);
                  setAddress(resolved.address);
                  setLat(resolved.lat);
                  setLng(resolved.lng);
                }
              }, 160);
            }}
            onChange={(e) => {
              const val = e.target.value;
              setLocationQuery(val);
              setManualPickedPlace(false);
              setShowPlaceDropdown(true);
              if (val.trim().length > 0) {
                const localTop = searchPlacesLocal(val, city)[0];
                if (localTop) {
                  setAddress(localTop.address);
                  setLat(localTop.lat);
                  setLng(localTop.lng);
                } else {
                  setAddress(val.trim());
                  setLat(null);
                  setLng(null);
                }
              } else {
                setAddress("");
                setLat(null);
                setLng(null);
              }
            }}
            placeholder={`Type street & house in ${city} (e.g. Кабанбай Батыра 55, Dostyk 16...)`}
            className={inputClass}
          />

          {showPlaceDropdown && locationQuery.trim().length > 0 && (livePlaceSuggestions.length > 0 || citySuggestions.length > 0 || searchingPlaces) ? (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[#DFDBD0] bg-[#F6F4EF] divide-y divide-[#DFDBD0]/60 shadow-sm">
              {searchingPlaces && livePlaceSuggestions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#5E766B]">
                  Searching {city} addresses...
                </div>
              ) : null}
              {(livePlaceSuggestions.length > 0 ? livePlaceSuggestions : citySuggestions).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setLocationQuery(p.address && p.address !== p.name ? `${p.name} — ${p.address}` : p.name);
                    setAddress(p.address);
                    setLat(p.lat);
                    setLng(p.lng);
                    setManualPickedPlace(true);
                    setErrorMsg(null);
                    setShowPlaceDropdown(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-white cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-[#2F453B] truncate">{p.name}</div>
                    <div className="text-[11px] text-[#5E766B] truncate">{p.address}</div>
                  </div>
                  <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-[#5E766B] border border-[#DFDBD0]">
                    {p.category}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {(livePlaceSuggestions.length > 0 ? livePlaceSuggestions.slice(0, 5) : citySuggestions).map((p) => {
              const selected = lat === p.lat && lng === p.lng;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setLocationQuery(p.name);
                    setAddress(p.address);
                    setLat(p.lat);
                    setLng(p.lng);
                    setErrorMsg(null);
                    setShowPlaceDropdown(false);
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                    selected
                      ? "border-[#C67D63] bg-[#F4E8E3] text-[#B26B52]"
                      : "border-[#DFDBD0] bg-[#F6F4EF] text-[#2F453B] hover:bg-[#ECE9E1]"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          {lat != null && lng != null ? (
            <p className="text-[11px] font-medium text-[#3F7A63] tabular-nums">
              Location matched: {address || locationQuery}
            </p>
          ) : null}
        </div>

        {/* Priority & Fixed Time Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DFDBD0] bg-white p-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#2F453B]">Priority:</span>
            {(["HIGH", "MEDIUM", "LOW"] as TaskPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold cursor-pointer ${
                  priority === p
                    ? "bg-[#2F453B] text-[#F6F4EF]"
                    : "bg-[#ECE9E1] text-[#2F453B]"
                }`}
              >
                {p === "HIGH" ? "High" : p === "MEDIUM" ? "Normal" : "Low"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <label htmlFor="task-flex-switch" className="text-xs font-semibold text-[#2F453B]">
              Fixed time
            </label>
            <Switch
              id="task-flex-switch"
              label="Toggle fixed time"
              checked={!isFlexible}
              onCheckedChange={(checked) => setIsFlexible(!checked)}
            />
          </div>
        </div>

        {/* Party Size & Expected Cost */}
        <div className="rounded-2xl border border-[#DFDBD0] bg-[#F6F4EF]/75 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2F453B]">
              <Wallet className="h-3.5 w-3.5 text-[#C67D63]" aria-hidden="true" />
              People &amp; Estimated Spend
            </div>
            <Badge variant={budgetForecast.source === "PRICE_INTEL" ? "safe" : "neutral"}>
              {budgetForecast.sourceLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label htmlFor="task-party-size" className="block text-[11px] font-semibold text-[#5E766B] mb-1">
                Paying for (people)
              </label>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#5E766B] shrink-0" aria-hidden="true" />
                <input
                  id="task-party-size"
                  type="number"
                  min={1}
                  max={12}
                  value={partySize}
                  onChange={(e) =>
                    setPartySize(Math.max(1, Math.min(12, Number(e.target.value) || 1)))
                  }
                  className={`${inputClass} min-h-[38px] tabular-nums`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="task-custom-per-person" className="block text-[11px] font-semibold text-[#5E766B] mb-1">
                Override $/person (opt)
              </label>
              <input
                id="task-custom-per-person"
                type="number"
                min={0}
                step="0.5"
                value={customPerPersonInput}
                onChange={(e) => setCustomPerPersonInput(e.target.value)}
                placeholder={`Auto $${budgetForecast.perPerson.toFixed(2)}`}
                className={`${inputClass} min-h-[38px] tabular-nums`}
              />
            </div>

            <div className="rounded-xl border border-[#DFDBD0] bg-white px-3 py-2 text-right tabular-nums">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#5E766B]">
                Estimated Check
              </div>
              <div className="text-sm font-bold text-[#2F453B]">
                ${budgetForecast.total.toFixed(2)}{" "}
                <span className="text-[11px] font-normal text-[#5E766B]">
                  (${budgetForecast.perPerson.toFixed(2)} × {partySize})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Repeat / Recurring Series Toggle (Section 6.2) */}
        {!editingTask ? (
          <div className="rounded-2xl border border-[#DFDBD0] bg-white p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-[#C67D63]" aria-hidden="true" />
                <label htmlFor="repeat-switch" className="text-sm font-semibold">
                  Repeat (Recurring Series)
                </label>
              </div>
              <Switch
                id="repeat-switch"
                label="Repeat task"
                checked={repeatEnabled}
                onCheckedChange={setRepeatEnabled}
              />
            </div>

            {repeatEnabled ? (
              <div className="space-y-3 pt-2 border-t border-[#DFDBD0]">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepeatMode("SPECIFIC_DAYS")}
                    className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold border cursor-pointer ${
                      repeatMode === "SPECIFIC_DAYS"
                        ? "border-[#C67D63] bg-[#F4E8E3] text-[#B26B52]"
                        : "border-[#DFDBD0] bg-[#F6F4EF]"
                    }`}
                  >
                    Specific Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatMode("N_PER_WEEK")}
                    className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold border cursor-pointer ${
                      repeatMode === "N_PER_WEEK"
                        ? "border-[#C67D63] bg-[#F4E8E3] text-[#B26B52]"
                        : "border-[#DFDBD0] bg-[#F6F4EF]"
                    }`}
                  >
                    N Times / Week (Auto)
                  </button>
                </div>

                {repeatMode === "SPECIFIC_DAYS" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`min-h-[36px] min-w-[44px] rounded-lg px-2 text-xs font-semibold cursor-pointer ${
                          selectedDays.includes(day)
                            ? "bg-[#2F453B] text-[#F6F4EF]"
                            : "bg-[#ECE9E1] text-[#2F453B]"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label htmlFor="times-pw" className="text-xs font-medium">
                      Sessions per week:
                    </label>
                    <input
                      id="times-pw"
                      type="number"
                      min={1}
                      max={7}
                      value={timesPerWeek}
                      onChange={(e) => setTimesPerWeek(Math.max(1, Math.min(7, Number(e.target.value))))}
                      className="w-20 min-h-[38px] rounded-lg border border-[#DFDBD0] px-2.5 text-sm tabular-nums"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: "THREE_MONTHS", label: "3 Months" },
                      { id: "UNTIL_DATE", label: "Until Date" },
                      { id: "N_OCCURRENCES", label: "N Sessions" },
                      { id: "ENDLESS", label: "Endless" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEndType(p.id)}
                      className={`min-h-[36px] rounded-lg px-2 text-xs font-medium border cursor-pointer ${
                        endType === p.id
                          ? "border-[#2F453B] bg-[#2F453B] text-[#F6F4EF]"
                          : "border-[#DFDBD0] bg-[#F6F4EF]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {endType === "UNTIL_DATE" ? (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputClass}
                  />
                ) : null}

                {endType === "N_OCCURRENCES" ? (
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={nOccurrences}
                    onChange={(e) => setNOccurrences(Number(e.target.value) || 12)}
                    className={inputClass}
                  />
                ) : null}

                <div className="flex items-center gap-2 rounded-xl bg-[#F6F4EF] px-3 py-2 text-xs font-medium text-[#2F453B]">
                  <Sparkles className="h-3.5 w-3.5 text-[#C67D63] shrink-0" aria-hidden="true" />
                  <span>{repeatSummary}</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {errorMsg ? (
          <p role="alert" className="rounded-xl bg-[#F5E6E6] border border-[#E4C7C7] px-3 py-2 text-xs text-[#B05454]">
            {errorMsg}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting
              ? "Saving..."
              : editingTask
                ? "Save Changes"
                : mode === "calendar"
                  ? "Save Event"
                  : "Save Stop"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
