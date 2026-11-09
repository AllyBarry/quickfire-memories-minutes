/** Dates worked back from the party, so a printed tape box arrives in time. */
export interface Milestone {
  key: string;
  label: string;
  date: Date;
}

const DAY = 864e5;
const at = (d: string) => new Date(`${d}T12:00:00`);
const minus = (d: Date, days: number) => new Date(d.getTime() - days * DAY);
/** End of that calendar day, local time. */
const endOfDay = (d: Date) => {
  const out = new Date(d);
  out.setHours(23, 59, 0, 0);
  return out;
};

/** The Tuesday print run on or before a date. */
function printRunBefore(d: Date) {
  const out = new Date(d);
  while (out.getDay() !== 2) out.setDate(out.getDate() - 1);
  return out;
}

const printRun = (partyDate: string) => printRunBefore(minus(at(partyDate), 9));

/** The suggested close: leaves a few days to set the running order before printing (or before the party, for Digital). */
export function defaultClose(partyDate: string, printed: boolean) {
  return endOfDay(printed ? minus(printRun(partyDate), 4) : minus(at(partyDate), 4));
}

/** The latest the organiser may close and still approve in time: a full day before print, or before the party. */
export function latestClose(partyDate: string, printed: boolean) {
  return endOfDay(printed ? minus(printRun(partyDate), 2) : minus(at(partyDate), 1));
}

/** When responses close: the organiser's choice if set, otherwise the suggested date. */
export function closeDate(partyDate: string, printed: boolean, closeAt?: string) {
  return closeAt ? new Date(closeAt) : defaultClose(partyDate, printed);
}

export function timeline(partyDate: string, printed: boolean, closeAt?: string): Milestone[] {
  const party = at(partyDate);
  const close = closeDate(partyDate, printed, closeAt);
  const dayAfterClose = new Date(close.getTime() + DAY);
  if (!printed) {
    const approve = new Date(Math.min(Math.max(minus(party, 2).getTime(), dayAfterClose.getTime()), party.getTime()));
    return [
      { key: "close", label: "Song picks close", date: close },
      { key: "approve", label: "You approve the running order", date: approve },
      { key: "party", label: "Party: the tape page goes live", date: party },
    ];
  }
  const print = printRun(partyDate);
  return [
    { key: "close", label: "Song picks close", date: close },
    { key: "approve", label: "You approve the running order", date: minus(print, 1) },
    { key: "print", label: "Weekly print run", date: print },
    { key: "deliver", label: "Box delivered (3 to 5 working days)", date: minus(party, 2) },
    { key: "party", label: "Party", date: party },
  ];
}

export const isClosed = (partyDate: string, printed: boolean, closeAt?: string) => closeDate(partyDate, printed, closeAt).getTime() <= Date.now();

/** Earliest party date we can still print for: three weeks out. */
export const minPrintedDate = () => new Date(Date.now() + 21 * DAY).toISOString().slice(0, 10);
export const minDigitalDate = () => new Date(Date.now() + 5 * DAY).toISOString().slice(0, 10);

export const fmtDate = (d: Date) => d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
export const fmtTime = (d: Date) => d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (d: Date) => `${fmtDate(d)}, ${fmtTime(d)}`;
export const daysUntil = (d: Date) => Math.ceil((d.getTime() - Date.now()) / DAY);

/** A Date as the value a datetime-local input expects (local time, no seconds). */
export const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** The next Tuesday print run from today. */
export function nextRun() {
  const d = new Date();
  do d.setDate(d.getDate() + 1);
  while (d.getDay() !== 2);
  return d;
}
