import { NextRequest, NextResponse } from "next/server";
import {
  CITY_PRESETS,
  CityPreset,
  PlacePreset,
  searchPlacesLocal,
} from "@/lib/astana-places";

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_value?: string;
    osm_key?: string;
  };
}

interface NominatimItem {
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
  };
}

function getCityPreset(city: string): CityPreset {
  return (
    CITY_PRESETS.find((c) => c.name.toLowerCase() === city.trim().toLowerCase()) ??
    CITY_PRESETS[0]
  );
}

function distanceSq(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return dLat * dLat + dLng * dLng;
}

const CITY_ALIAS: Record<string, string[]> = {
  Astana: ["astana", "астана", "нур-султан", "nur-sultan", "есіл", "алматы ауданы", "сарыарқа", "нұра"],
  Almaty: ["almaty", "алматы"],
  London: ["london"],
  Tokyo: ["tokyo", "東京"],
};

function matchesTargetCity(cityText: string | undefined, targetCityName: string): boolean {
  if (!cityText) return false;
  const lower = cityText.toLowerCase();
  const aliases = CITY_ALIAS[targetCityName] ?? [targetCityName.toLowerCase()];
  return aliases.some((a) => lower.includes(a));
}

function normalizeKazakhRussianQuery(q: string): string {
  // Handle common Russian genitive endings on Kazakh street names (e.g. "Кабанбай Батыра 55" -> "Қабанбай батыр 55")
  return q
    .replace(/батыра\b/gi, "батыр")
    .replace(/\bкабанбай/gi, "Қабанбай")
    .replace(/\bмангилик/gi, "Мәңгілік")
    .replace(/\bбогенбай/gi, "Бөгенбай")
    .replace(/\bтурын\b|\bтуран\b/gi, "Тұран")
    .replace(/\bсарыарка\b/gi, "Сарыарқа");
}

async function fetchPhotonPlaces(q: string, preset: CityPreset): Promise<PlacePreset[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("lat", String(preset.centerLat));
  url.searchParams.set("lon", String(preset.centerLng));
  url.searchParams.set(
    "bbox",
    `${(preset.centerLng - 0.22).toFixed(4)},${(preset.centerLat - 0.15).toFixed(4)},${(
      preset.centerLng + 0.22
    ).toFixed(4)},${(preset.centerLat + 0.15).toFixed(4)}`
  );
  url.searchParams.set("limit", "8");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(2200),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const features = data.features ?? [];

  const mapped: PlacePreset[] = [];
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const coords = f.geometry?.coordinates;
    const p = f.properties;
    if (!coords || coords.length < 2 || !p) continue;
    const [lng, lat] = coords;
    const cityLabel = [p.city, p.state, p.district].filter(Boolean).join(", ");
    if (p.city && !matchesTargetCity(cityLabel, preset.name) && distanceSq(lat, lng, preset.centerLat, preset.centerLng) > 0.03) {
      continue;
    }

    const streetLine = [p.street, p.housenumber].filter(Boolean).join(" ").trim();
    const primaryName = p.name || streetLine || q;
    const addressParts = [
      streetLine && streetLine !== primaryName ? streetLine : null,
      p.district,
      p.city || preset.name,
    ]
      .filter(Boolean)
      .join(", ");

    mapped.push({
      id: `photon-${p.osm_id ?? i}-${lat.toFixed(4)}`,
      name: primaryName,
      address: addressParts || `${primaryName}, ${preset.name}`,
      city: preset.name,
      lat,
      lng,
      category: "landmark",
    });
  }
  return mapped;
}

async function fetchNominatimPlaces(q: string, preset: CityPreset): Promise<PlacePreset[]> {
  const queryText = q.toLowerCase().includes(preset.name.toLowerCase())
    ? q
    : `${q}, ${preset.name}`;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", queryText);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("bounded", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set(
    "viewbox",
    `${(preset.centerLng - 0.22).toFixed(4)},${(preset.centerLat + 0.15).toFixed(4)},${(
      preset.centerLng + 0.22
    ).toFixed(4)},${(preset.centerLat - 0.15).toFixed(4)}`
  );

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "JournoPlanner/1.0 (https://journo-tau.vercel.app)",
    },
    signal: AbortSignal.timeout(2500),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const items = (await res.json()) as NominatimItem[];
  const mapped: PlacePreset[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (item.address?.village && !matchesTargetCity(item.display_name, preset.name)) continue;

    const roadLine = [item.address?.road, item.address?.house_number].filter(Boolean).join(" ").trim();
    const shortDisplay = item.display_name?.split(",").slice(0, 3).join(", ").trim();
    const title = item.name || roadLine || shortDisplay || q;
    const address =
      roadLine && roadLine !== title
        ? `${roadLine}, ${item.address?.city || item.address?.town || preset.name}`
        : shortDisplay || `${title}, ${preset.name}`;

    mapped.push({
      id: `nom-${item.place_id ?? i}`,
      name: title,
      address,
      city: preset.name,
      lat,
      lng,
      category: "landmark",
    });
  }
  return mapped;
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    const city = (req.nextUrl.searchParams.get("city") || "Astana").trim();
    const preset = getCityPreset(city);

    const localResults = searchPlacesLocal(q, city);

    if (q.length < 2) {
      return NextResponse.json({ places: localResults });
    }

    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    const remoteResults: PlacePreset[] = [];

    if (googleKey) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
            `${q} ${city}`
          )}&key=${googleKey}`,
          { signal: AbortSignal.timeout(2400) }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results)) {
            for (const r of data.results.slice(0, 5)) {
              remoteResults.push({
                id: `google-${r.place_id}`,
                name: r.name,
                address: r.formatted_address,
                city: preset.name,
                lat: r.geometry?.location?.lat ?? 51.1282,
                lng: r.geometry?.location?.lng ?? 71.4304,
                category: "landmark",
              });
            }
          }
        }
      } catch {
        // Fall through to OpenStreetMap geocoders
      }
    }

    if (remoteResults.length === 0) {
      const altQ = normalizeKazakhRussianQuery(q);
      const queriesToTry = altQ !== q ? [q, altQ] : [q];
      const settled = await Promise.allSettled([
        ...queriesToTry.map((term) => fetchPhotonPlaces(term, preset)),
        fetchNominatimPlaces(q, preset),
        ...(altQ !== q ? [fetchNominatimPlaces(altQ, preset)] : []),
      ]);
      for (const s of settled) {
        if (s.status === "fulfilled") {
          remoteResults.push(...s.value);
        }
      }
    }

    // Score remote results: prefer street name match (with Kazakh-Russian translit fold) + house number
    const foldKazakh = (s: string) =>
      s
        .toLowerCase()
        .replace(/қ/g, "к")
        .replace(/ң/g, "н")
        .replace(/ғ/g, "г")
        .replace(/[ұү]/g, "у")
        .replace(/ө/g, "о")
        .replace(/һ/g, "х")
        .replace(/і/g, "и")
        .replace(/ә/g, "а");

    const qFolded = foldKazakh(q);
    const numToken = qFolded.match(/\b\d+[а-яa-z]?\b/i)?.[0] ?? null;
    const streetTokens = qFolded
      .split(/[\s,.-]+/)
      .filter((t) => t.length >= 2 && t !== numToken && t !== "ул" && t !== "пр" && t !== "улица" && t !== "проспект");

    remoteResults.sort((a, b) => {
      const score = (p: PlacePreset) => {
        const hay = foldKazakh(`${p.name} ${p.address}`);
        let s = 0;
        let streetHits = 0;
        for (const tok of streetTokens) {
          const stem = tok.replace(/(?:а|ы|і|у)$/i, "");
          if (hay.includes(tok) || (stem.length >= 4 && hay.includes(stem))) {
            s += 50;
            streetHits += 1;
          }
        }
        if (streetTokens.length > 0 && streetHits === streetTokens.length) s += 40;
        if (numToken && hay.includes(numToken)) s += streetHits > 0 ? 35 : 5;
        if (matchesTargetCity(p.address, preset.name)) s += 20;
        s -= Math.min(20, distanceSq(p.lat, p.lng, preset.centerLat, preset.centerLng) * 300);
        return s;
      };
      return score(b) - score(a);
    });

    const merged: PlacePreset[] = [];
    const seen = new Set<string>();
    const combined =
      /\d/.test(q) || remoteResults.length > 0
        ? [...remoteResults, ...localResults]
        : [...localResults, ...remoteResults];

    for (const p of combined) {
      const dedupeKey = `${p.name.toLowerCase()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      merged.push(p);
      if (merged.length >= 8) break;
    }

    return NextResponse.json({ places: merged });
  } catch (error) {
    console.error("Places search error:", error);
    return NextResponse.json({ places: [] });
  }
}
