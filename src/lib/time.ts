import type { Settings } from "./settings";

// All timestamps stored in UTC, shown in IST. "Day" means an IST day.
const IST_OFFSET_MIN = 330;

export const fmtIST = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "Not stated";

function istParts(d: Date) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return { y: ist.getUTCFullYear(), m: ist.getUTCMonth(), day: ist.getUTCDate(), dow: ist.getUTCDay() || 7, mins: ist.getUTCHours() * 60 + ist.getUTCMinutes() };
}
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const istToUtc = (y: number, m: number, day: number, mins: number) => new Date(Date.UTC(y, m, day, 0, mins) - IST_OFFSET_MIN * 60_000);

export function isWorkingTime(d: Date, s: Settings): boolean {
  const p = istParts(d);
  return s.working_days.includes(p.dow) && p.mins >= toMin(s.working_start) && p.mins < toMin(s.working_end);
}

/** Brief 12.3: call task due now in working hours, else 10:00 IST next working day. */
export function taskDueAt(callAt: Date, s: Settings): Date {
  if (isWorkingTime(callAt, s)) return callAt;
  const p = istParts(callAt);
  for (let add = 0; add < 8; add++) {
    const cand = istToUtc(p.y, p.m, p.day + add, toMin(s.working_start));
    if (cand <= callAt) continue;
    if (s.working_days.includes(istParts(cand).dow)) return cand;
  }
  return callAt;
}
