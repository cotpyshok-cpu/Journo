import {
  PlacePreset,
  resolvePlaceByWords,
  searchPlacesLocal,
} from "@/lib/astana-places";

export async function searchLivePlaces(
  query: string,
  city: string,
  signal?: AbortSignal
): Promise<PlacePreset[]> {
  const trimmed = query.trim();
  const local = searchPlacesLocal(trimmed, city);
  if (trimmed.length < 2) return local;

  try {
    const res = await fetch(
      `/api/places/search?q=${encodeURIComponent(trimmed)}&city=${encodeURIComponent(city)}`,
      { signal }
    );
    if (!res.ok) return local;
    const data = (await res.json()) as { places?: PlacePreset[] };
    if (Array.isArray(data.places) && data.places.length > 0) {
      return data.places;
    }
    return local;
  } catch {
    return local;
  }
}

export async function resolveAddressWithLiveFallback(
  query: string,
  city: string
): Promise<{
  address: string;
  name: string;
  lat: number;
  lng: number;
  fromLiveGeocoder: boolean;
}> {
  const trimmed = query.trim();
  const live = await searchLivePlaces(trimmed, city);
  if (live.length > 0) {
    const top = live[0];
    return {
      address: top.address || `${top.name}, ${city}`,
      name: top.name,
      lat: top.lat,
      lng: top.lng,
      fromLiveGeocoder: !top.id.startsWith("astana-") && !top.id.startsWith("almaty-") && !top.id.startsWith("london-") && !top.id.startsWith("tokyo-"),
    };
  }
  const fallback = resolvePlaceByWords(trimmed, city);
  return {
    address: fallback.address,
    name: fallback.name,
    lat: fallback.lat,
    lng: fallback.lng,
    fromLiveGeocoder: false,
  };
}
