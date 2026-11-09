/**
 * Deadlines worked back from the party date. Same rules as the web app (web/src/lib/timeline.ts),
 * but computed in South African time (UTC+02:00, no daylight saving) because Functions run in UTC.
 */
const DAY = 864e5;
export const SAST = "+02:00";

const atNoon = (date: string) => new Date(`${date}T12:00:00${SAST}`);
const ymd = (d: Date) => new Date(d.getTime() + 2 * 36e5).toISOString().slice(0, 10); // calendar date in SAST
const endOfDay = (d: Date) => new Date(`${ymd(d)}T23:59:00${SAST}`);
const minusDays = (d: Date, n: number) => new Date(d.getTime() - n * DAY);

/** The Tuesday print run on or before a date. */
function printRunBefore(d: Date) {
  let out = d;
  while (new Date(out.getTime() + 2 * 36e5).getUTCDay() !== 2) out = minusDays(out, 1);
  return out;
}

export const isPrinted = (planId: string) => planId !== "digital";
export const printRun = (partyDate: string) => printRunBefore(minusDays(atNoon(partyDate), 9));

export function defaultClose(partyDate: string, printed: boolean) {
  return endOfDay(printed ? minusDays(printRun(partyDate), 4) : minusDays(atNoon(partyDate), 4));
}

/** Latest close that still leaves a day to approve before print (or before the party, for Digital). */
export function latestClose(partyDate: string, printed: boolean) {
  return endOfDay(printed ? minusDays(printRun(partyDate), 2) : minusDays(atNoon(partyDate), 1));
}

export function closeDate(partyDate: string, printed: boolean, closeAt: string | null | undefined) {
  return closeAt ? new Date(closeAt) : defaultClose(partyDate, printed);
}

export function isOpen(tape: { party_date: string; plan_id: string; close_at: string | null; status: string }, now = Date.now()) {
  return tape.status === "collecting" && closeDate(tape.party_date, isPrinted(tape.plan_id), tape.close_at).getTime() > now;
}

/** Earliest party date we accept: 3 weeks out for printed tapes, 5 days for Digital. */
export function minPartyDate(printed: boolean, now = Date.now()) {
  return ymd(new Date(now + (printed ? 21 : 5) * DAY));
}

/** Validate an organiser's requested close time. Returns an error message, or null when it's fine. */
export function checkCloseAt(value: string, partyDate: string, printed: boolean, now = Date.now()): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Pick a valid date and time.";
  if (d.getTime() <= now) return "Pick a time in the future, or close song picks now.";
  if (d.getTime() > latestClose(partyDate, printed).getTime()) return "That's too late to approve the running order in time.";
  return null;
}
