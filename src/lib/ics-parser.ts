import { sanitizeText } from "./utils";

export interface ParsedIcsEvent {
  externalId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  locationName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  recurrenceRule: string | null;
}

function parseIcsDateTime(raw: string): {
  date: string;
  time: string;
  isAllDay: boolean;
} {
  const value = raw.trim();
  // Format: YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    return {
      date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      time: "09:00",
      isAllDay: true,
    };
  }
  // Format: YYYYMMDDTHHMMSS(Z)
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (match) {
    return {
      date: `${match[1]}-${match[2]}-${match[3]}`,
      time: `${match[4]}:${match[5]}`,
      isAllDay: false,
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  return { date: today, time: "10:00", isAllDay: false };
}

export function parseIcsContent(icsText: string, defaultDate?: string): ParsedIcsEvent[] {
  // Unfold RFC 5545 folded lines
  const unfolded = icsText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  const events: ParsedIcsEvent[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0] || "";
    const lines = block.split(/\r?\n/);
    const props: Record<string, string> = {};

    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const keyPart = line.slice(0, colonIdx).split(";")[0].toUpperCase().trim();
      const val = line.slice(colonIdx + 1).trim();
      props[keyPart] = val;
    }

    const title = sanitizeText(props["SUMMARY"] || "Apple Calendar Event", 120);
    const dtStart = props["DTSTART"]
      ? parseIcsDateTime(props["DTSTART"])
      : { date: defaultDate || new Date().toISOString().slice(0, 10), time: "11:00", isAllDay: false };
    const dtEnd = props["DTEND"]
      ? parseIcsDateTime(props["DTEND"])
      : { date: dtStart.date, time: "12:00", isAllDay: dtStart.isAllDay };

    const rawLoc = props["LOCATION"] ? sanitizeText(props["LOCATION"].replace(/\\,/g, ","), 180) : null;
    let lat: number | null = null;
    let lng: number | null = null;

    if (props["GEO"]) {
      const [latStr, lngStr] = props["GEO"].split(";");
      const parsedLat = Number(latStr);
      const parsedLng = Number(lngStr);
      if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }

    events.push({
      externalId: sanitizeText(props["UID"] || `ics-${i}-${Date.now()}`, 80),
      title,
      date: dtStart.date,
      startTime: dtStart.time,
      endTime: dtEnd.time,
      isAllDay: dtStart.isAllDay,
      locationName: rawLoc ? rawLoc.split(",")[0].trim() : null,
      address: rawLoc,
      lat,
      lng,
      recurrenceRule: props["RRULE"] ? sanitizeText(props["RRULE"], 120) : null,
    });
  }

  return events;
}
