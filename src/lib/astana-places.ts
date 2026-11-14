export interface PlacePreset {
  id: string;
  name: string;
  address: string;
  category: "landmark" | "office" | "cafe" | "pharmacy" | "fitness" | "transit" | "hotel" | "mall";
  city: "Astana" | "Almaty" | "London" | "Tokyo";
  lat: number;
  lng: number;
  keywords?: string[];
}

export interface CityPreset {
  name: "Astana" | "Almaty" | "London" | "Tokyo";
  country: string;
  timezone: string;
  utcOffsetLabel: string;
  centerLat: number;
  centerLng: number;
  distanceFromAstanaKm: number;
  suggestedTempBase: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
}

export const CITY_PRESETS: CityPreset[] = [
  {
    name: "Astana",
    country: "Kazakhstan",
    timezone: "Asia/Almaty",
    utcOffsetLabel: "UTC+5",
    centerLat: 51.1282,
    centerLng: 71.4304,
    distanceFromAstanaKm: 0,
    suggestedTempBase: {
      name: "Highvill Astana",
      address: "Baitursynov St 5, Astana",
      lat: 51.1245,
      lng: 71.4662,
    },
  },
  {
    name: "Almaty",
    country: "Kazakhstan",
    timezone: "Asia/Almaty",
    utcOffsetLabel: "UTC+5",
    centerLat: 43.2389,
    centerLng: 76.8897,
    distanceFromAstanaKm: 970,
    suggestedTempBase: {
      name: "Ritz-Carlton Almaty",
      address: "Al-Farabi Ave 77/7, Almaty",
      lat: 43.2188,
      lng: 76.9284,
    },
  },
  {
    name: "London",
    country: "United Kingdom",
    timezone: "Europe/London",
    utcOffsetLabel: "UTC+0",
    centerLat: 51.5074,
    centerLng: -0.1278,
    distanceFromAstanaKm: 4800,
    suggestedTempBase: {
      name: "The Hoxton Holborn",
      address: "199-206 High Holborn, London",
      lat: 51.5173,
      lng: -0.1225,
    },
  },
  {
    name: "Tokyo",
    country: "Japan",
    timezone: "Asia/Tokyo",
    utcOffsetLabel: "UTC+9",
    centerLat: 35.6762,
    centerLng: 139.6503,
    distanceFromAstanaKm: 5900,
    suggestedTempBase: {
      name: "Shibuya Stream Hotel",
      address: "3-21-3 Shibuya, Tokyo",
      lat: 35.6571,
      lng: 139.7028,
    },
  },
];

export const PLACE_PRESETS: PlacePreset[] = [
  // Astana (Primary Demo City, UTC+5)
  {
    id: "ast-highvill",
    name: "Highvill Astana",
    address: "Baitursynov St 5, Astana",
    category: "hotel",
    city: "Astana",
    lat: 51.1245,
    lng: 71.4662,
    keywords: ["дом", "хайвил", "байтурсынова", "home", "apartment", "baitursynov"],
  },
  {
    id: "ast-hub",
    name: "Astana Hub",
    address: "Mangilik El Ave 55/8, EXPO C4.6, Astana",
    category: "office",
    city: "Astana",
    lat: 51.0894,
    lng: 71.4158,
    keywords: ["офис", "хаб", "астана хаб", "мангилик", "экспо", "expo", "work", "работа"],
  },
  {
    id: "ast-talan",
    name: "Talan Towers",
    address: "Dostyk St 16, Astana",
    category: "office",
    city: "Astana",
    lat: 51.1288,
    lng: 71.4342,
    keywords: ["талан", "достык", "офис", "бизнес", "dostyk", "lunch", "обед"],
  },
  {
    id: "ast-abudhabi",
    name: "Abu Dhabi Plaza",
    address: "Syganak St 60/5, Astana",
    category: "office",
    city: "Astana",
    lat: 51.1211,
    lng: 71.4258,
    keywords: ["абу даби", "сыганак", "тц", "офис", "mall", "syganak"],
  },
  {
    id: "ast-khanshatyr",
    name: "Khan Shatyr",
    address: "Turan Ave 37, Astana",
    category: "mall",
    city: "Astana",
    lat: 51.1325,
    lng: 71.4038,
    keywords: ["хан шатыр", "туран", "тц", "кино", "шопинг", "супермаркет", "turan", "cinema"],
  },
  {
    id: "ast-koktem",
    name: "Koktem Coffee",
    address: "Kunayev St 12/1, Astana",
    category: "cafe",
    city: "Astana",
    lat: 51.1301,
    lng: 71.4285,
    keywords: ["кофе", "кофейня", "коктем", "кунаева", "кафе", "coffee", "cafe", "kunayev"],
  },
  {
    id: "ast-mega",
    name: "World Class / MEGA Silk Way",
    address: "Kabanbay Batyr Ave 62, Astana",
    category: "fitness",
    city: "Astana",
    lat: 51.0892,
    lng: 71.4084,
    keywords: ["мега", "силк вей", "спорт", "зал", "фитнес", "тренировка", "кабанбай", "gym", "mega", "cinema", "кино"],
  },
  {
    id: "ast-chaplin-mega",
    name: "Chaplin Cinemas (MEGA Silk Way)",
    address: "Kabanbay Batyr Ave 62, Astana",
    category: "mall",
    city: "Astana",
    lat: 51.0890,
    lng: 71.4090,
    keywords: ["кино", "кинотеатр", "чаплин", "мега", "фильм", "cinema", "movie", "chaplin"],
  },
  {
    id: "ast-kinopark-saryarka",
    name: "Kinopark 8 IMAX (Saryarka)",
    address: "Turan Ave 24, Astana",
    category: "mall",
    city: "Astana",
    lat: 51.1376,
    lng: 71.4046,
    keywords: ["кино", "кинотеатр", "кинопарк", "сарыарка", "imax", "cinema", "movie"],
  },
  {
    id: "ast-baiterek",
    name: "Baiterek Tower",
    address: "Nurzhol Blvd 14, Astana",
    category: "landmark",
    city: "Astana",
    lat: 51.1283,
    lng: 71.4305,
    keywords: ["байтерек", "нуржол", "центр", "бульвар", "nurzhol"],
  },
  {
    id: "ast-nu",
    name: "Nazarbayev University",
    address: "Kabanbay Batyr Ave 53, Astana",
    category: "office",
    city: "Astana",
    lat: 51.0906,
    lng: 71.3982,
    keywords: ["универ", "университет", "назарбаев", "ну", "учеба", "university", "кабанбай"],
  },
  {
    id: "ast-opera",
    name: "Astana Opera",
    address: "Kunayev St 1, Astana",
    category: "landmark",
    city: "Astana",
    lat: 51.1355,
    lng: 71.4106,
    keywords: ["опера", "театр", "концерт", "opera", "theater"],
  },
  {
    id: "ast-astana-ballet",
    name: "Astana Ballet Theater",
    address: "Uly Dala Ave 9, Astana",
    category: "landmark",
    city: "Astana",
    lat: 51.0846,
    lng: 71.4161,
    keywords: ["балет", "театр", "улы дала", "концерт", "ballet", "theater"],
  },
  {
    id: "ast-museum",
    name: "National Museum of Kazakhstan",
    address: "Tauelsizdik Ave 54, Astana",
    category: "landmark",
    city: "Astana",
    lat: 51.1186,
    lng: 71.4694,
    keywords: ["музей", "тауелсиздик", "museum"],
  },
  {
    id: "ast-keruen",
    name: "Keruen Mall",
    address: "Dostyk St 9, Astana",
    category: "mall",
    city: "Astana",
    lat: 51.1286,
    lng: 71.4257,
    keywords: ["керуен", "достык", "тц", "кино", "шопинг", "keruen"],
  },
  {
    id: "ast-galmart-keruen",
    name: "Galmart Supermarket (Keruen)",
    address: "Dostyk St 9, Astana",
    category: "mall",
    city: "Astana",
    lat: 51.1289,
    lng: 71.4262,
    keywords: ["супермаркет", "продукты", "магазин", "галмарт", "supermarket", "grocery", "galmart"],
  },
  {
    id: "ast-botanical",
    name: "Astana Botanical Garden",
    address: "Orynbor St 18, Astana",
    category: "landmark",
    city: "Astana",
    lat: 51.1069,
    lng: 71.4178,
    keywords: ["парк", "сад", "ботанический", "прогулка", "орынбор", "garden", "park"],
  },
  {
    id: "ast-central-park",
    name: "Central Park Astana",
    address: "Turan Ave 2, Astana",
    category: "landmark",
    city: "Astana",
    lat: 51.1502,
    lng: 71.4126,
    keywords: ["парк", "столичный парк", "прогулка", "park", "набережная"],
  },
  {
    id: "ast-sheraton",
    name: "Sheraton Astana Hotel",
    address: "Syganak St 60/1, Astana",
    category: "hotel",
    city: "Astana",
    lat: 51.1219,
    lng: 71.4282,
    keywords: ["отель", "гостиница", "шератон", "сыганак", "hotel", "coffee"],
  },
  {
    id: "ast-ritz",
    name: "The Ritz-Carlton Astana",
    address: "Dostyk St 16, Astana",
    category: "hotel",
    city: "Astana",
    lat: 51.1285,
    lng: 71.4337,
    keywords: ["ритц", "отель", "достык", "hotel"],
  },
  {
    id: "ast-aifc",
    name: "AIFC Fintech Hub",
    address: "Mangilik El Ave 55/18, Astana",
    category: "office",
    city: "Astana",
    lat: 51.0909,
    lng: 71.4184,
    keywords: ["мфца", "финтех", "мангилик", "офис", "банк", "fintech"],
  },
  {
    id: "ast-europharma",
    name: "Europharma Pharmacy (Syganak)",
    address: "Syganak St 29, Astana",
    category: "pharmacy",
    city: "Astana",
    lat: 51.1195,
    lng: 71.4162,
    keywords: ["аптека", "лекарства", "еврофарма", "сыганак", "pharmacy", "medicine"],
  },
  {
    id: "ast-biosphere",
    name: "Biosphere Pharmacy (Turan)",
    address: "Turan Ave 24, Astana",
    category: "pharmacy",
    city: "Astana",
    lat: 51.1372,
    lng: 71.4048,
    keywords: ["аптека", "биосфера", "туран", "pharmacy"],
  },
  {
    id: "ast-hippocrates",
    name: "Hippocrates Pharmacy (Mangilik El)",
    address: "Mangilik El Ave 40, Astana",
    category: "pharmacy",
    city: "Astana",
    lat: 51.1045,
    lng: 71.4252,
    keywords: ["аптека", "гиппократ", "мангилик", "pharmacy"],
  },
  {
    id: "ast-tsvetnaya",
    name: "Tsvetnaya Pharmacy (Right Bank)",
    address: "Republic Ave 15, Astana",
    category: "pharmacy",
    city: "Astana",
    lat: 51.1604,
    lng: 71.4259,
    keywords: ["аптека", "цветная", "правый берег", "республика", "pharmacy"],
  },
  {
    id: "ast-kaspi",
    name: "Kaspi Bank Branch (Dostyk)",
    address: "Dostyk St 18, Astana",
    category: "office",
    city: "Astana",
    lat: 51.1268,
    lng: 71.4388,
    keywords: ["банк", "каспи", "достык", "bank", "kaspi"],
  },
  // Almaty
  {
    id: "alm-esentai",
    name: "Esentai Tower",
    address: "Al-Farabi Ave 77/7, Almaty",
    category: "office",
    city: "Almaty",
    lat: 43.2188,
    lng: 76.9284,
    keywords: ["есентай", "аль-фараби", "офис", "алматы"],
  },
  {
    id: "alm-arbat",
    name: "Panfilov Promenade & Coffee Boom",
    address: "Panfilov St 108, Almaty",
    category: "cafe",
    city: "Almaty",
    lat: 43.2586,
    lng: 76.9445,
    keywords: ["арбат", "панфилова", "кофе", "coffee", "кафе"],
  },
  {
    id: "alm-pharmacy",
    name: "Europharma Almaty (Abay Ave)",
    address: "Abay Ave 42, Almaty",
    category: "pharmacy",
    city: "Almaty",
    lat: 43.2412,
    lng: 76.9315,
    keywords: ["аптека", "еврофарма", "абая", "pharmacy"],
  },
  // London
  {
    id: "lon-kx",
    name: "King's Cross St Pancras",
    address: "Euston Rd, London N1C 4QP",
    category: "transit",
    city: "London",
    lat: 51.5319,
    lng: -0.1263,
    keywords: ["station", "train", "transit", "вокзал"],
  },
  {
    id: "lon-canary",
    name: "Canary Wharf Level39",
    address: "One Canada Square, London E14 5AB",
    category: "office",
    city: "London",
    lat: 51.5049,
    lng: -0.0195,
    keywords: ["office", "fintech", "canary", "bank"],
  },
  {
    id: "lon-boots",
    name: "Boots Pharmacy (Oxford St)",
    address: "361 Oxford St, London W1C 2JL",
    category: "pharmacy",
    city: "London",
    lat: 51.5142,
    lng: -0.1494,
    keywords: ["pharmacy", "boots", "аптека"],
  },
  // Tokyo
  {
    id: "tok-shibuya",
    name: "Shibuya Scramble Square",
    address: "2-24-12 Shibuya, Tokyo",
    category: "office",
    city: "Tokyo",
    lat: 35.6584,
    lng: 139.7022,
    keywords: ["shibuya", "office", "mall"],
  },
  {
    id: "tok-marunouchi",
    name: "Tokyo Station Marunouchi",
    address: "1-9-1 Marunouchi, Chiyoda, Tokyo",
    category: "transit",
    city: "Tokyo",
    lat: 35.6812,
    lng: 139.7671,
    keywords: ["station", "transit", "train"],
  },
];

const STREET_STOP_WORDS = new Set([
  "ул",
  "улица",
  "пр",
  "проспект",
  "мкр",
  "st",
  "ave",
  "street",
  "avenue",
  "blvd",
  "rd",
  "road",
]);

export function searchPlacesLocal(query: string, city?: string): PlacePreset[] {
  const q = query.trim().toLowerCase();
  const filteredByCity = city
    ? PLACE_PRESETS.filter((p) => p.city.toLowerCase() === city.toLowerCase())
    : PLACE_PRESETS;

  if (!q) return filteredByCity.slice(0, 8);

  const tokens = q
    .replace(/[.,;]+/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !STREET_STOP_WORDS.has(tok));
  if (tokens.length === 0) return filteredByCity.slice(0, 8);

  const scored = filteredByCity
    .map((p) => {
      const haystack = [p.name, p.address, p.category, ...(p.keywords ?? [])]
        .join(" ")
        .toLowerCase();
      if (haystack.includes(q)) {
        return { place: p, score: 3 };
      }
      const matchedTokens = tokens.filter((tok) => haystack.includes(tok)).length;
      if (matchedTokens === tokens.length) {
        return { place: p, score: 2 };
      }
      if (matchedTokens > 0) {
        return { place: p, score: 1 };
      }
      return null;
    })
    .filter((item): item is { place: PlacePreset; score: number } => item !== null)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map((item) => item.place);
}

/**
 * Resolves any word-based address or place query to coordinates within the target city.
 * Returns the closest matching curated preset when found, or computes a stable deterministic
 * coordinate inside the city bounds for arbitrary street names/queries typed by the user.
 */
export function resolvePlaceByWords(query: string, city?: string): PlacePreset {
  const cleanTitle = query.trim() || "Custom Stop";
  const cityPreset =
    CITY_PRESETS.find((c) => c.name.toLowerCase() === (city ?? "Astana").toLowerCase()) ??
    CITY_PRESETS[0];

  const looksLikeStreetAddress =
    /(?:^|\s)(?:ул\.?|улица|пр\.?|проспект|мкр\.?)\s+/i.test(cleanTitle);
  const matches = searchPlacesLocal(cleanTitle, city);
  if (matches.length > 0 && !looksLikeStreetAddress) {
    return matches[0];
  }

  const normalized = cleanTitle.toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const latNorm = ((hash & 0xffff) / 0xffff) * 2 - 1;
  const lngNorm = (((hash >>> 16) & 0xffff) / 0xffff) * 2 - 1;

  const matched = looksLikeStreetAddress && matches.length > 0 ? matches[0] : null;
  const resolvedLat = matched
    ? matched.lat
    : Number((cityPreset.centerLat + latNorm * 0.022).toFixed(5));
  const resolvedLng = matched
    ? matched.lng
    : Number((cityPreset.centerLng + lngNorm * 0.028).toFixed(5));

  return {
    id: `custom-${Math.abs(hash)}`,
    name: cleanTitle,
    address: cleanTitle.toLowerCase().includes(cityPreset.name.toLowerCase())
      ? cleanTitle
      : `${cleanTitle}, ${cityPreset.name}`,
    category: "landmark",
    city: cityPreset.name,
    lat: resolvedLat,
    lng: resolvedLng,
  };
}

export function parseShareLocationUrl(raw: string): { lat: number; lng: number; label: string } | null {
  const trimmed = raw.trim();
  // Match Google Maps @lat,lng or q=lat,lng or ll=lat,lng
  const matchAt = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (matchAt) {
    return {
      lat: Number(matchAt[1]),
      lng: Number(matchAt[2]),
      label: "Shared Map Pin",
    };
  }
  const matchQuery = trimmed.match(/[?&](?:q|ll|center)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (matchQuery) {
    return {
      lat: Number(matchQuery[1]),
      lng: Number(matchQuery[2]),
      label: "Shared Map Pin",
    };
  }
  const matchDirect = trimmed.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (matchDirect) {
    return {
      lat: Number(matchDirect[1]),
      lng: Number(matchDirect[2]),
      label: "Custom Coordinates",
    };
  }
  return null;
}
