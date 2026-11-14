export interface ParsedQuickAdd {
  title: string;
  durationMin: number;
  isFlexible: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  partySize: number;
  categoryHint: "cinema" | "cafe" | "pharmacy" | "mall" | "fitness" | "event" | "general";
  parsedSuccessfully: boolean;
}

export function parseQuickAddText(input: string): ParsedQuickAdd {
  const raw = input.trim();
  if (!raw) {
    return {
      title: "",
      durationMin: 15,
      isFlexible: true,
      windowStart: null,
      windowEnd: null,
      priority: "MEDIUM",
      partySize: 1,
      categoryHint: "general",
      parsedSuccessfully: false,
    };
  }

  let working = raw;
  let durationMin = 15;
  let isFlexible = true;
  let windowStart: string | null = null;
  let windowEnd: string | null = null;
  let priority: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
  let partySize = 1;

  // Detect category hint early before words are stripped
  const lower = raw.toLowerCase();
  let categoryHint: ParsedQuickAdd["categoryHint"] = "general";
  if (/(?:кино|фильм|cinema|movie|imax|chaplin)/i.test(lower)) {
    categoryHint = "cinema";
    durationMin = 120;
  } else if (/(?:кафе|кофе|coffee|cafe|lunch|обед|ужин|dinner|breakfast)/i.test(lower)) {
    categoryHint = "cafe";
    durationMin = 30;
  } else if (/(?:аптек|pharm|drugstore)/i.test(lower)) {
    categoryHint = "pharmacy";
    durationMin = 10;
  } else if (/(?:концерт|театр|event|ticket|билет|шоу)/i.test(lower)) {
    categoryHint = "event";
    durationMin = 90;
  } else if (/(?:магазин|шопинг|тц|mall|shop|grocery)/i.test(lower)) {
    categoryHint = "mall";
    durationMin = 40;
  } else if (/(?:спорт|зал|gym|fitness|тренир)/i.test(lower)) {
    categoryHint = "fitness";
    durationMin = 60;
  }

  // Extract party size in Russian and English ("на двоих", "for two", "for 3", "3 чел", "2 pax")
  const namedPartyMatch = working.match(
    /(?:^|\s)(?:на\s+двоих|вдво[её]м|for\s+two|two\s+people|couple)(?=\s|$|[.,;])/i
  );
  const threePartyMatch = working.match(
    /(?:^|\s)(?:на\s+троих|втро[её]м|for\s+three)(?=\s|$|[.,;])/i
  );
  const fourPartyMatch = working.match(
    /(?:^|\s)(?:на\s+четверых|вчетвером|for\s+four)(?=\s|$|[.,;])/i
  );
  const numericPartyMatch = working.match(
    /(?:^|\s)(?:for|на)\s+(\d{1,2})(?:\s*(?:people|persons?|pers|pax|чел(?:овек)?|персон[аы]?))?(?=\s|$|[.,;])/i
  );
  const suffixPartyMatch = working.match(
    /(\d{1,2})\s*(?:people|persons?|pers|pax|чел|персон)/i
  );

  if (namedPartyMatch) {
    partySize = 2;
    working = working.replace(namedPartyMatch[0], " ");
  } else if (threePartyMatch) {
    partySize = 3;
    working = working.replace(threePartyMatch[0], " ");
  } else if (fourPartyMatch) {
    partySize = 4;
    working = working.replace(fourPartyMatch[0], " ");
  } else if (numericPartyMatch) {
    partySize = Math.max(1, Math.min(20, Number(numericPartyMatch[1])));
    working = working.replace(numericPartyMatch[0], " ");
  } else if (suffixPartyMatch) {
    partySize = Math.max(1, Math.min(20, Number(suffixPartyMatch[1])));
    working = working.replace(suffixPartyMatch[0], " ");
  }

  // Extract time window like 14:00-15:00 or 14:00–16:00
  const windowMatch = working.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (windowMatch) {
    windowStart = windowMatch[1].padStart(5, "0");
    windowEnd = windowMatch[2].padStart(5, "0");
    isFlexible = false;
    working = working.replace(windowMatch[0], " ");
  } else {
    // Single time like "at 19:30" or "в 19:30" or bare "19:30"
    const singleTimeMatch = working.match(/(?:^|\s)(?:(?:at|в)\s+)?(\d{1,2}:\d{2})(?=\s|$|[.,;])/i);
    if (singleTimeMatch) {
      const [hh, mm] = singleTimeMatch[1].split(":").map(Number);
      const startTotal = hh * 60 + mm;
      const windowSpan = Math.max(60, durationMin);
      const endTotal = Math.min(23 * 60 + 59, startTotal + windowSpan);
      windowStart = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      windowEnd = `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(
        endTotal % 60
      ).padStart(2, "0")}`;
      isFlexible = false;
      working = working.replace(singleTimeMatch[0], " ");
    }
  }

  // Extract duration like "10 min", "25m", "1h", "10 мин", "2 ч"
  const minMatch = working.match(/\b(\d{1,3})\s*(?:min(?:utes?)?|m|мин(?:ут[ы]?)?)\b/i);
  if (minMatch) {
    durationMin = Math.max(5, Math.min(480, Number(minMatch[1])));
    working = working.replace(minMatch[0], " ");
  } else {
    const hrMatch = working.match(/(?:^|\s)(\d)\s*(?:h|hr|hours?|ч(?:ас[ао]в?)?)(?=\s|$|[.,;])/i);
    if (hrMatch) {
      durationMin = Number(hrMatch[1]) * 60;
      working = working.replace(hrMatch[0], " ");
    }
  }

  // Flexibility keywords
  if (/(?:^|\s)(?:rigid|fixed|hard|anchor|ж[её]стко|строго)(?=\s|$|[.,;])/i.test(working)) {
    isFlexible = false;
    working = working.replace(
      /(?:^|\s)(?:rigid|fixed|hard|anchor|ж[её]стко|строго)(?=\s|$|[.,;])/gi,
      " "
    );
  }
  if (/(?:^|\s)(?:flexible|flex|anytime|гибко|свободно)(?=\s|$|[.,;])/i.test(working)) {
    isFlexible = true;
    working = working.replace(
      /(?:^|\s)(?:flexible|flex|anytime|гибко|свободно)(?=\s|$|[.,;])/gi,
      " "
    );
  }

  // Priority keywords
  if (/(?:^|\s)(?:urgent|high|asap|important|срочно|важно)(?=\s|$|[.,;])/i.test(working)) {
    priority = "HIGH";
    working = working.replace(
      /(?:^|\s)(?:urgent|high|asap|important|срочно|важно)(?=\s|$|[.,;])/gi,
      " "
    );
  } else if (/(?:^|\s)(?:low|неспешно)(?=\s|$|[.,;])/i.test(working)) {
    priority = "LOW";
    working = working.replace(/(?:^|\s)(?:low|неспешно)(?=\s|$|[.,;])/gi, " ");
  }

  const cleanedTitle = working
    .replace(/[,;|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parsedSuccessfully = cleanedTitle.length >= 2;

  return {
    title: cleanedTitle || raw,
    durationMin,
    isFlexible,
    windowStart,
    windowEnd,
    priority,
    partySize,
    categoryHint,
    parsedSuccessfully,
  };
}
