import { randomUUID } from "node:crypto";
import type { Settings } from "./settings";

// Built-in automatic booking (owner decision 11 Oct 2026). Calendly's free plan has no booking
// API, so the system books the next free designer slot itself, the moment a lead is Qualified.
// The caller does not choose (brief 2.15). If a paid Calendly token is configured, Calendly is
// used instead (calendly.ts).

export const MEETING_MINUTES = Number(process.env.MEETING_MINUTES ?? 60); // TODO(owner): meeting length
export const MIN_NOTICE_HOURS = Number(process.env.MIN_NOTICE_HOURS ?? 18); // TODO(owner): earliest booking after the call

export type Designer = { name: string; email: string };

/** DESIGNERS="Asha Rao:asha@x.com,Vikram:vikram@x.com". Until set, the fallback inbox stands in. */
export function designers(): Designer[] {
  const list = (process.env.DESIGNERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.lastIndexOf(":");
      return { name: s.slice(0, i).trim(), email: s.slice(i + 1).trim() };
    })
    .filter((d) => d.name && d.email.includes("@"));
  if (list.length) return list;
  const fb = (process.env.QUALIFIED_FALLBACK_EMAILS ?? "").split(",")[0]?.trim();
  return fb ? [{ name: "Aangan designer", email: fb }] : [];
}

const IST = 330 * 60_000;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Candidate start times (UTC) inside working hours, from `from` onwards, on the hour. */
export function candidateSlots(from: Date, s: Settings, days = 21): Date[] {
  const out: Date[] = [];
  const startMin = toMin(s.working_start);
  const endMin = toMin(s.working_end);
  const ist0 = new Date(from.getTime() + IST);
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.UTC(ist0.getUTCFullYear(), ist0.getUTCMonth(), ist0.getUTCDate() + d));
    const dow = day.getUTCDay() || 7;
    if (!s.working_days.includes(dow)) continue;
    for (let m = startMin; m + MEETING_MINUTES <= endMin; m += 60) {
      const utc = new Date(day.getTime() + m * 60_000 - IST);
      if (utc >= from) out.push(utc);
    }
  }
  return out;
}

/** Earliest slot and the least-loaded free designer. `busy` holds "designerName|isoStart" keys
 * (by name, because several designers may share one inbox while testing). */
export function findSlot(now: Date, s: Settings, ds: Designer[], busy: Set<string>, load: Record<string, number>): { start: Date; designer: Designer } | null {
  const from = new Date(now.getTime() + MIN_NOTICE_HOURS * 3_600_000);
  const order = [...ds].sort((a, b) => (load[a.name] ?? 0) - (load[b.name] ?? 0));
  for (const start of candidateSlots(from, s)) {
    const d = order.find((x) => !busy.has(`${x.name}|${start.toISOString()}`));
    if (d) return { start, designer: d };
  }
  return null;
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (t: string) => t.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

/** A calendar invite (.ics) both Google Calendar and Outlook accept. */
export function icsInvite(o: { uid?: string; start: Date; minutes: number; title: string; description: string; organizer: string; attendees: string[]; method?: "REQUEST" | "CANCEL" }): string {
  const end = new Date(o.start.getTime() + o.minutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "PRODID:-//Aangan Studio//Enquiry agent//EN",
    "VERSION:2.0",
    `METHOD:${o.method ?? "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${o.uid ?? randomUUID()}@aangan`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(o.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(o.title)}`,
    `DESCRIPTION:${icsText(o.description)}`,
    `ORGANIZER;CN=Aangan Studio:mailto:${o.organizer}`,
    ...o.attendees.map((a) => `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${a}`),
    `STATUS:${o.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
