/*
 * When a plan happens. A scheduled quest's time is stored as a local "YYYY-MM-DDTHH:MM" string
 * (saves from before days existed hold only "HH:MM"), and everywhere one is shown it is said the
 * same way: "today 7:30 PM", "tomorrow 6 PM", "Sat, Oct 3 · 7 PM".
 */

const MINUTE = 60_000;
const FULL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LEGACY = /^(\d{1,2}):(\d{2})$/;
/** Easy times on a day that isn't today. Anything else is one "Other time" away. */
const DAY_SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-09-26": a local calendar day. */
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "HH:MM" on the 24-hour clock. */
function clockKey(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A stored plan value for a day and a time: "2026-09-26T19:30". */
export function joinWhen(day: string, time: string) {
  return `${day}T${time}`;
}

/**
 * The moment a stored plan means. An old "HH:MM" save means today, or tomorrow once that time has
 * passed. Null for anything unreadable.
 */
export function parseWhen(value: string, now = new Date()): Date | null {
  const full = FULL.exec(value);
  if (full) {
    const [year, month, day, hour, minute] = full.slice(1).map(Number) as [number, number, number, number, number];
    return new Date(year, month - 1, day, hour, minute);
  }
  const legacy = LEGACY.exec(value);
  if (legacy) {
    const date = new Date(now);
    date.setHours(Number(legacy[1]), Number(legacy[2]), 0, 0);
    if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 1);
    return date;
  }
  return null;
}

/** A stored plan in the current "YYYY-MM-DDTHH:MM" form (an old "HH:MM" gets its day). */
export function normalizeWhen(value: string, now = new Date()) {
  const date = parseWhen(value, now);
  return date ? joinWhen(dayKey(date), clockKey(date)) : null;
}

/** The day and the time of a stored plan, apart. */
export function splitWhen(value: string, now = new Date()) {
  const full = normalizeWhen(value, now);
  if (!full) return null;
  const [day, time] = full.split("T") as [string, string];
  return { day, time };
}

/** True while the plan is still ahead of us. */
export function isAhead(value: string, now = new Date()) {
  const date = parseWhen(value, now);
  return Boolean(date && date.getTime() > now.getTime());
}

/** "7:30 PM", or "7 PM" on the hour. */
function clockLabel(date: Date) {
  return date.toLocaleTimeString("en-US", date.getMinutes() ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" });
}

/** Whole calendar days from today to the date: 0 today, 1 tomorrow, -1 yesterday. */
function daysAway(date: Date, now: Date) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * MINUTE));
}

/**
 * The one way a plan's time is said: "today 7:30 PM", "tomorrow 6 PM", "Sat, Oct 3 · 7 PM" (with
 * the year when it isn't this one). `start` capitalises it for the start of a line or a label.
 */
export function whenLabel(value: string, { start = false, now = new Date() }: { start?: boolean; now?: Date } = {}) {
  const date = parseWhen(value, now);
  if (!date) return value;
  const away = daysAway(date, now);
  const clock = clockLabel(date);
  const text =
    away === 0
      ? `today ${clock}`
      : away === 1
        ? `tomorrow ${clock}`
        : away === -1
          ? `yesterday ${clock}`
          : `${date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
            })} · ${clock}`;
  return start ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export type DayOption = {
  /** "2026-09-28" */
  key: string;
  /** "Today", "Tomorrow", then "Mon 28". */
  label: string;
  /** The rest of the date, for screen readers: ", Sunday, September 27" after Today, " September" after Mon 28. */
  spoken: string;
};

/** Today, tomorrow, and the five days after, as the day chips name them. */
export function upcomingDays(now = new Date(), count = 7): DayOption[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = dayKey(date);
    if (i < 2) {
      const full = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      return { key, label: i === 0 ? "Today" : "Tomorrow", spoken: `, ${full}` };
    }
    const label = `${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.getDate()}`;
    return { key, label, spoken: ` ${date.toLocaleDateString("en-US", { month: "long" })}` };
  });
}

/** Before this hour the day hasn't started, so today offers the daytime spread, not 1 AM. */
const DAY_STARTS = 7;

/**
 * Six easy times on a day, as "HH:MM". Today: the next half hours, starting at least 15 minutes
 * from now and stopping at midnight (so late in the evening there may be none), or, in the small
 * hours, the daytime spread. Any other day: a spread from late morning to evening.
 */
export function timeSlots(day: string, now = new Date()) {
  if (day !== dayKey(now) || now.getHours() < DAY_STARTS) return DAY_SLOTS;
  const start = new Date(now);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60);
  if (start.getTime() - now.getTime() < 15 * MINUTE) start.setMinutes(start.getMinutes() + 30);
  return Array.from({ length: 6 }, (_, i) => new Date(start.getTime() + i * 30 * MINUTE))
    .filter((slot) => dayKey(slot) === day)
    .map(clockKey);
}

/** "7:30 PM" for a bare "HH:MM" slot. */
export function slotLabel(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return clockLabel(new Date(2000, 0, 1, hour ?? 0, minute ?? 0));
}

/* ---------------------------------------------------------------------------------------------
 * Calendar events: a Google Calendar link, and a .ics file for Apple Calendar (Outlook reads it too).
 * ------------------------------------------------------------------------------------------- */

export type CalendarEvent = {
  /** Stable per quest, so adding the same plan twice updates it instead of doubling it. */
  id: string;
  title: string;
  location: string;
  start: Date;
  minutes: number;
  details: string;
  url: string;
};

/**
 * "20261004T000000Z": the moment in UTC. The picker's times are on the device's own clock, so UTC
 * lands the event at exactly the moment the app showed, whatever zone the phone or the calendar is
 * in (and with no wall-clock guesswork on the night the clocks go back).
 */
function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function endOf(event: CalendarEvent) {
  return new Date(event.start.getTime() + Math.max(15, event.minutes) * MINUTE);
}

/** Google Calendar's "new event" page with everything filled in. */
export function googleCalendarUrl(event: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.start)}/${utcStamp(endOf(event))}`,
    location: event.location,
    details: event.details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Text values in an .ics line escape backslashes, commas, semicolons and line breaks. */
function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** .ics lines fold at 75 bytes, continuing on a line that starts with a space. */
function fold(line: string) {
  const encoder = new TextEncoder();
  let out = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) {
      out += "\r\n ";
      bytes = 1;
    }
    out += char;
    bytes += size;
  }
  return out;
}

export function icsFile(event: CalendarEvent, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//wego//Side quests//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@wego`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(event.start)}`,
    `DTEND:${utcStamp(endOf(event))}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(event.location)}`,
    `DESCRIPTION:${icsText(event.details)}`,
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/**
 * Saves the event as a .ics file (a Blob and an a[download]). On iPhone that opens the event with
 * "Add to Calendar"; on a laptop it lands in Downloads for Calendar or Outlook to open.
 */
export function downloadCalendarFile(event: CalendarEvent) {
  const blob = new Blob([icsFile(event)], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const name = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "quest";
  link.href = href;
  link.download = `${name}.ics`;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // iOS reads the file after the tap returns, so the URL has to outlive this handler.
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
