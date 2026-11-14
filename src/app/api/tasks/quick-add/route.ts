import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PLACE_PRESETS } from "@/lib/astana-places";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors";
import { parseQuickAddText } from "@/lib/quick-add-parser";
import { getActiveUser } from "@/lib/session";
import { haversineKm, sanitizeText } from "@/lib/utils";

const quickAddSchema = z.object({
  text: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(["parse", "commit"]).default("parse"),
  selectedPlaceId: z.string().optional(),
  selectedPlace: z
    .object({
      name: z.string(),
      address: z.string(),
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getActiveUser();
    const body = await req.json();
    const input = quickAddSchema.parse(body);

    const parsed = parseQuickAddText(input.text);
    const cityPlaces = PLACE_PRESETS.filter(
      (p) => p.city.toLowerCase() === user.currentCity.toLowerCase()
    );

    const existingTasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        date: input.date,
        lat: { not: null },
        status: { in: ["PLANNED", "IN_PROGRESS"] },
      },
      orderBy: { plannedOrder: "asc" },
    });

    // Compute route centroid / reference stop to estimate detour minutes for up to 3 candidates (E2.2)
    const refLat =
      existingTasks.length > 0 && existingTasks[0].lat != null
        ? existingTasks[0].lat
        : user.homeLat;
    const refLng =
      existingTasks.length > 0 && existingTasks[0].lng != null
        ? existingTasks[0].lng
        : user.homeLng;

    const queryLower = parsed.title.toLowerCase();
    const scored = cityPlaces
      .map((place) => {
        const nameLower = place.name.toLowerCase();
        const catLower = place.category.toLowerCase();
        const hintMatch =
          (parsed.categoryHint === "cinema" &&
            (place.id.includes("khan-shatyr") ||
              place.id.includes("mega-silk-way") ||
              place.category === "mall")) ||
          (parsed.categoryHint === "cafe" && place.category === "cafe") ||
          (parsed.categoryHint === "pharmacy" && place.category === "pharmacy") ||
          (parsed.categoryHint === "fitness" && place.category === "fitness") ||
          (parsed.categoryHint === "mall" && place.category === "mall") ||
          (parsed.categoryHint === "event" && place.category === "landmark");
        const textMatch =
          hintMatch ||
          nameLower.includes(queryLower) ||
          catLower.includes(queryLower) ||
          (queryLower.includes("pharm") && place.category === "pharmacy") ||
          (queryLower.includes("аптек") && place.category === "pharmacy") ||
          (queryLower.includes("coffee") && place.category === "cafe") ||
          (queryLower.includes("bank") && nameLower.includes("bank")) ||
          (queryLower.includes("gym") && place.category === "fitness");
        const distKm = haversineKm(refLat, refLng, place.lat, place.lng);
        const detourMin = Math.max(3, Math.round(distKm * 3.1));
        return {
          ...place,
          score: textMatch ? 0 : 100,
          detourMin,
          distanceKm: distKm,
        };
      })
      .sort((a, b) => a.score - b.score || a.detourMin - b.detourMin)
      .slice(0, 3);

    if (input.action === "parse") {
      return NextResponse.json({
        parsed,
        suggestions: scored,
      });
    }

    // Check Free 5-task limit before committing (E3.1)
    if (user.tier === "FREE") {
      const count = await prisma.task.count({
        where: {
          userId: user.id,
          date: input.date,
          lat: { not: null },
          exceedsFreeLimit: false,
        },
      });
      if (count >= 5) {
        return NextResponse.json(
          {
            error: {
              code: "FREE_LIMIT_REACHED",
              message: "Free limit of 5 tasks reached for this date. Upgrade to Pro to add more.",
            },
            preservedInput: input.text,
          },
          { status: 402 }
        );
      }
    }

    const chosen =
      input.selectedPlace ??
      cityPlaces.find((p) => p.id === input.selectedPlaceId) ??
      scored[0];

    const task = await prisma.task.create({
      data: {
        userId: user.id,
        title: sanitizeText(parsed.title || chosen?.name || "Quick Stop", 160),
        locationName: chosen ? sanitizeText(chosen.name, 160) : null,
        address: chosen ? sanitizeText(chosen.address, 220) : null,
        lat: chosen?.lat ?? null,
        lng: chosen?.lng ?? null,
        date: input.date,
        windowStart: parsed.windowStart,
        windowEnd: parsed.windowEnd,
        durationMin: parsed.durationMin,
        priority: parsed.priority,
        isFlexible: parsed.isFlexible,
        status: "PLANNED",
        source: "TASK",
        city: user.currentCity,
        timezone: user.currentTimezone,
      },
    });

    return NextResponse.json({
      task,
      autoRecalculate: user.tier === "PRO" || user.tier === "DEV",
      parsed,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
