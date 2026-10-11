import { GoogleGenAI } from "@google/genai";
import { GeminiDecision } from "./lead-schema";
import { systemPrompt, userPrompt } from "./gemini-prompt";
import type { Settings } from "./settings";

// Gemini decision + brief (brief 8.3). JSON output validated with Zod. Model from GEMINI_MODEL.

const S = { type: ["string", "null"] };
const N = { type: ["number", "null"] };
const STRS = { type: "array", items: { type: "string" } };
const en = (...v: string[]) => ({ type: "string", enum: v });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
});
const crit = obj({ result: en("pass", "fail", "unclear"), quote: S });

export const DECISION_JSON_SCHEMA = obj({
  no_content: { type: "boolean" },
  fields: obj({
    caller_name: S,
    email: S,
    language: S,
    property_type: en("apartment", "independent_house", "villa", "office", "clinic", "studio", "other", "unknown"),
    city: S,
    locality_or_project: S,
    area_sqft: N,
    area_basis: en("carpet", "built_up", "unknown"),
    designed_space: S,
    designed_area_sqft: N,
    configuration: S,
    scope_summary: S,
    scope_type: en("full_home", "partial_home", "single_room", "office_fitout", "other", "unknown"),
    design_and_execution: en("yes", "no", "unknown"),
    work_type: en("new", "renovation", "unknown"),
    current_state: S,
    budget_min_inr: N,
    budget_max_inr: N,
    budget_phrase: S,
    timeline: S,
    needed_by_date: S,
    weeks_to_ready: N,
    decision_maker: en("self", "authorised_by_decider", "researching_for_someone", "unknown"),
    heard_about_us: S,
    referrer: S,
    spec_cue: en("none", "standard", "premium", "luxury"),
    commercial_tier_cue: en("none", "basic", "mid", "premium"),
    caller_questions: STRS,
    agent_said: STRS,
    notes: S,
  }),
  criteria: obj({ real_project: crit, service_area: crit, timeline: crit, budget: crit, decision_maker: crit }),
  not_a_fit_reason: S,
  value_inr: N,
  value_source: en("stated", "estimated", "none"),
  group: en("qualified", "unqualified"),
  tier: en("qualified", "high", "medium", "low"),
  needs_review: { type: "boolean" },
  reason: { type: "string" },
  uncertain_numbers: {
    type: "array",
    items: obj({ field: { type: "string" }, heard_as: { type: "string" }, readings_inr: { type: ["array", "null"], items: { type: "number" } }, reason: { type: "string" } }),
  },
  discrepancies: {
    type: "array",
    items: obj({ topic: { type: "string" }, transcript_says: { type: "string" }, summary_says: { type: "string" } }),
  },
  brief: obj({ summary: STRS, key_facts: STRS, caller_asked: STRS, agent_said: STRS, open_questions: STRS }),
});

export type GeminiResult =
  | { ok: true; decision: GeminiDecision; model: string; tokensIn: number; tokensOut: number; raw: string }
  | { ok: false; error: string; model: string; tokensIn: number; tokensOut: number };

export async function runGemini(
  input: Parameters<typeof userPrompt>[0],
  settings: Settings,
  opts: { retries?: number; timeoutMs?: number } = {},
): Promise<GeminiResult> {
  const model = process.env.GEMINI_MODEL || "TODO(owner): set GEMINI_MODEL";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set", model, tokensIn: 0, tokensOut: 0 };
  const ai = new GoogleGenAI({ apiKey });
  const retries = opts.retries ?? 2;
  let lastErr = "";
  let tokensIn = 0;
  let tokensOut = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await withTimeout(
        ai.models.generateContent({
          model,
          contents: userPrompt(input),
          config: {
            systemInstruction: systemPrompt(settings),
            responseMimeType: "application/json",
            responseJsonSchema: DECISION_JSON_SCHEMA,
            temperature: 0,
          },
        }),
        opts.timeoutMs ?? 60_000,
      );
      tokensIn += res.usageMetadata?.promptTokenCount ?? 0;
      tokensOut += (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0);
      const raw = res.text ?? "";
      const parsed = GeminiDecision.safeParse(JSON.parse(raw));
      if (parsed.success) return { ok: true, decision: parsed.data, model, tokensIn, tokensOut, raw };
      lastErr = "schema: " + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join("; ");
    } catch (e) {
      lastErr = String(e).slice(0, 500);
      if (/\b(400|401|403|404)\b/.test(lastErr)) break; // config errors: do not retry
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  return { ok: false, error: lastErr, model, tokensIn, tokensOut };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)));
  });
}
