import {
  addDays,
  addHours,
  setHours,
  setMinutes,
  nextDay,
  startOfDay,
  parse as dateParse,
  isValid,
} from "date-fns";
import type { ParsedEvent, EventCategory } from "@/types";

// ─── Category keywords ──────────────────────
const CATEGORY_KEYWORDS: Record<string, EventCategory> = {
  test: "test",
  exam: "test",
  quiz: "test",
  midterm: "test",
  final: "test",
  class: "class",
  lesson: "class",
  course: "class",
  practice: "class",
  training: "class",
  soccer: "class",
  basketball: "class",
  swimming: "class",
  piano: "class",
  gym: "personal",
  doctor: "personal",
  dentist: "personal",
  meeting: "personal",
  appointment: "personal",
};

// ─── Day name → Date helper ─────────────────
const DAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

// ─── Month names ────────────────────────────
const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse a free-text message into a structured event.
 *
 * Examples:
 *   "Math test for Noam on Mar 10 8:00"
 *   "Soccer practice every Tue 16:00"
 *   "Gym tomorrow 19:00"
 *   "Dentist appointment Jan 15"
 */
export function parseMessage(
  text: string,
  knownPersons: string[] = []
): ParsedEvent | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  const now = new Date();

  // ── Detect person ─────────────────────────
  let person: string | undefined;
  for (const p of knownPersons) {
    if (lower.includes(p.toLowerCase())) {
      person = p;
      break;
    }
  }

  // Remove "for <person>" from text for cleaner title
  let cleaned = text;
  if (person) {
    cleaned = cleaned.replace(
      new RegExp(`\\bfor\\s+${person}\\b`, "i"),
      ""
    );
  }

  // ── Detect category ───────────────────────
  let category: EventCategory = "other";
  for (const [keyword, cat] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) {
      category = cat;
      break;
    }
  }

  // ── Detect recurrence ─────────────────────
  let rrule: string | undefined;
  const everyMatch = lower.match(
    /every\s+(sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|day)/
  );
  if (everyMatch) {
    const dayStr = everyMatch[1];
    if (dayStr === "day") {
      rrule = "RRULE:FREQ=DAILY";
    } else {
      const dayAbbr = dayStr.slice(0, 2).toUpperCase();
      const rDay =
        dayAbbr === "SU"
          ? "SU"
          : dayAbbr === "MO"
          ? "MO"
          : dayAbbr === "TU"
          ? "TU"
          : dayAbbr === "WE"
          ? "WE"
          : dayAbbr === "TH"
          ? "TH"
          : dayAbbr === "FR"
          ? "FR"
          : "SA";
      rrule = `RRULE:FREQ=WEEKLY;BYDAY=${rDay}`;
    }
    cleaned = cleaned.replace(/every\s+\S+/i, "");
  }

  // ── Detect time (HH:MM or H:MM) ──────────
  let hour = 9,
    minute = 0;
  let hasTime = false;
  const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
    hasTime = true;
    cleaned = cleaned.replace(/\d{1,2}:\d{2}/, "");
  }

  // ── Detect date ───────────────────────────
  let startDate: Date = now;
  let allDay = !hasTime;

  // "tomorrow"
  if (lower.includes("tomorrow")) {
    startDate = addDays(now, 1);
    cleaned = cleaned.replace(/tomorrow/i, "");
  }
  // "today"
  else if (lower.includes("today")) {
    startDate = now;
    cleaned = cleaned.replace(/today/i, "");
  }
  // Day name without "every" (e.g. "on Tuesday")
  else if (!everyMatch) {
    for (const [dayName, dayNum] of Object.entries(DAY_MAP)) {
      const dayPattern = new RegExp(`\\bon\\s+${dayName}\\b|\\b${dayName}\\b`);
      if (dayPattern.test(lower)) {
        startDate = nextDay(now, dayNum);
        cleaned = cleaned.replace(new RegExp(`\\bon\\s+${dayName}\\b|\\b${dayName}\\b`, "i"), "");
        break;
      }
    }
  }
  // If "every <day>", use the next occurrence of that day
  else if (everyMatch) {
    const dayStr = everyMatch[1];
    const dayKey = dayStr.slice(0, 3).toLowerCase();
    if (DAY_MAP[dayKey] !== undefined) {
      startDate = nextDay(now, DAY_MAP[dayKey]);
    }
  }

  // "Mar 10", "Jan 15", "February 20" etc.
  const monthDateMatch = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s+(\d{4}))?\b/
  );
  if (monthDateMatch) {
    const monthKey = monthDateMatch[1].slice(0, 3).toLowerCase();
    const day = parseInt(monthDateMatch[2], 10);
    const year = monthDateMatch[3]
      ? parseInt(monthDateMatch[3], 10)
      : now.getFullYear();
    const month = MONTH_MAP[monthKey];
    if (month !== undefined) {
      startDate = new Date(year, month, day);
      // If the date is in the past this year, bump to next year
      if (startDate < now && !monthDateMatch[3]) {
        startDate = new Date(year + 1, month, day);
      }
    }
    cleaned = cleaned.replace(monthDateMatch[0], "");
  }

  // Numeric date formats: DD/MM, DD/MM/YYYY
  const numDateMatch = lower.match(/\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/);
  if (numDateMatch && !monthDateMatch) {
    const day = parseInt(numDateMatch[1], 10);
    const month = parseInt(numDateMatch[2], 10) - 1;
    const year = numDateMatch[3]
      ? parseInt(numDateMatch[3], 10) < 100
        ? 2000 + parseInt(numDateMatch[3], 10)
        : parseInt(numDateMatch[3], 10)
      : now.getFullYear();
    startDate = new Date(year, month, day);
    if (startDate < now && !numDateMatch[3]) {
      startDate = new Date(year + 1, month, day);
    }
    cleaned = cleaned.replace(numDateMatch[0], "");
  }

  // Apply time to the start date
  startDate = startOfDay(startDate);
  if (hasTime) {
    startDate = setMinutes(setHours(startDate, hour), minute);
    allDay = false;
  }

  // ── Compute end time ──────────────────────
  let endDate: Date;
  if (allDay) {
    endDate = addDays(startDate, 1);
  } else {
    endDate = addHours(startDate, 1); // default 1-hour event
  }

  // ── Clean title ───────────────────────────
  let title = cleaned
    .replace(/\bon\b/gi, "")
    .replace(/\bat\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Capitalize first letter
  if (title) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  } else {
    title = "New Event";
  }

  return {
    title,
    person,
    category,
    start: startDate,
    end: endDate,
    all_day: allDay,
    rrule,
  };
}
