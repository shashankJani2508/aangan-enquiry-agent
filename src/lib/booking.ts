import { q, logEvent } from "./db";
import { designers, findSlot, icsInvite, MEETING_MINUTES } from "./scheduler";
import { sendEmail } from "./email";
import { signToken } from "./tokens";
import { fmtIST } from "./time";
import type { Settings } from "./settings";

export type BookingRow = { id: string; lead_id: string; designer_name: string; designer_email: string; start_time: string; status: string };

const base = () => process.env.APP_BASE_URL ?? "http://localhost:3000";
export const manageUrl = (bookingId: string) => `${base()}/booking/${signToken(`b:${bookingId}`, 120 * 86_400)}`;

/** Book the next free designer slot for a lead. Safe under concurrency (unique slot index). */
export async function autoBook(leadId: string, s: Settings): Promise<BookingRow> {
  const existing = await q<BookingRow>("select * from bookings where lead_id=$1 and status='booked' order by created_at desc limit 1", [leadId]);
  if (existing[0]) return existing[0]; // never two active bookings for one lead
  const ds = designers();
  if (!ds.length) throw new Error("no designers configured (DESIGNERS or QUALIFIED_FALLBACK_EMAILS)");
  const taken = await q<{ designer_name: string; start_time: string }>("select designer_name, start_time from bookings where status='booked' and start_time > now()");
  const busy = new Set(taken.map((t) => `${t.designer_name}|${new Date(t.start_time).toISOString()}`));
  const loadRows = await q<{ designer_name: string; n: number }>("select designer_name, count(*)::int n from bookings where status='booked' and start_time > now() - interval '30 days' group by 1");
  const load = Object.fromEntries(loadRows.map((r) => [r.designer_name, r.n]));
  for (let attempt = 0; attempt < 10; attempt++) {
    const slot = findSlot(new Date(), s, ds, busy, load);
    if (!slot) throw new Error("no free designer slot in the next 3 weeks");
    const ins = await q<BookingRow>(
      `insert into bookings (lead_id, status, designer_name, designer_email, start_time) values ($1,'booked',$2,$3,$4)
       on conflict do nothing returning *`,
      [leadId, slot.designer.name, slot.designer.email, slot.start.toISOString()],
    );
    if (ins[0]) {
      await logEvent(leadId, "system", "booking.created", { designer: slot.designer.name, start: slot.start.toISOString() });
      return ins[0];
    }
    busy.add(`${slot.designer.name}|${slot.start.toISOString()}`); // taken a moment ago: try the next one
  }
  throw new Error("could not secure a slot after 10 attempts");
}

export function inviteFor(b: BookingRow, lead: { caller_name: string | null; caller_email: string | null }, method: "REQUEST" | "CANCEL" = "REQUEST") {
  const ics = icsInvite({
    uid: b.id,
    start: new Date(b.start_time),
    minutes: MEETING_MINUTES,
    title: `Aangan Studio consultation: ${lead.caller_name ?? "client"} with ${b.designer_name}`,
    description: `Free design consultation with Aangan Studio.\nChange or cancel: ${manageUrl(b.id)}`,
    // Organizer must differ from the attendees or Gmail shows "Unable to load event".
    organizer: (process.env.RESEND_FROM ?? "").match(/<([^>]+)>/)?.[1] ?? "bookings@aangan.studio",
    attendees: [b.designer_email, ...(lead.caller_email ? [lead.caller_email] : [])],
    method,
  });
  return [{ filename: method === "CANCEL" ? "cancelled.ics" : "invite.ics", content: Buffer.from(ics).toString("base64"), contentType: `text/calendar; charset=utf-8; method=${method}` }];
}

/** One-tap "Add to Google Calendar" link, a reliable backup to the .ics attachment. */
export function gcalLink(b: BookingRow, title: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(b.start_time);
  const end = new Date(start.getTime() + MEETING_MINUTES * 60_000);
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", title);
  u.searchParams.set("dates", `${f(start)}/${f(end)}`);
  u.searchParams.set("details", `Aangan Studio consultation. Change or cancel: ${manageUrl(b.id)}`);
  return u.toString();
}

export function callerBookedEmail(lead: { caller_name: string | null }, b: BookingRow) {
  const hi = lead.caller_name ? `Hi ${lead.caller_name.split(" ")[0]},` : "Hello,";
  const when = `${fmtIST(b.start_time)} IST`;
  const first = b.designer_name.split(" ")[0];
  const link = manageUrl(b.id);
  return {
    subject: `Your consultation with Aangan Studio: ${when}`,
    text: [hi, `Your free consultation with ${first} from Aangan Studio is booked for ${when}.`, "The calendar invite is attached.", `Need a different time or to cancel? ${link}`].join("\n\n"),
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px"><p>${hi}</p><p>Your free consultation with <b>${first}</b> from Aangan Studio is booked for <b>${when}</b>.</p><p>The calendar invite is attached.</p><p><a href="${link}">Change or cancel</a></p></div>`,
  };
}

/** Cancel (and optionally move to the next free slot). Used by the caller's manage link. */
export async function cancelBooking(bookingId: string, s: Settings, rebook: boolean): Promise<BookingRow | null> {
  const [b] = await q<BookingRow>("update bookings set status='cancelled' where id=$1 and status='booked' returning *", [bookingId]);
  if (!b) return null;
  const [lead] = await q<{ caller_name: string | null; caller_email: string | null }>("select caller_name, caller_email from leads where id=$1", [b.lead_id]);
  await logEvent(b.lead_id, "caller", rebook ? "booking.moved" : "booking.cancelled", { from: b.start_time });
  await sendEmail({ to: [b.designer_email], subject: `Cancelled: consultation with ${lead?.caller_name ?? "client"} ${fmtIST(b.start_time)} IST`, text: rebook ? "The caller moved this consultation; a new invite follows." : "The caller cancelled this consultation.", html: `<p>${rebook ? "The caller moved this consultation; a new invite follows." : "The caller cancelled this consultation."}</p>`, idempotencyKey: `${b.id}:cancel`, attachments: inviteFor(b, lead ?? { caller_name: null, caller_email: null }, "CANCEL") });
  if (!rebook) {
    await q("update leads set booking_status='cancelled' where id=$1", [b.lead_id]);
    return null;
  }
  const nb = await autoBook(b.lead_id, s);
  await q("update leads set booking_status='booked' where id=$1", [b.lead_id]);
  const to = [nb.designer_email, ...(lead?.caller_email ? [lead.caller_email] : [])];
  const m = callerBookedEmail(lead ?? { caller_name: null }, nb);
  await sendEmail({ to, ...m, idempotencyKey: `${nb.id}:moved`, attachments: inviteFor(nb, lead ?? { caller_name: null, caller_email: null }) });
  return nb;
}
