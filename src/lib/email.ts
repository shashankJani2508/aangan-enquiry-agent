import { Resend } from "resend";
import { show, TIER_LABEL, type GeminiDecision, type Tier } from "./lead-schema";
import { fmtIST } from "./time";

// Resend emails (brief section 11). No email ever contains a price, rate or range — the
// internal estimate appears only in the designer email, labelled "do not share".

export type SendResult = { status: "sent" | "failed" | "dry_run"; id: string | null; error: string | null };

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const list = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>Not stated</p>");

export async function sendEmail(args: { to: string[]; subject: string; html: string; text: string; idempotencyKey: string; replyTo?: string[]; attachments?: { filename: string; content: string; contentType?: string }[] }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { status: "dry_run", id: null, error: null };
  // Until the sending domain is verified, only allow-listed test addresses receive mail.
  const allow = (process.env.EMAIL_ALLOWLIST ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && args.to.some((t) => !allow.includes(t.toLowerCase()))) return { status: "failed", id: null, error: "recipient not on EMAIL_ALLOWLIST" };
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send(
    { from, to: args.to, subject: args.subject, html: args.html, text: args.text, replyTo: args.replyTo, attachments: args.attachments },
    { idempotencyKey: args.idempotencyKey },
  );
  if (error) return { status: "failed", id: null, error: `${error.name}: ${error.message}` };
  return { status: "sent", id: data?.id ?? null, error: null };
}

type LeadForEmail = {
  id: string;
  caller_name: string | null;
  caller_phone: string | null;
  caller_email: string | null;
  tier: Tier;
  value_inr: number | null;
  value_source: string | null;
  estimate_inr: number | null;
  stated_budget_min_inr: number | null;
  stated_budget_max_inr: number | null;
  fields: GeminiDecision["fields"] | null;
  criteria: GeminiDecision["criteria"] | null;
  brief: GeminiDecision["brief"] | null;
  uncertain_numbers: GeminiDecision["uncertain_numbers"] | null;
};

const lakh = (n: number | null) => (n == null ? null : `₹${(n / 100_000).toFixed(1).replace(/\.0$/, "")} lakh`);

export function designerEmail(lead: LeadForEmail, booking: { start_time: string; designer_name: string | null }, outcomeUrl: string) {
  const f = lead.fields;
  const name = show(lead.caller_name);
  const where = show(f?.locality_or_project ?? f?.city);
  const subject = `New consultation: ${name}, ${show(f?.configuration ?? f?.property_type)} in ${where}, ${fmtIST(booking.start_time)}`;
  const conv = (lead as any).converted_at ? (lead as any).converted_budget_inr : null;
  const one = lead.stated_budget_min_inr == null || lead.stated_budget_min_inr === lead.stated_budget_max_inr;
  const stated = conv != null ? `${lakh(conv)} (budget now, set by the front desk)` : lead.stated_budget_max_inr != null && one ? `${lakh(lead.stated_budget_max_inr)} (${show(f?.budget_phrase)})` : lead.stated_budget_max_inr != null ? `${lakh(lead.stated_budget_min_inr) ?? ""}${lead.stated_budget_min_inr != null ? " to " : ""}${lakh(lead.stated_budget_max_inr)} (${show(f?.budget_phrase)})` : "Not stated";
  const facts: [string, string][] = [
    ...((lead as any).converted_at ? ([["Lead history", "Was Unqualified on the call; the front desk converted it to Qualified"]] as [string, string][]) : []),
    ["Property", `${show(f?.property_type)} ${f?.configuration ? `(${f.configuration})` : ""}`],
    ["Size", f?.area_sqft ? `${f.area_sqft} sq ft (${f.area_basis})` : "Not stated"],
    ["Location", `${show(f?.locality_or_project)}, ${show(f?.city)}`],
    ["Scope", show(f?.scope_summary)],
    ["Budget as stated", stated],
    ["Timeline", show(f?.timeline)],
    ["Current state", show(f?.current_state)],
    ["Decision-maker", show(f?.decision_maker)],
    ["Language", show(f?.language)],
  ];
  if (lead.value_source === "estimated" && lead.estimate_inr != null) facts.push(["Internal estimate. Do not share with the client", lakh(lead.estimate_inr)!]);
  const unclear = lead.criteria ? Object.entries(lead.criteria).filter(([, v]) => v.result === "unclear").map(([k]) => k) : [];
  const notStated = f ? Object.entries(f).filter(([, v]) => v == null || v === "unknown").map(([k]) => k.replace(/_/g, " ")) : [];
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;font-size:15px;line-height:1.45">
<p><b>${esc(name)}</b> · ${esc(show(f?.scope_summary))} · ${esc(where)} · <b>${esc(fmtIST(booking.start_time))} IST</b></p>
<table style="border-collapse:collapse">${facts.map(([k, v]) => `<tr><td style="padding:2px 8px 2px 0;color:#555;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
${lead.uncertain_numbers?.length ? `<p><b>Flagged numbers (may be misheard):</b></p>${list(lead.uncertain_numbers.map((u) => `${u.field}: ${u.heard_as} (${u.reason})`))}` : ""}
${unclear.length ? `<p><b>Unclear:</b> ${esc(unclear.join(", "))}</p>` : ""}
<p><b>The caller asked</b></p>${list(lead.brief?.caller_asked ?? [])}
<p><b>The agent already told them</b></p>${list(lead.brief?.agent_said ?? [])}
<p><b>To find out on your call</b></p>${list([...(lead.brief?.open_questions ?? []), ...notStated.slice(0, 8).map((n) => `${n}: not stated`)])}
<p><b>Contact</b><br>${esc(name)}<br>${lead.caller_phone ? `<a href="tel:${esc(lead.caller_phone)}">${esc(lead.caller_phone)}</a>` : "Phone not stated"}<br>${esc(show(lead.caller_email))}</p>
<p><a href="${esc(outcomeUrl)}">Update outcome</a></p></div>`;
  const text = [`${name} · ${show(f?.scope_summary)} · ${where} · ${fmtIST(booking.start_time)} IST`, ...facts.map(([k, v]) => `${k}: ${v}`), `Caller asked: ${(lead.brief?.caller_asked ?? []).join("; ") || "Not stated"}`, `Agent said: ${(lead.brief?.agent_said ?? []).join("; ") || "Not stated"}`, `Contact: ${name}, ${lead.caller_phone ?? "phone not stated"}, ${show(lead.caller_email)}`, `Update outcome: ${outcomeUrl}`].join("\n");
  return { subject, html, text };
}

export function callerEmail(lead: { caller_name: string | null }, booking: { start_time: string; designer_name: string | null; reschedule_url: string | null; cancel_url: string | null }) {
  const first = (booking.designer_name ?? "our designer").split(" ")[0];
  const hi = lead.caller_name ? `Hi ${lead.caller_name.split(" ")[0]},` : "Hello,";
  const when = `${fmtIST(booking.start_time)} IST`;
  const subject = `Your consultation with Aangan Studio: ${when}`;
  const links = [booking.reschedule_url && `Reschedule: ${booking.reschedule_url}`, booking.cancel_url && `Cancel: ${booking.cancel_url}`].filter(Boolean) as string[];
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px"><p>${esc(hi)}</p><p>Your consultation with ${esc(first)} from Aangan Studio is booked for <b>${esc(when)}</b>.</p>${links.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`;
  return { subject, html, text: [hi, `Your consultation with ${first} from Aangan Studio is booked for ${when}.`, ...links].join("\n\n") };
}

export function fallbackEmail(lead: LeadForEmail, why: string) {
  const subject = `[Action needed] ${TIER_LABEL[lead.tier]} lead ${show(lead.caller_name)}: ${why}`;
  const text = [`Why: ${why}`, `Name: ${show(lead.caller_name)}`, `Phone: ${lead.caller_phone ?? "not stated"}`, `Email: ${show(lead.caller_email)}`, ...(lead.brief?.summary ?? []), ...(lead.brief?.key_facts ?? [])].join("\n");
  return { subject, text, html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${esc(text)}</pre>` };
}

export function callerLinkEmail(lead: { caller_name: string | null }, link: string) {
  const hi = lead.caller_name ? `Hi ${lead.caller_name.split(" ")[0]},` : "Hello,";
  const subject = "Book your free consultation with Aangan Studio";
  const text = [hi, "Thank you for calling Aangan Studio. Please pick a time for your free consultation with our designer:", link].join("\n\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px"><p>${esc(hi)}</p><p>Thank you for calling Aangan Studio. Please pick a time for your free consultation with our designer:</p><p><a href="${esc(link)}" style="display:inline-block;background:#1d1a16;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Choose a time</a></p></div>`;
  return { subject, html, text };
}
