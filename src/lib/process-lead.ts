import { q, getSettings, logEvent } from "./db";
import { runGemini } from "./gemini";
import { recheckDecision } from "./rubric";
import { callerWordCount, extractCall, type Envelope } from "./vaani";
import { TIER_LABEL, type GeminiDecision, type Tier } from "./lead-schema";
import { bookNextSlot, calendlyConfigured } from "./calendly";
import { autoBook, callerBookedEmail, inviteFor, type BookingRow } from "./booking";
import { callerEmail, designerEmail, fallbackEmail, sendEmail } from "./email";
import * as hubspot from "./hubspot";
import { taskDueAt } from "./time";
import { outcomeUrl } from "./tokens";
import type { Settings } from "./settings";

// The wiring between Vaani, Neon, Gemini, Calendly, Resend and HubSpot (brief section 5).
// processLead is safe to call from the webhook, the HubSpot conversion poll and the sweeper:
// each side effect is a row in action_steps and runs at most once successfully.

const MAX_ATTEMPTS = 5;
const envList = (k: string) => (process.env[k] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

type Lead = {
  id: string;
  state: string;
  channel: string;
  caller_phone: string | null;
  phone_masked: boolean;
  caller_email: string | null;
  caller_name: string | null;
  tier: Tier | null;
  needs_review: boolean;
  not_a_fit_reason: string | null;
  reason: string | null;
  value_inr: number | null;
  value_source: string | null;
  estimate_inr: number | null;
  stated_budget_min_inr: number | null;
  stated_budget_max_inr: number | null;
  fields: GeminiDecision["fields"] | null;
  criteria: GeminiDecision["criteria"] | null;
  brief: GeminiDecision["brief"] | null;
  uncertain_numbers: GeminiDecision["uncertain_numbers"] | null;
  hubspot_contact_id: string | null;
  converted_at: string | null;
  ai_status: string | null;
  created_at: string;
};

const getLead = async (id: string) => (await q<Lead>("select * from leads where id=$1", [id]))[0];

// ---------- 1. Ingest a Vaani event ----------

export async function handleVaaniEvent(env: Envelope): Promise<void> {
  const s = await getSettings();
  if (env.type === "webhook.ping") return;
  if (env.type === "usage.charged") {
    await q("insert into costs (vendor, amount_inr, units, detail) values ('vaani', null, 'TODO(source): see detail', $1)", [JSON.stringify(env.data)]);
    return;
  }
  if (env.type === "call.ended") return; // wait for Post-Processing, which carries the transcript
  if (env.type !== "call.completed" && env.type !== "call.failed") return;

  const c = extractCall(env.data);
  if (env.type === "call.failed") {
    await q("insert into calls (event_id, vaani_call_id, status, caller_phone, ended_reason, matched_paths) values ($1,$2,'failed',$3,$4,$5) on conflict (vaani_call_id) do nothing",
      [env.id, c.vaani_call_id, c.caller_phone, c.ended_reason, JSON.stringify(c.matched_paths)]);
    await logEvent(null, "system", "call.failed", { event_id: env.id, ended_reason: c.ended_reason });
    return;
  }

  const noContent = callerWordCount(c.transcript) < s.no_content_min_caller_words && !c.summary;
  // Repeat caller: same phone, open lead within the window -> attach to the same lead (section 18).
  let leadId: string | null = null;
  if (c.caller_phone && !c.phone_masked && !noContent) {
    const prev = await q<{ id: string }>(
      `select id from leads where caller_phone=$1 and state <> 'no_content' and created_at > now() - ($2 || ' days')::interval order by created_at desc limit 1`,
      [c.caller_phone, String(s.repeat_window_days)],
    );
    leadId = prev[0]?.id ?? null;
  }
  if (!leadId) {
    const r = await q<{ id: string }>("insert into leads (channel, state, caller_phone, phone_masked) values ('phone',$1,$2,$3) returning id",
      [noContent ? "no_content" : "received", c.caller_phone, c.phone_masked]);
    leadId = r[0].id;
    await logEvent(leadId, "system", "call.received", { event_id: env.id, duration_sec: c.duration_sec });
  } else {
    await logEvent(leadId, "system", "repeat_call.attached", { event_id: env.id });
  }
  const ins = await q("insert into calls (lead_id, event_id, vaani_call_id, status, caller_phone, started_at, duration_sec, ended_reason, transcript, vaani_summary, vaani_fields, matched_paths) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (vaani_call_id) do nothing returning id",
    [leadId, env.id, c.vaani_call_id, noContent ? "no_content" : "completed", c.caller_phone, c.started_at, c.duration_sec, c.ended_reason, c.transcript, c.summary, JSON.stringify(c.structured_fields), JSON.stringify(c.matched_paths)]);
  if (!ins.length) return; // same call delivered under another event id
  if (c.cost?.unit === "paise") {
    await q("insert into costs (lead_id, vendor, amount_inr, units, detail) values ($1,'vaani',$2,'inr',$3)", [leadId, c.cost.amount / 100, JSON.stringify(c.cost)]);
  }
  if (noContent) return;
  if (!c.transcript && !c.summary) {
    await q("update leads set tier='medium', grp='unqualified', needs_review=true, reason='Transcript and summary missing from the event', ai_status='unavailable', state='decided' where id=$1", [leadId]);
    await opsAlert(`Lead ${leadId}: call.completed carried no transcript or summary`);
  } else {
    await decideLead(leadId, s);
  }
  await processLead(leadId);
}

// ---------- 2. Gemini decides; code re-checks ----------

export async function decideLead(leadId: string, s?: Settings): Promise<void> {
  s ??= await getSettings();
  const lead = await getLead(leadId);
  if (lead.converted_at) return; // converted leads stay Qualified, no re-check
  const calls = await q<{ transcript: string | null; vaani_summary: string | null; vaani_fields: unknown; created_at: string }>(
    "select transcript, vaani_summary, vaani_fields, created_at from calls where lead_id=$1 and status='completed' order by created_at", [leadId]);
  const transcript = calls.map((c, i) => (calls.length > 1 ? `--- Call ${i + 1} ---\n` : "") + (c.transcript ?? "(no transcript)")).join("\n");
  const summary = calls.map((c) => c.vaani_summary).filter(Boolean).join("\n---\n") || null;
  const callDate = new Date(calls[0]?.created_at ?? lead.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const g = await runGemini({ callDateIso: callDate, channel: lead.channel, transcript, vaaniSummary: summary, vaaniFields: (calls.at(-1)?.vaani_fields as Record<string, unknown>) ?? null }, s);
  const geminiCost = s.cost_rates.gemini_usd_per_1m_input_tokens != null && s.cost_rates.gemini_usd_per_1m_output_tokens != null && s.cost_rates.usd_to_inr != null
    ? ((g.tokensIn * s.cost_rates.gemini_usd_per_1m_input_tokens + g.tokensOut * s.cost_rates.gemini_usd_per_1m_output_tokens) / 1e6) * s.cost_rates.usd_to_inr
    : null;
  await q("insert into costs (lead_id, vendor, amount_inr, units, detail) values ($1,'gemini',$2,'inr',$3)", [leadId, geminiCost, JSON.stringify({ tokens_in: g.tokensIn, tokens_out: g.tokensOut, model: g.model })]);

  if (!g.ok) {
    await q("insert into decisions (lead_id, model, ok, error, tokens_in, tokens_out, final_tier) values ($1,$2,false,$3,$4,$5,'medium')", [leadId, g.model, g.error, g.tokensIn, g.tokensOut]);
    const brief = { summary: ["AI brief unavailable", ...(summary ? [summary.slice(0, 500)] : [])], key_facts: [], caller_asked: [], agent_said: [], open_questions: [] };
    await q("update leads set state='decided', grp='unqualified', tier='medium', needs_review=true, reason='AI decision unavailable', ai_status='unavailable', brief=$2, updated_at=now() where id=$1", [leadId, JSON.stringify(brief)]);
    await logEvent(leadId, "gemini", "decision.failed", { error: g.error });
    return;
  }
  const d = g.decision;
  if (d.no_content) {
    await q("update leads set state='no_content', updated_at=now() where id=$1", [leadId]);
    await logEvent(leadId, "gemini", "decision.no_content", {});
    return;
  }
  const rc = recheckDecision(d, s);
  const f = rc.final;
  await q("insert into decisions (lead_id, model, ok, raw, tokens_in, tokens_out, final_tier, override_note) values ($1,$2,true,$3,$4,$5,$6,$7)",
    [leadId, g.model, g.raw, g.tokensIn, g.tokensOut, f.tier, rc.override_note]);
  await q(
    `update leads set state='decided', grp=$2, tier=$3, needs_review=$4, not_a_fit_reason=$5, reason=$6, value_inr=$7, value_source=$8,
       stated_budget_min_inr=$9, stated_budget_max_inr=$10, estimate_inr=$11, estimate_basis=$12, fields=$13, criteria=$14, brief=$15,
       uncertain_numbers=$16, discrepancies=$17, ai_status='ok', rule_override=$18, rule_override_note=$19,
       caller_name=coalesce($20, caller_name), caller_email=coalesce($21, caller_email), updated_at=now() where id=$1`,
    [leadId, f.group, f.tier, f.needs_review || !lead.caller_phone || lead.phone_masked, f.not_a_fit_reason, f.reason, f.value_inr, f.value_source,
      d.fields.budget_min_inr, d.fields.budget_max_inr, rc.estimate.inr, rc.estimate.basis, JSON.stringify(d.fields), JSON.stringify(d.criteria), JSON.stringify(d.brief),
      JSON.stringify(d.uncertain_numbers), JSON.stringify(d.discrepancies), rc.overridden, rc.override_note, d.fields.caller_name, d.fields.email],
  );
  await logEvent(leadId, "gemini", "decision", { gemini_tier: d.tier, final_tier: f.tier, override: rc.override_note });
}

// ---------- 3. Carry out the decision ----------

async function runStep<T>(leadId: string, step: string, fn: () => Promise<T>): Promise<{ ran: boolean; ok: boolean; result?: T; error?: string; attempts: number }> {
  const claim = await q<{ attempts: number }>(
    `insert into action_steps (lead_id, step, status, attempts, locked_at) values ($1,$2,'running',1,now())
     on conflict (lead_id, step) do update set status='running', attempts=action_steps.attempts+1, locked_at=now(), updated_at=now()
       where action_steps.status in ('pending','failed') and action_steps.attempts < ${MAX_ATTEMPTS}
          or (action_steps.status='running' and action_steps.locked_at < now() - interval '5 minutes')
     returning attempts`, [leadId, step]);
  if (!claim.length) {
    const prev = await q<{ status: string; result: T; attempts: number }>("select status, result, attempts from action_steps where lead_id=$1 and step=$2", [leadId, step]);
    return { ran: false, ok: prev[0]?.status === "done", result: prev[0]?.result, attempts: prev[0]?.attempts ?? 0 };
  }
  try {
    const result = await fn();
    await q("update action_steps set status='done', result=$3, last_error=null, updated_at=now() where lead_id=$1 and step=$2", [leadId, step, JSON.stringify(result ?? null)]);
    await logEvent(leadId, "system", `step.${step}`, { ok: true });
    return { ran: true, ok: true, result, attempts: claim[0].attempts };
  } catch (e) {
    const error = String(e).slice(0, 500);
    await q("update action_steps set status='failed', last_error=$3, updated_at=now() where lead_id=$1 and step=$2", [leadId, step, error]);
    await logEvent(leadId, "system", `step.${step}`, { ok: false, error });
    return { ran: true, ok: false, error, attempts: claim[0].attempts };
  }
}

function hubspotProps(l: Lead): Record<string, unknown> {
  const f = l.fields;
  return {
    [hubspot.P.tier]: l.tier ? TIER_LABEL[l.tier] : null,
    [hubspot.P.needsReview]: l.needs_review,
    [hubspot.P.notAFit]: l.not_a_fit_reason,
    [hubspot.P.value]: l.value_inr,
    [hubspot.P.valueSource]: l.value_source,
    [hubspot.P.budgetMin]: l.stated_budget_min_inr,
    [hubspot.P.budgetMax]: l.stated_budget_max_inr,
    [hubspot.P.estimate]: l.estimate_inr,
    [hubspot.P.propertyType]: f?.property_type,
    [hubspot.P.area]: f?.area_sqft,
    [hubspot.P.locality]: [f?.locality_or_project, f?.city].filter(Boolean).join(", ") || null,
    [hubspot.P.scope]: f?.scope_summary,
    [hubspot.P.timeline]: f?.timeline,
    [hubspot.P.currentState]: f?.current_state,
    [hubspot.P.callTime]: l.created_at,
    [hubspot.P.leadId]: l.id,
  };
}

const briefNote = (l: Lead) =>
  [
    `<b>Aangan lead: ${l.tier ? TIER_LABEL[l.tier] : "?"}</b>${l.needs_review ? " (needs review)" : ""}${!l.caller_phone ? " · no phone number captured" : ""}`,
    l.reason,
    l.ai_status === "unavailable" ? "<b>AI brief unavailable</b>" : "",
    ...(l.brief?.summary ?? []),
    l.brief?.key_facts?.length ? "<b>Key facts</b><br>" + l.brief.key_facts.join("<br>") : "",
    l.brief?.caller_asked?.length ? "<b>Caller asked</b><br>" + l.brief.caller_asked.join("<br>") : "",
    l.brief?.agent_said?.length ? "<b>Agent said</b><br>" + l.brief.agent_said.join("<br>") : "",
    l.brief?.open_questions?.length ? "<b>Open questions</b><br>" + l.brief.open_questions.join("<br>") : "",
  ].filter(Boolean).join("<br>");

export async function processLead(leadId: string): Promise<void> {
  const s = await getSettings();
  let lead = await getLead(leadId);
  if (!lead?.tier || lead.state === "no_content") return;
  await q("update leads set state='actioning', updated_at=now() where id=$1 and state in ('decided','needs_attention')", [leadId]);
  const problems: string[] = [];

  // HubSpot: every lead.
  const contact = await runStep(leadId, "hubspot_contact", async () =>
    hubspot.upsertContact({ email: lead.caller_email, phone: lead.caller_phone, name: lead.caller_name, props: hubspotProps(lead) }));
  if (contact.ok && contact.result) {
    await q("update leads set hubspot_contact_id=$2, hubspot_push_ok=true where id=$1", [leadId, (contact.result as { id: string }).id]);
  } else if (!contact.ok && contact.attempts >= MAX_ATTEMPTS) {
    await q("update leads set hubspot_push_ok=false where id=$1", [leadId]);
    await runStep(leadId, "email_fallback_hubspot", () => sendFallback(lead, "HubSpot push failed"));
    problems.push("HubSpot push failed");
  }
  lead = await getLead(leadId);
  const cid = lead.hubspot_contact_id;
  const callCount = (await q<{ n: number }>("select count(*)::int n from calls where lead_id=$1", [leadId]))[0]?.n ?? 1;
  if (cid) {
    await hubspot.updateContact(cid, hubspotProps(lead)).catch(() => {}); // keep tier current on re-decisions
    await runStep(leadId, `hubspot_note_brief:${callCount}`, () => hubspot.createNote(cid, briefNote(lead)));
  }

  if (lead.tier === "high" || lead.tier === "medium") {
    if (cid) {
      await runStep(leadId, "hubspot_task", () =>
        hubspot.createTask(cid, {
          subject: `Call back ${lead.caller_name ?? "caller"} (Unqualified, ${TIER_LABEL[lead.tier!]} probability)`,
          body: lead.reason ?? "",
          dueAt: taskDueAt(new Date(lead.created_at), s),
          priority: lead.tier === "high" ? "HIGH" : "MEDIUM",
        }));
    }
  }

  // Built-in automatic booking (owner decision 11 Oct 2026): Calendly's free plan has no booking
  // API, so unless a paid Calendly token is set, the system books the next free designer slot
  // itself and emails both sides a calendar invite. The caller does not choose (brief 2.15).
  const linkMode = lead.tier === "qualified" && !calendlyConfigured() && process.env.CALENDLY_DRY_RUN !== "1";
  if (linkMode) {
    if (!lead.caller_email) {
      await q("update leads set booking_status='booking_failed', booking_fail_reason='no_email' where id=$1", [leadId]);
      if (cid) await runStep(leadId, "hubspot_task_urgent", () => hubspot.createTask(cid, { subject: `Qualified lead, needs booking: ${lead.caller_name ?? "caller"}`, body: "No email captured: book by phone", dueAt: taskDueAt(new Date(), s), priority: "HIGH" }));
      const r = await runStep(leadId, "email_fallback_booking", () => sendFallback(lead, "Qualified lead with no email: book by phone"));
      if (!r.ok) problems.push("fallback email failed");
    } else {
      const booked = await runStep(leadId, "auto_book", () => autoBook(leadId, s));
      if (!booked.ok) {
        await q("update leads set booking_status='booking_failed', booking_fail_reason=$2 where id=$1", [leadId, "no_free_slot"]);
        await runStep(leadId, "email_fallback_booking", () => sendFallback(lead, `Qualified lead could not be auto-booked (${booked.error ?? "no slot"})`));
        await opsAlert(`Lead ${leadId}: auto-booking failed (${booked.error})`);
        problems.push("booking failed");
      } else {
        const b = booked.result as BookingRow;
        await q("update leads set booking_status='booked' where id=$1", [leadId]);
        const invite = inviteFor(b, lead);
        const de = designerEmail(lead as any, { start_time: b.start_time, designer_name: b.designer_name }, outcomeUrl(leadId, s.outcome_token_days));
        const r1 = await runStep(leadId, "email_designer", () => recordEmail(leadId, "designer", [b.designer_email], de, s, invite));
        const r2 = await runStep(leadId, "email_caller", () => recordEmail(leadId, "caller", [lead.caller_email!], callerBookedEmail(lead, b), s, invite));
        if (!r1.ok || !r2.ok) problems.push("email failed");
        if (cid) await runStep(leadId, "hubspot_note_booking", () => hubspot.createNote(cid, `Booked with ${b.designer_name} on ${new Date(b.start_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`));
      }
    }
  }

  if (lead.tier === "qualified" && !linkMode) {
    const why = !lead.caller_email ? "no_email" : null;
    let booked = why ? null : await runStep(leadId, "calendly_book", async () => {
      const b = await bookNextSlot({ name: lead.caller_name ?? "Aangan enquiry", email: lead.caller_email! });
      await q("insert into bookings (lead_id, status, designer_name, designer_email, start_time, calendly_event_uri, calendly_invitee_uri, cancel_url, reschedule_url) values ($1,'booked',$2,$3,$4,$5,$6,$7,$8)",
        [leadId, b.designer_name, b.designer_email, b.start_time, b.event_uri, b.invitee_uri, b.cancel_url, b.reschedule_url]);
      return b;
    });
    const configErr = booked && !booked.ok && /Calendly 40[13]/.test(booked.error ?? "");
    if (why || (booked && !booked.ok && (configErr || booked.attempts >= 3))) {
      const reason = why ?? (configErr ? "calendly_config" : "calendly_failed");
      await q("update leads set booking_status='booking_failed', booking_fail_reason=$2 where id=$1", [leadId, reason]);
      if (cid) await runStep(leadId, "hubspot_task_urgent", () => hubspot.createTask(cid, { subject: `Qualified lead, needs booking: ${lead.caller_name ?? "caller"}`, body: `Auto-booking failed: ${reason}`, dueAt: taskDueAt(new Date(), s), priority: "HIGH" }));
      await runStep(leadId, "email_fallback_booking", () => sendFallback(lead, `Qualified lead could not be booked (${reason})`));
      if (reason !== "no_email") await opsAlert(`Lead ${leadId}: booking failed (${booked?.error ?? reason})`);
      problems.push(`booking failed: ${reason}`);
    } else if (booked?.ok) {
      const b = booked.result as Awaited<ReturnType<typeof bookNextSlot>>;
      await q("update leads set booking_status='booked' where id=$1", [leadId]);
      const designerTo = b.designer_email ? [b.designer_email] : envList("QUALIFIED_FALLBACK_EMAILS");
      const de = designerEmail(lead as any, b, outcomeUrl(leadId, s.outcome_token_days));
      const r1 = await runStep(leadId, "email_designer", () => recordEmail(leadId, "designer", designerTo, de, s));
      // TODO(owner): Calendly also emails the invitee itself (API_NOTES.md). See OPEN_QUESTIONS Q-CAL-3.
      const ce = callerEmail(lead, b);
      const r2 = await runStep(leadId, "email_caller", () => recordEmail(leadId, "caller", [lead.caller_email!], ce, s));
      if (!r1.ok || !r2.ok) problems.push("email failed");
      if (cid) await runStep(leadId, "hubspot_note_booking", () => hubspot.createNote(cid, `Booked with ${b.designer_name ?? "designer"} on ${new Date(b.start_time).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`));
    } else {
      problems.push("booking pending retry");
    }
  }

  const pending = await q<{ n: number }>("select count(*)::int n from action_steps where lead_id=$1 and status in ('failed','running')", [leadId]);
  const state = problems.length || pending[0].n ? "needs_attention" : "done";
  await q("update leads set state=$2, updated_at=now() where id=$1", [leadId, state]);
}

async function recordEmail(leadId: string, kind: string, to: string[], m: { subject: string; html: string; text: string }, s: Settings, attachments?: { filename: string; content: string; contentType?: string }[]) {
  if (!to.length) throw new Error(`no recipient for ${kind} email`);
  const r = await sendEmail({ to, ...m, idempotencyKey: `${leadId}:${kind}`, replyTo: envList("FRONT_DESK_EMAILS"), attachments });
  await q("insert into emails (lead_id, kind, to_email, status, provider_id, error) values ($1,$2,$3,$4,$5,$6)", [leadId, kind, to.join(","), r.status, r.id, r.error]);
  if (r.status === "sent") await q("insert into costs (lead_id, vendor, amount_inr, units) values ($1,'resend',$2,'inr')", [leadId, s.cost_rates.resend_inr_per_email]);
  if (r.status === "failed") throw new Error(r.error ?? "email failed");
  return r;
}

async function sendFallback(lead: Lead, why: string) {
  const to = [...envList("QUALIFIED_FALLBACK_EMAILS"), ...envList("FRONT_DESK_EMAILS")];
  const m = fallbackEmail(lead as any, why);
  return recordEmail(lead.id, "fallback", to, m, await getSettings());
}

export async function opsAlert(message: string) {
  const to = envList("OPS_ALERT_EMAIL");
  await logEvent(null, "system", "ops_alert", { message });
  if (!to.length) return;
  await sendEmail({ to, subject: `[Aangan ops] ${message.slice(0, 80)}`, text: message, html: `<p>${message}</p>`, idempotencyKey: `ops:${message.slice(0, 200)}` }).catch(() => {});
}

// ---------- 4. Front desk conversion (brief 12.4) ----------

export async function convertLead(leadId: string, budgetNowInr: number | null, actor = "frontdesk") {
  const lead = await getLead(leadId);
  if (!lead || lead.converted_at) return;
  await q("update leads set converted_at=now(), converted_budget_inr=$2, grp='qualified', tier='qualified', needs_review=false, reason='Converted by the front desk (no re-check)', state='decided', updated_at=now() where id=$1", [leadId, budgetNowInr]);
  await logEvent(leadId, actor, "frontdesk.converted", { from_tier: lead.tier, budget_now_inr: budgetNowInr });
  if (lead.hubspot_contact_id) await hubspot.updateContact(lead.hubspot_contact_id, { [hubspot.P.tier]: "Qualified" });
  await processLead(leadId);
}
