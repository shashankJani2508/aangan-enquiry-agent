import { q } from "./db";
import type { Settings } from "./settings";

// Cost to run (brief section 15), calculated from actual usage in Neon, not from estimates:
// Gemini tokens (decisions table), Vaani call minutes (calls table), emails sent (emails table),
// plus fixed monthly costs prorated to the period. Rates and their sources are in settings.ts.

export type CostLine = { key: string; vendor: string; usage: string; rate: string; source: string; inr: number };
export type CostReport = {
  lines: CostLine[];
  total: number;
  leads: number;
  qualified: number;
  perLead: number | null;
  perQualified: number | null;
};

export const RATE_SOURCES = {
  gemini:
    "Google Gemini API pricing page (ai.google.dev/gemini-api/docs/pricing), 11 Oct 2026. gemini-3.5-flash is not listed there, so the newest listed Flash price ($0.75 in / $3.75 out per 1M tokens) is used so cost is not understated.",
  vaani: "Vaani dashboard, agent overview: ₹5.60/min (Vaani's own estimate), 11 Oct 2026.",
  resend: "Resend free plan: 3,000 emails/month, 100/day, ₹0 (Vercel marketplace listing, 11 Oct 2026).",
  fx: "USD→INR 96.83, exchangerate-api.com, 11 Oct 2026.",
  fixed: "Vercel Hobby, Neon (Vercel integration) free plan, no Vaani phone number yet, Calendly not used, no domain: ₹0.",
};

const inr2 = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export async function costReport(fromIso: string, toIso: string, s: Settings): Promise<CostReport> {
  const r = s.cost_rates;
  const [[tok], [mins], [mail], [counts]] = await Promise.all([
    q<{ tin: number; tout: number; n: number }>("select coalesce(sum(tokens_in),0)::float tin, coalesce(sum(tokens_out),0)::float tout, count(*)::int n from decisions where created_at >= $1 and created_at < $2", [fromIso, toIso]),
    q<{ sec: number; n: number }>("select coalesce(sum(duration_sec),0)::float sec, count(*)::int n from calls where created_at >= $1 and created_at < $2", [fromIso, toIso]),
    q<{ n: number }>("select count(*)::int n from emails where status='sent' and created_at >= $1 and created_at < $2", [fromIso, toIso]),
    q<{ leads: number; qualified: number }>("select count(*) filter (where state<>'no_content')::int leads, count(*) filter (where tier='qualified')::int qualified from leads where created_at >= $1 and created_at < $2", [fromIso, toIso]),
  ]);
  const fx = r.usd_to_inr ?? 0;
  const geminiInr = ((tok.tin * (r.gemini_usd_per_1m_input_tokens ?? 0) + tok.tout * (r.gemini_usd_per_1m_output_tokens ?? 0)) / 1e6) * fx;
  const minutes = mins.sec / 60;
  const vaaniInr = minutes * (r.vaani_inr_per_minute ?? 0);
  const resendInr = mail.n * (r.resend_inr_per_email ?? 0);
  const periodDays = (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000;
  const elapsedDays = Math.max(0, Math.min(periodDays, (Date.now() - new Date(fromIso).getTime()) / 86_400_000));
  const fixedMonthly = Object.values(s.fixed_monthly_costs_inr).reduce<number>((a, v) => a + (v ?? 0), 0);
  const fixedInr = fixedMonthly * (elapsedDays / 30);
  const lines: CostLine[] = [
    { key: "vaani", vendor: "Vaani voice agent", usage: `${mins.n} calls · ${minutes.toFixed(1)} min`, rate: `${inr2(r.vaani_inr_per_minute ?? 0)}/min`, source: RATE_SOURCES.vaani, inr: vaaniInr },
    { key: "gemini", vendor: "Google Gemini (sorting + brief)", usage: `${tok.n} decisions · ${Math.round(tok.tin).toLocaleString("en-IN")} in / ${Math.round(tok.tout).toLocaleString("en-IN")} out tokens`, rate: `$${r.gemini_usd_per_1m_input_tokens ?? 0} / $${r.gemini_usd_per_1m_output_tokens ?? 0} per 1M · ₹${fx}/$`, source: `${RATE_SOURCES.gemini} ${RATE_SOURCES.fx}`, inr: geminiInr },
    { key: "resend", vendor: "Resend emails", usage: `${mail.n} emails sent`, rate: `${inr2(r.resend_inr_per_email ?? 0)}/email`, source: RATE_SOURCES.resend, inr: resendInr },
    { key: "fixed", vendor: "Fixed (hosting, database, number, domain)", usage: `${elapsedDays.toFixed(1)} days`, rate: `${inr2(fixedMonthly)}/month`, source: RATE_SOURCES.fixed, inr: fixedInr },
  ];
  const total = lines.reduce((a, l) => a + l.inr, 0);
  return {
    lines,
    total,
    leads: counts.leads,
    qualified: counts.qualified,
    perLead: counts.leads ? total / counts.leads : null,
    perQualified: counts.qualified ? total / counts.qualified : null,
  };
}
