/**
 * Deadlines worked back from the party date, so a printed box arrives in time.
 *
 * Everything is in South African time (UTC+02:00, no daylight saving), wherever the code runs:
 * Functions run in UTC and a friend may open the share link abroad, but the print run and the
 * organiser's deadline are South African. The web app and the API both use this file.
 */
const DAY = 864e5;
const HOUR = 36e5;
export const SAST = "+02:00";
export const TIME_ZONE = "Africa/Johannesburg";

/** A Date shifted so its UTC fields read as the South African wall clock. */
const wall = (d: Date) => new Date(d.getTime() + 2 * HOUR);
/** The calendar date in South Africa, YYYY-MM-DD. */
export const sastDate = (d: Date) => wall(d).toISOString().slice(0, 10);
/** Noon on a party date (or any YYYY-MM-DD), South African time. */
export const atNoon = (date: string) => new Date(`${date}T12:00:00${SAST}`);
const endOfDay = (d: Date) => new Date(`${sastDate(d)}T23:59:00${SAST}`);
const minusDays = (d: Date, n: number) => new Date(d.getTime() - n * DAY);

/** The Tuesday print run on or before a date. */
function printRunBefore(d: Date) {
  let out = d;
  while (wall(out).getUTCDay() !== 2) out = minusDays(out, 1);
  return out;
}

/** The weekly print run a printed tape goes in: the Tuesday at least 9 days before the party. */
export const printRun = (partyDate: string) => printRunBefore(minusDays(atNoon(partyDate), 9));

/** The next Tuesday print run after today. */
export function nextRun(now = Date.now()) {
  let d = new Date(now + DAY);
  while (wall(d).getUTCDay() !== 2) d = new Date(d.getTime() + DAY);
  return d;
}

/** The suggested close: leaves a few days to set the running order before printing (or before the party, for Digital). */
export function defaultClose(partyDate: string, printed: boolean) {
  return endOfDay(printed ? minusDays(printRun(partyDate), 4) : minusDays(atNoon(partyDate), 4));
}

/** Latest close that still leaves a day to approve before print (or before the party, for Digital). */
export function latestClose(partyDate: string, printed: boolean) {
  return endOfDay(printed ? minusDays(printRun(partyDate), 2) : minusDays(atNoon(partyDate), 1));
}

/**
 * Reads a close time. ISO strings with an offset are taken as they are. A bare "YYYY-MM-DDTHH:mm"
 * (what a datetime-local input gives) is South African time, whatever the browser's time zone.
 */
export function parseCloseAt(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value) ? new Date(`${value.length === 16 ? `${value}:00` : value}${SAST}`) : new Date(value);
}

/** A Date as the value a datetime-local input expects, in South African time. */
export const toSastInput = (d: Date) => wall(d).toISOString().slice(0, 16);

/** When song picks close: the organiser's choice if set, otherwise the suggested time. */
export function closeDate(partyDate: string, printed: boolean, closeAt?: string | null) {
  return closeAt ? parseCloseAt(closeAt) : defaultClose(partyDate, printed);
}

export function isClosed(partyDate: string, printed: boolean, closeAt?: string | null, now = Date.now()) {
  return closeDate(partyDate, printed, closeAt).getTime() <= now;
}

/** Earliest party date we accept: 3 weeks out for printed tapes, 5 days for Digital. */
export function minPartyDate(printed: boolean, now = Date.now()) {
  return sastDate(new Date(now + (printed ? 21 : 5) * DAY));
}

/** Checks an organiser's requested close time. Returns an error message, or null when it's fine. */
export function checkCloseAt(value: string, partyDate: string, printed: boolean, now = Date.now()): string | null {
  const d = parseCloseAt(value);
  if (Number.isNaN(d.getTime())) return "Pick a valid date and time.";
  if (d.getTime() <= now) return "Pick a time in the future, or close song picks now.";
  if (d.getTime() > latestClose(partyDate, printed).getTime()) return "That's too late to approve the running order in time.";
  return null;
}

export interface Milestone {
  key: string;
  label: string;
  date: Date;
}

/** The dates the organiser sees on their dashboard and at checkout. */
export function timeline(partyDate: string, printed: boolean, closeAt?: string | null): Milestone[] {
  const party = atNoon(partyDate);
  const close = closeDate(partyDate, printed, closeAt);
  if (!printed) {
    const dayAfterClose = close.getTime() + DAY;
    const approve = new Date(Math.min(Math.max(minusDays(party, 2).getTime(), dayAfterClose), party.getTime()));
    return [
      { key: "close", label: "Song picks close", date: close },
      { key: "approve", label: "You approve the running order", date: approve },
      { key: "party", label: "Party: the tape page goes live", date: party },
    ];
  }
  const print = printRun(partyDate);
  return [
    { key: "close", label: "Song picks close", date: close },
    { key: "approve", label: "You approve the running order", date: minusDays(print, 1) },
    { key: "print", label: "Weekly print run", date: print },
    { key: "deliver", label: "Box delivered (3 to 5 working days)", date: minusDays(party, 2) },
    { key: "party", label: "Party", date: party },
  ];
}

export const daysUntil = (d: Date, now = Date.now()) => Math.ceil((d.getTime() - now) / DAY);

export const fmtDate = (d: Date) => d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE });
export const fmtTime = (d: Date) => d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
export const fmtDateTime = (d: Date) => `${fmtDate(d)}, ${fmtTime(d)}`;
