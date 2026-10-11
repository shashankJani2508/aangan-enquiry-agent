import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Vaani Labs webhooks (brief section 9; re-check against https://vaanilabs.in/docs/api/webhooks).
// Signature: "sha256=" + lowercase hex HMAC-SHA256 of the exact raw body, keyed with the secret.

export const MAX_WEBHOOK_BYTES = 1_000_000;

export function signBody(rawBody: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = Buffer.from(signBody(rawBody, secret), "utf8");
  const got = Buffer.from(header.trim(), "utf8");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const Envelope = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  created: z.union([z.string(), z.number()]).optional(),
  data: z.record(z.unknown()).default({}),
});
export type Envelope = z.infer<typeof Envelope>;

// The Vaani dashboard names events "Call Ended", "Call Post-Processing", "Call Failed", which
// differs from the API docs (call.completed). Normalise whatever arrives. TODO(source): confirm
// the exact strings from the first captured delivery.
export function normaliseType(t: string): "call.completed" | "call.ended" | "call.failed" | "webhook.ping" | string {
  const x = t.toLowerCase().replace(/[^a-z]/g, "");
  if (/postprocess|completed|analysisready/.test(x)) return "call.completed";
  if (/ended|hangup/.test(x)) return "call.ended";
  if (/failed|noanswer|rejected/.test(x)) return "call.failed";
  if (/ping|test/.test(x)) return "webhook.ping";
  return t;
}

/** Build an envelope from either the documented {id,type,data} shape or a flat payload. */
export function toEnvelope(body: Record<string, unknown>, headerType: string | null, deliveryId: string | null, rawHash: string): Envelope {
  const rawType = String(body.type ?? body.event ?? body.event_type ?? headerType ?? "unknown");
  const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
  const id = String(body.id ?? body.event_id ?? deliveryId ?? `sha_${rawHash}`);
  return { id, type: normaliseType(rawType), created: body.created as string | undefined, data };
}

// The docs say no sub-field of `data` is guaranteed. Until we capture a real call.completed
// payload (brief section 4, item 3), we look in several plausible places and record which
// path matched. TODO(source): replace the candidate lists with the real field names.
const pick = (obj: unknown, paths: string[]): { value: unknown; path: string | null } => {
  for (const p of paths) {
    const v = p.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
    if (v !== undefined && v !== null && v !== "") return { value: v, path: p };
  }
  return { value: null, path: null };
};

export type ExtractedCall = {
  vaani_call_id: string | null;
  caller_phone: string | null;
  phone_masked: boolean;
  transcript: string | null;
  summary: string | null;
  duration_sec: number | null;
  ended_reason: string | null;
  started_at: string | null;
  cost: { amount: number; unit: string } | null;
  structured_fields: Record<string, unknown> | null;
  matched_paths: Record<string, string | null>;
};

function transcriptToText(t: unknown): string | null {
  if (t == null) return null;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    return t
      .map((turn) => {
        if (typeof turn === "string") return turn;
        const r = turn as Record<string, unknown>;
        const who = String(r.role ?? r.speaker ?? r.from ?? "unknown");
        const text = String(r.text ?? r.content ?? r.message ?? r.transcript ?? "");
        return `${who}: ${text}`;
      })
      .join("\n");
  }
  return JSON.stringify(t);
}

export function extractCall(data: Record<string, unknown>): ExtractedCall {
  // Paths confirmed from Vaani's test delivery (10 Oct 2026): call_id, phone_number, transcript,
  // summary, entities, dispositions, call_duration, end_reason. Others kept as fallbacks.
  const id = pick(data, ["call_id", "room_name", "call.id", "id", "conversation_id"]);
  const phone = pick(data, ["phone_number", "from", "from_number", "caller.number", "caller_number", "customer.number", "call.from"]);
  const tr = pick(data, ["transcript", "call.transcript", "transcript_text", "messages", "conversation.transcript"]);
  const sum = pick(data, ["summary", "call.summary", "analysis.summary", "brief", "call_summary"]);
  const dur = pick(data, ["call_duration", "duration_seconds", "duration", "call.duration", "duration_sec"]);
  const end = pick(data, ["end_reason", "reason", "ended_reason", "call.ended_reason", "status_reason"]);
  const start = pick(data, ["started_at", "start_time", "call.started_at", "created_at"]);
  const cost = pick(data, ["cost_paise", "cost", "call.cost", "usage.cost"]);
  const fields = pick(data, ["entities", "extracted_data", "collected_data", "variables", "lead", "fields"]);
  const phoneStr = phone.value == null ? null : String(phone.value);
  return {
    vaani_call_id: id.value == null ? null : String(id.value),
    caller_phone: phoneStr,
    phone_masked: !!phoneStr && /[*xX•]{2,}/.test(phoneStr),
    transcript: transcriptToText(tr.value),
    summary: sum.value == null ? null : typeof sum.value === "string" ? sum.value : JSON.stringify(sum.value),
    duration_sec: dur.value == null ? null : Math.round(Number(dur.value)),
    ended_reason: end.value == null ? null : String(end.value),
    started_at: start.value == null ? null : String(start.value),
    cost:
      cost.value == null
        ? null
        : { amount: Number(cost.value), unit: cost.path === "cost_paise" ? "paise" : "TODO(source): unit unknown" },
    structured_fields:
      fields.value && typeof fields.value === "object"
        ? { ...(fields.value as Record<string, unknown>), ...(data.dispositions ? { dispositions: data.dispositions } : {}) }
        : null,
    matched_paths: { id: id.path, phone: phone.path, transcript: tr.path, summary: sum.path, duration: dur.path, cost: cost.path },
  };
}

/** Rough count of words the caller said, used for the `no_content` rule. */
export function callerWordCount(transcript: string | null): number {
  if (!transcript) return 0;
  // Real Vaani lines start with a timestamp: "[07:45:20] USER: ...".
  const strip = (l: string) => l.trim().replace(/^\[[^\]]*\]\s*/, "");
  const lines = transcript.split("\n").map(strip).filter((l) => /^(user|caller|customer|human)\s*:/i.test(l));
  const text = lines.length ? lines.map((l) => l.replace(/^[^:]+:/, "")).join(" ") : transcript;
  return text.split(/\s+/).filter(Boolean).length;
}

export const redactPhone = (p: string | null | undefined) => (p ? p.replace(/\d(?=\d{2})/g, "•") : "");
export const redactEmail = (e: string | null | undefined) => (e ? e.replace(/^(.).*(@.*)$/, "$1•••$2") : "");

/** Brief section 9: never store audio. Drop any recording link before the payload is saved. */
export function stripRecording(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), (k, v) => (/recording/i.test(k) ? undefined : v));
  } catch {
    return raw;
  }
}

/** URL-key auth for Vaani dashboard webhooks, which are unsigned unless a secret is set. */
export function verifyUrlKey(url: string, key: string | undefined): boolean {
  if (!key || key.length < 24) return false;
  const got = Buffer.from(new URL(url).searchParams.get("k") ?? "");
  const want = Buffer.from(key);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Owner decision (11 Oct 2026): accept Vaani dashboard deliveries without a key (VAANI_ALLOW_UNSIGNED=1).
 * Guard: only requests in Vaani's exact shape pass: x-webhook-event header, a known event name,
 * and a call_id. Anything else is rejected.
 */
const VAANI_EVENTS = new Set(["call_postprocessing", "call_ended", "call_failed", "webhook_test"]);
export function looksLikeVaani(headerEvent: string | null, raw: string): boolean {
  // Real calls carry the event only in the body; the dashboard's test button also sends a header.
  try {
    const b = JSON.parse(raw) as Record<string, any>;
    if (!VAANI_EVENTS.has(b.event)) return false;
    if (headerEvent && headerEvent !== b.event) return false;
    if (headerEvent === "webhook_test") return true;
    return typeof (b.call_id ?? b.data?.call_id) === "string";
  } catch {
    return false;
  }
}
