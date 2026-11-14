import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/errors";
import { decodeGooglePolyline } from "@/lib/polyline";
import { getActiveUser } from "@/lib/session";
import { haversineKm } from "@/lib/utils";

const legInputSchema = z.object({
  id: z.string().min(1).max(120),
  fromLat: z.number().min(-90).max(90),
  fromLng: z.number().min(-180).max(180),
  toLat: z.number().min(-90).max(90),
  toLng: z.number().min(-180).max(180),
  mode: z.enum(["WALK", "TRANSIT", "CAR", "TAXI", "CARPOOL"]).default("TRANSIT"),
});

const geometryRequestSchema = z.object({
  legs: z.array(legInputSchema).min(1).max(16),
  offline: z.boolean().optional(),
});

export interface RouteLegGeometry {
  id: string;
  mode: "WALK" | "TRANSIT" | "CAR" | "TAXI" | "CARPOOL";
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  streets: string[];
  source: "GOOGLE" | "OSRM" | "DIRECT";
}

interface CacheEntry {
  value: Omit<RouteLegGeometry, "id">;
  expiresAt: number;
}

const GEOMETRY_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_CACHE_ENTRIES = 250;

function makeCacheKey(leg: z.infer<typeof legInputSchema>): string {
  return `${leg.fromLat.toFixed(4)},${leg.fromLng.toFixed(4)}->${leg.toLat.toFixed(4)},${leg.toLng.toFixed(4)}:${leg.mode}`;
}

function setCachedGeometry(key: string, value: Omit<RouteLegGeometry, "id">): void {
  if (GEOMETRY_CACHE.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = GEOMETRY_CACHE.keys().next().value;
    if (oldestKey) GEOMETRY_CACHE.delete(oldestKey);
  }
  GEOMETRY_CACHE.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function estimateModeMinutes(mode: RouteLegGeometry["mode"], distanceKm: number, googleOrOsrmMin?: number): number {
  if (mode === "WALK") {
    return googleOrOsrmMin ?? Math.max(2, Math.round(distanceKm * 12.5));
  }
  if (mode === "CAR" || mode === "CARPOOL") {
    return googleOrOsrmMin ?? Math.max(4, Math.round(distanceKm * 2.1 + 3));
  }
  if (mode === "TAXI") {
    return googleOrOsrmMin ?? Math.max(4, Math.round(distanceKm * 1.85 + 2));
  }
  return googleOrOsrmMin ?? Math.max(4, Math.round(distanceKm * 4.2));
}

async function fetchGoogleLegGeometry(
  leg: z.infer<typeof legInputSchema>,
  googleKey: string
): Promise<Omit<RouteLegGeometry, "id"> | null> {
  try {
    const travelMode =
      leg.mode === "WALK"
        ? "walking"
        : leg.mode === "CAR" || leg.mode === "TAXI" || leg.mode === "CARPOOL"
          ? "driving"
          : "transit";
    const url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${leg.fromLat},${leg.fromLng}` +
      `&destination=${leg.toLat},${leg.toLng}&mode=${travelMode}&key=${encodeURIComponent(googleKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (data.status !== "OK" || !route?.overview_polyline?.points) return null;

    const coordinates = decodeGooglePolyline(route.overview_polyline.points);
    if (coordinates.length < 2) return null;

    const firstLeg = route.legs?.[0];
    const distanceKm = firstLeg?.distance?.value
      ? Number((firstLeg.distance.value / 1000).toFixed(2))
      : Number(haversineKm(leg.fromLat, leg.fromLng, leg.toLat, leg.toLng).toFixed(2));
    const durationMin = firstLeg?.duration?.value
      ? Math.max(1, Math.round(firstLeg.duration.value / 60))
      : estimateModeMinutes(leg.mode, distanceKm);

    const streets: string[] = [];
    for (const step of firstLeg?.steps || []) {
      const clean = String(step.html_instructions || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (clean && streets.length < 4) streets.push(clean);
    }

    return {
      mode: leg.mode,
      coordinates,
      distanceKm,
      durationMin,
      streets,
      source: "GOOGLE",
    };
  } catch {
    return null;
  }
}

async function fetchOsrmLegGeometry(
  leg: z.infer<typeof legInputSchema>
): Promise<Omit<RouteLegGeometry, "id"> | null> {
  const profile = leg.mode === "WALK" ? "foot" : "driving";
  const url =
    `https://router.project-osrm.org/route/v1/${profile}/` +
    `${leg.fromLng},${leg.fromLat};${leg.toLng},${leg.toLat}` +
    `?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    const rawCoords: [number, number][] | undefined = route?.geometry?.coordinates;
    if (data.code !== "Ok" || !rawCoords || rawCoords.length < 2) return null;

    // GeoJSON returns [lng, lat]; Leaflet expects [lat, lng]
    const coordinates: [number, number][] = rawCoords.map(([lng, lat]) => [lat, lng]);
    const distanceKm = Number(((route.distance || 0) / 1000).toFixed(2));
    const baseDriveMin = Math.max(4, Math.round((route.duration || 0) / 60));
    const durationMin =
      leg.mode === "WALK"
        ? estimateModeMinutes("WALK", distanceKm)
        : leg.mode === "CAR" || leg.mode === "CARPOOL"
          ? Math.max(4, Math.round(baseDriveMin * 1.15 + 2))
          : leg.mode === "TAXI"
            ? Math.max(4, Math.round(baseDriveMin + 2))
            : Math.max(4, Math.round(baseDriveMin * 1.35 + 3));

    const streets: string[] = [];
    const seen = new Set<string>();
    for (const step of route.legs?.[0]?.steps || []) {
      const name = typeof step.name === "string" ? step.name.trim() : "";
      if (name && !seen.has(name) && streets.length < 4) {
        seen.add(name);
        streets.push(name);
      }
    }

    return {
      mode: leg.mode,
      coordinates,
      distanceKm,
      durationMin,
      streets,
      source: "OSRM",
    };
  } catch {
    return null;
  }
}

function buildDirectFallback(leg: z.infer<typeof legInputSchema>): Omit<RouteLegGeometry, "id"> {
  const distKm = Number((haversineKm(leg.fromLat, leg.fromLng, leg.toLat, leg.toLng) * 1.25).toFixed(2));
  return {
    mode: leg.mode,
    coordinates: [
      [leg.fromLat, leg.fromLng],
      [leg.toLat, leg.toLng],
    ],
    distanceKm: distKm,
    durationMin: estimateModeMinutes(leg.mode, distKm),
    streets: [],
    source: "DIRECT",
  };
}

export async function POST(req: NextRequest) {
  try {
    await getActiveUser();
    const body = await req.json();
    const input = geometryRequestSchema.parse(body);

    const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || "";

    const legs: RouteLegGeometry[] = await Promise.all(
      input.legs.map(async (leg) => {
        if (input.offline) {
          return { id: leg.id, ...buildDirectFallback(leg) };
        }

        const key = makeCacheKey(leg);
        const cached = GEOMETRY_CACHE.get(key);
        if (cached && cached.expiresAt > Date.now()) {
          return { id: leg.id, ...cached.value };
        }

        const fromGoogle = googleKey ? await fetchGoogleLegGeometry(leg, googleKey) : null;
        if (fromGoogle) {
          setCachedGeometry(key, fromGoogle);
          return { id: leg.id, ...fromGoogle };
        }

        const fromOsrm = await fetchOsrmLegGeometry(leg);
        if (fromOsrm) {
          setCachedGeometry(key, fromOsrm);
          return { id: leg.id, ...fromOsrm };
        }

        return { id: leg.id, ...buildDirectFallback(leg) };
      })
    );

    return NextResponse.json({ legs });
  } catch (error) {
    return handleApiError(error);
  }
}
