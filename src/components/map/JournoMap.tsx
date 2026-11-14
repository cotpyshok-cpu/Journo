"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Compass, Navigation } from "lucide-react";
import type { RouteLegGeometry } from "@/app/api/route/geometry/route";
import { TaskItem, TravelMode } from "@/lib/types";

interface JournoMapProps {
  origin: { lat: number; lng: number; label: string };
  tasks: TaskItem[];
  activeTaskId?: string | null;
  pickMode?: boolean;
  pickedCoords?: { lat: number; lng: number } | null;
  onPickLocation?: (lat: number, lng: number) => void;
  onSelectTask?: (taskId: string) => void;
  offline?: boolean;
  heightClass?: string;
}

const MODE_STYLE: Record<
  TravelMode,
  { color: string; dashArray?: string; label: string; googleMode: string }
> = {
  WALK: { color: "#2F453B", dashArray: "5, 8", label: "Walk", googleMode: "walking" },
  TRANSIT: { color: "#C67D63", label: "Transit", googleMode: "transit" },
  CAR: { color: "#3F7A63", label: "Car", googleMode: "driving" },
  TAXI: { color: "#9C6B3B", dashArray: "8, 6", label: "Taxi", googleMode: "driving" },
  CARPOOL: { color: "#5C7D8E", label: "Friend Ride", googleMode: "driving" },
};

function createSafePopupElement(
  heading: string,
  subline?: string,
  etaLine?: string,
  coords?: { lat: number; lng: number; mode: TravelMode }
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.minWidth = "175px";

  const strong = document.createElement("strong");
  strong.style.color = "#2F453B";
  strong.textContent = heading;
  wrapper.appendChild(strong);

  if (subline) {
    wrapper.appendChild(document.createElement("br"));
    const subSpan = document.createElement("span");
    subSpan.style.fontSize = "12px";
    subSpan.style.color = "#5E766B";
    subSpan.textContent = subline;
    wrapper.appendChild(subSpan);
  }

  if (etaLine) {
    wrapper.appendChild(document.createElement("br"));
    const etaSpan = document.createElement("span");
    etaSpan.style.fontSize = "12px";
    etaSpan.style.fontWeight = "600";
    etaSpan.style.color = "#C67D63";
    etaSpan.textContent = etaLine;
    wrapper.appendChild(etaSpan);
  }

  if (coords) {
    const linksRow = document.createElement("div");
    linksRow.style.display = "flex";
    linksRow.style.gap = "10px";
    linksRow.style.marginTop = "6px";
    linksRow.style.paddingTop = "5px";
    linksRow.style.borderTop = "1px solid #DFDBD0";
    linksRow.style.fontSize = "11px";
    linksRow.style.fontWeight = "600";

    const gmaps = document.createElement("a");
    gmaps.href = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=${MODE_STYLE[coords.mode].googleMode}`;
    gmaps.target = "_blank";
    gmaps.rel = "noopener noreferrer";
    gmaps.style.color = "#2F453B";
    gmaps.textContent = "Google Maps ↗";
    linksRow.appendChild(gmaps);

    const twogis = document.createElement("a");
    twogis.href = `https://2gis.kz/geo/${coords.lng},${coords.lat}`;
    twogis.target = "_blank";
    twogis.rel = "noopener noreferrer";
    twogis.style.color = "#C67D63";
    twogis.textContent = "2GIS ↗";
    linksRow.appendChild(twogis);

    wrapper.appendChild(linksRow);
  }

  return wrapper;
}

export function JournoMap({
  origin,
  tasks,
  activeTaskId,
  pickMode = false,
  pickedCoords,
  onPickLocation,
  onSelectTask,
  offline = false,
  heightClass = "h-[360px] lg:h-[540px]",
}: JournoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const lastFittedSigRef = useRef<string>("");
  const onPickRef = useRef(onPickLocation);
  const pickModeRef = useRef(pickMode);

  onPickRef.current = onPickLocation;
  pickModeRef.current = pickMode;

  const routable = useMemo(
    () =>
      tasks
        .filter((t) => t.lat != null && t.lng != null && t.status !== "SKIPPED" && !t.exceedsFreeLimit)
        .sort((a, b) => (a.plannedOrder ?? 999) - (b.plannedOrder ?? 999)),
    [tasks]
  );

  const legSpecs = useMemo(() => {
    const specs: {
      id: string;
      toTaskId: string;
      toTitle: string;
      orderLabel: number;
      fromLat: number;
      fromLng: number;
      toLat: number;
      toLng: number;
      mode: TravelMode;
      estMin: number | null;
      estKm: number | null;
    }[] = [];

    let prevLat = origin.lat;
    let prevLng = origin.lng;
    let prevId = "ORIGIN";

    routable.forEach((task, idx) => {
      const mode: TravelMode = task.legMode ?? "TRANSIT";
      const estMin =
        mode === "WALK"
          ? task.legDurationWalkMin
          : (mode === "CAR" || mode === "CARPOOL") && task.legDistanceKm != null
            ? Math.max(4, Math.round(task.legDistanceKm * 2.1 + 3))
            : mode === "TAXI" && task.legDistanceKm != null
              ? Math.max(4, Math.round(task.legDistanceKm * 1.85 + 2))
              : task.legDurationTransitMin;
      specs.push({
        id: `${prevId}->${task.id}`,
        toTaskId: task.id,
        toTitle: task.title,
        orderLabel: task.plannedOrder ?? idx + 1,
        fromLat: prevLat,
        fromLng: prevLng,
        toLat: task.lat!,
        toLng: task.lng!,
        mode,
        estMin,
        estKm: task.legDistanceKm,
      });
      prevLat = task.lat!;
      prevLng = task.lng!;
      prevId = task.id;
    });

    return specs;
  }, [origin.lat, origin.lng, routable]);

  const legSignature = useMemo(
    () =>
      legSpecs
        .map(
          (l) =>
            `${l.id}:${l.fromLat.toFixed(4)},${l.fromLng.toFixed(4)}->${l.toLat.toFixed(4)},${l.toLng.toFixed(4)}:${l.mode}`
        )
        .join("|"),
    [legSpecs]
  );

  const [legGeometries, setLegGeometries] = useState<Map<string, RouteLegGeometry>>(new Map());
  const [loadingRoads, setLoadingRoads] = useState(false);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [origin.lat, origin.lng],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (pickModeRef.current && onPickRef.current) {
        onPickRef.current(
          Number(e.latlng.lat.toFixed(5)),
          Number(e.latlng.lng.toFixed(5))
        );
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      layerGroupRef.current = null;
    };
  }, [origin.lat, origin.lng]);

  // Manage OSM base tiles based on offline flag
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (offline) {
      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }
      return;
    }

    if (!tileLayerRef.current) {
      tileLayerRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
        className: "journo-map-tiles",
      }).addTo(map);
    }
  }, [offline]);

  // Fetch street-following route geometry for every leg
  useEffect(() => {
    if (legSpecs.length === 0) {
      setLegGeometries(new Map());
      return;
    }

    if (offline) {
      const direct = new Map<string, RouteLegGeometry>();
      for (const spec of legSpecs) {
        direct.set(spec.id, {
          id: spec.id,
          mode: spec.mode,
          coordinates: [
            [spec.fromLat, spec.fromLng],
            [spec.toLat, spec.toLng],
          ],
          distanceKm: spec.estKm ?? 0,
          durationMin: spec.estMin ?? 0,
          streets: [],
          source: "DIRECT",
        });
      }
      setLegGeometries(direct);
      return;
    }

    const controller = new AbortController();
    setLoadingRoads(true);

    fetch("/api/route/geometry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offline: false,
        legs: legSpecs.map((l) => ({
          id: l.id,
          fromLat: l.fromLat,
          fromLng: l.fromLng,
          toLat: l.toLat,
          toLng: l.toLng,
          mode: l.mode,
        })),
      }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.legs) return;
        const nextMap = new Map<string, RouteLegGeometry>();
        for (const item of data.legs as RouteLegGeometry[]) {
          nextMap.set(item.id, item);
        }
        setLegGeometries(nextMap);
      })
      .catch(() => {
        // Silent abort or offline fallback; direct path renders automatically
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingRoads(false);
        }
      });

    return () => controller.abort();
  }, [legSignature, offline, legSpecs]);

  // Render markers, street-following route legs, directional arrows, and bounds
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const boundsPoints: L.LatLngExpression[] = [[origin.lat, origin.lng]];

    // Origin / Home / Temp Base marker
    const homeIcon = L.divIcon({
      className: "journo-pin-wrapper",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `<div style="width:34px;height:34px;border-radius:11px;background:#2F453B;border:2.5px solid #F6F4EF;color:#F6F4EF;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;box-shadow:0 2px 8px rgba(22,59,50,0.28);">H</div>`,
    });
    L.marker([origin.lat, origin.lng], { icon: homeIcon })
      .bindPopup(createSafePopupElement("Start Base", origin.label))
      .addTo(group);

    // Draw each route leg along street geometry with 2GIS/Google Maps style casing
    for (const spec of legSpecs) {
      const geom = legGeometries.get(spec.id);
      const pathCoords: [number, number][] =
        geom && geom.coordinates.length >= 2
          ? geom.coordinates
          : [
              [spec.fromLat, spec.fromLng],
              [spec.toLat, spec.toLng],
            ];

      for (const pt of pathCoords) {
        boundsPoints.push(pt);
      }

      const isActiveLeg = activeTaskId === spec.toTaskId;
      const style = MODE_STYLE[spec.mode] ?? MODE_STYLE.TRANSIT;

      // White/cream route halo under the colored street path
      L.polyline(pathCoords, {
        color: "#F6F4EF",
        weight: isActiveLeg ? 9 : 7,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(group);

      const legLine = L.polyline(pathCoords, {
        color: style.color,
        weight: isActiveLeg ? 5.5 : 4,
        opacity: isActiveLeg ? 1 : 0.9,
        dashArray: style.dashArray,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(group);

      const distText = (geom?.distanceKm ?? spec.estKm ?? 0).toFixed(1);
      const minText = spec.estMin ?? geom?.durationMin ?? 0;
      const streetLabel =
        geom?.streets && geom.streets.length > 0
          ? `via ${geom.streets.join(" → ")}`
          : geom?.source === "DIRECT"
            ? "Direct route estimate"
            : "Street route";

      legLine.bindPopup(
        createSafePopupElement(
          `Stop #${spec.orderLabel}: ${spec.toTitle}`,
          streetLabel,
          `${style.label} · ${distText} km · ~${minText} min`
        )
      );

      // Directional arrowhead placed at the midpoint along the actual road path
      if (pathCoords.length >= 2) {
        const midIdx = Math.min(
          pathCoords.length - 2,
          Math.max(0, Math.floor((pathCoords.length - 1) / 2))
        );
        const [lat1, lng1] = pathCoords[midIdx];
        const [lat2, lng2] = pathCoords[midIdx + 1];
        const midLat = (lat1 + lat2) / 2;
        const midLng = (lng1 + lng2) / 2;
        const angleDeg = (Math.atan2(lng2 - lng1, lat2 - lat1) * 180) / Math.PI;
        const strokeColor = style.color;

        const arrowIcon = L.divIcon({
          className: "journo-pin-wrapper",
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          html: `<div style="width:20px;height:20px;border-radius:999px;background:#F6F4EF;border:1.5px solid ${strokeColor};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(22,59,50,0.22);transform:rotate(${angleDeg}deg);"><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M6 2L2.5 5.5M6 2L9.5 5.5" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`,
        });
        L.marker([midLat, midLng], { icon: arrowIcon, interactive: false }).addTo(group);
      }
    }

    routable.forEach((task, idx) => {
      const lat = task.lat!;
      const lng = task.lng!;
      boundsPoints.push([lat, lng]);
      const isActive = task.id === activeTaskId;
      const isDone = task.status === "DONE";
      const bg = isDone ? "#3F7A63" : task.isFlexible ? "#C67D63" : "#2F453B";
      const ring = isActive ? "0 0 0 4px rgba(217,98,59,0.35)" : "0 2px 8px rgba(22,59,50,0.28)";
      const labelNum = task.plannedOrder ?? idx + 1;
      const mode: TravelMode = task.legMode ?? "TRANSIT";

      const markerHtml = isDone
        ? `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : String(labelNum);

      const pinIcon = L.divIcon({
        className: "journo-pin-wrapper",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        html: `<div style="width:32px;height:32px;border-radius:999px;background:${bg};border:2.5px solid #F6F4EF;color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-variant-numeric:tabular-nums;box-shadow:${ring};">${markerHtml}</div>`,
      });

      const marker = L.marker([lat, lng], { icon: pinIcon })
        .bindPopup(
          createSafePopupElement(
            `${isDone ? "✓" : `${labelNum}.`} ${task.title}`,
            task.locationName || task.address || "",
            isDone
              ? "Completed"
              : task.eta
                ? `ETA ${task.eta} (${MODE_STYLE[mode].label})`
                : undefined,
            { lat, lng, mode }
          )
        )
        .addTo(group);

      marker.on("click", () => {
        if (onSelectTask) onSelectTask(task.id);
      });
    });

    if (pickedCoords) {
      boundsPoints.push([pickedCoords.lat, pickedCoords.lng]);
      const pickedIcon = L.divIcon({
        className: "journo-pin-wrapper",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `<div style="width:28px;height:28px;border-radius:999px;background:#C67D63;border:3px solid #FFFFFF;box-shadow:0 0 0 4px rgba(217,98,59,0.3);"></div>`,
      });
      L.marker([pickedCoords.lat, pickedCoords.lng], { icon: pickedIcon }).addTo(group);
    }

    if (boundsPoints.length > 1) {
      const nextBounds = L.latLngBounds(boundsPoints);
      boundsRef.current = nextBounds;
      const fitSig = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${legSignature}|${legGeometries.size}`;
      if (lastFittedSigRef.current !== fitSig) {
        lastFittedSigRef.current = fitSig;
        map.fitBounds(nextBounds, { padding: [36, 36], maxZoom: 14 });
      }
    } else {
      boundsRef.current = null;
      if (lastFittedSigRef.current !== "origin-only") {
        lastFittedSigRef.current = "origin-only";
        map.setView([origin.lat, origin.lng], 13);
      }
    }
  }, [origin, routable, legSpecs, legGeometries, legSignature, activeTaskId, pickedCoords, onSelectTask]);

  const hasStreetGeometry = Array.from(legGeometries.values()).some(
    (g) => g.source === "OSRM" || g.source === "GOOGLE"
  );

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-[#DFDBD0] bg-[#ECE9E1] ${heightClass}`}>
      <div ref={containerRef} className="h-full w-full z-0" />

      {/* Top-right Fit Route Control */}
      {routable.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            if (mapRef.current && boundsRef.current) {
              mapRef.current.fitBounds(boundsRef.current, { padding: [36, 36], maxZoom: 14 });
            }
          }}
          className="absolute top-3 right-3 z-[400] inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[#DFDBD0] bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#2F453B] shadow-sm hover:bg-[#F6F4EF] cursor-pointer"
        >
          <Compass className="h-3.5 w-3.5 text-[#C67D63]" aria-hidden="true" />
          Fit Route
        </button>
      ) : null}

      {/* Bottom-left Street Route Legend */}
      {routable.length > 0 && !pickMode ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-2.5 rounded-xl border border-[#DFDBD0] bg-white/92 px-2.5 py-1.5 text-[11px] font-medium text-[#2F453B] shadow-sm backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded-full bg-[#C67D63]" />
            Transit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-[#2F453B]" />
            Walk
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-4 rounded-full bg-[#3F7A63]" />
            Car
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-[#9C6B3B]" />
            Taxi
          </span>
          <span className="inline-flex items-center gap-1 text-[#5E766B]">
            <Navigation className="h-3 w-3 text-[#C67D63]" aria-hidden="true" />
            {loadingRoads
              ? "Building streets..."
              : offline
                ? "Offline direct"
                : hasStreetGeometry
                  ? "Street route"
                  : "Direct estimate"}
          </span>
        </div>
      ) : null}

      {offline ? (
        <div className="pointer-events-none absolute top-3 left-3 z-[400] rounded-xl bg-[#2F453B]/90 px-3 py-1.5 text-xs font-medium text-[#F6F4EF]">
          Offline Cached Geometry (Map tiles paused)
        </div>
      ) : null}
      {pickMode ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[400] rounded-xl bg-[#2F453B]/90 px-3.5 py-2 text-xs font-medium text-[#F6F4EF] text-center">
          Click anywhere on the map to set stop coordinates
        </div>
      ) : null}
    </div>
  );
}
