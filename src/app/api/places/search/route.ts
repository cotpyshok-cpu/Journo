import { NextRequest, NextResponse } from "next/server";
import { parseShareLocationUrl, searchPlacesLocal } from "@/lib/astana-places";
import { handleApiError } from "@/lib/errors";
import { getActiveUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    await getActiveUser();
    const rawQ = req.nextUrl.searchParams.get("q") || "";
    const q = rawQ.trim().slice(0, 120);
    const city = (req.nextUrl.searchParams.get("city") || "Astana").trim().slice(0, 40);

    const parsedShare = parseShareLocationUrl(q);
    if (parsedShare) {
      return NextResponse.json({
        places: [
          {
            id: "shared-pin",
            name: parsedShare.label,
            address: `${parsedShare.lat.toFixed(4)}, ${parsedShare.lng.toFixed(4)} (${city})`,
            category: "landmark",
            city,
            lat: parsedShare.lat,
            lng: parsedShare.lng,
          },
        ],
      });
    }

    const localResults = searchPlacesLocal(q, city);

    // Optional Google Places API enhancement if key is configured and query is specific
    const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (googleKey && q.trim().length >= 3 && localResults.length < 3) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
            `${q} ${city}`
          )}&key=${encodeURIComponent(googleKey)}`,
          { signal: AbortSignal.timeout(1800) }
        );
        if (res.ok) {
          const data = await res.json();
          const apiPlaces = (data.results || []).slice(0, 4).map((r: {
            place_id: string;
            name: string;
            formatted_address?: string;
            geometry?: { location?: { lat: number; lng: number } };
          }) => ({
            id: `gplace-${r.place_id}`,
            name: r.name,
            address: r.formatted_address || city,
            category: "landmark" as const,
            city,
            lat: r.geometry?.location?.lat ?? 51.1282,
            lng: r.geometry?.location?.lng ?? 71.4304,
          }));
          return NextResponse.json({ places: [...localResults, ...apiPlaces].slice(0, 8) });
        }
      } catch {
        // Fallback silently to local presets
      }
    }

    return NextResponse.json({ places: localResults });
  } catch (error) {
    return handleApiError(error);
  }
}
