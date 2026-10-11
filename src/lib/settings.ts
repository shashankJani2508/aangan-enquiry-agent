// Default settings (brief sections 4, 6, 13.1, 15). Every value here is editable on the
// founder settings page; the DB copy (table `settings`) overrides these defaults.
export type Settings = {
  qualified_min_inr: number; // value >= this -> Qualified (brief 6.2)
  high_min_inr: number; // high_min <= value < qualified_min -> High
  low_max_inr: number; // value <= this -> Low; also the on-call decline line (stated budget)
  min_weeks_to_ready: number; // R4: decline when needed complete in under this many weeks
  tight_timeline_max_weeks: number; // R4: between min and this -> pass, note "tight timeline"
  office_max_sqft: number; // R9: offices above this are "unclear" -> Medium, needs_review
  repeat_window_days: number; // section 18
  no_content_min_caller_words: number; // section 18 "empty or very short call"
  working_days: number[]; // 1 = Monday ... 7 = Sunday (Asia/Kolkata)
  working_start: string; // "10:00"
  working_end: string; // "19:00"
  outcome_token_days: number; // 13.2
  outcome_reasons: string[]; // 13.2, TODO(owner) confirm with Nikhil
  cost_rates: {
    usd_to_inr: number | null;
    gemini_usd_per_1m_input_tokens: number | null;
    gemini_usd_per_1m_output_tokens: number | null;
    resend_inr_per_email: number | null;
    vaani_inr_per_minute: number | null; // only used if the webhook carries no cost
  };
  fixed_monthly_costs_inr: Record<string, number | null>;
};

export const DEFAULT_SETTINGS: Settings = {
  qualified_min_inr: 800_000,
  high_min_inr: 500_000,
  low_max_inr: 200_000,
  min_weeks_to_ready: 8, // TODO(owner): Nikhil to confirm (brief section 4, item 16)
  tight_timeline_max_weeks: 10,
  office_max_sqft: 3000,
  repeat_window_days: 14,
  no_content_min_caller_words: 5, // TODO(owner): confirm what counts as "very short"
  working_days: [1, 2, 3, 4, 5, 6],
  working_start: "10:00",
  working_end: "19:00",
  outcome_token_days: 60,
  outcome_reasons: [
    "Budget too low",
    "Went with another studio",
    "Project postponed",
    "Unreachable",
    "Other",
  ],
  // Brief section 15: never guess a vendor price. All null until the owner sets them.
  // Rates filled 11 Oct 2026 at the owner's request; each source is listed in costs.ts (RATE_SOURCES).
  cost_rates: {
    usd_to_inr: 96.83, // exchangerate-api.com, 11 Oct 2026
    gemini_usd_per_1m_input_tokens: 0.75, // newest Flash price listed (3.5 Flash not on the page)
    gemini_usd_per_1m_output_tokens: 3.75,
    resend_inr_per_email: 0, // free plan, 3,000/month
    vaani_inr_per_minute: 5.6, // Vaani dashboard estimate
  },
  fixed_monthly_costs_inr: {
    neon: 0, // free plan via the Vercel integration
    vercel: 0, // Hobby plan
    calendly: 0, // not used: booking is built in
    vaani_number: 0, // no number bought yet
    domain: 0, // none yet
  },
};

export function mergeSettings(overrides: Partial<Settings> | null | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...(overrides ?? {}) } as Settings;
}

export function costRatesUnset(s: Settings): boolean {
  return (
    Object.values(s.cost_rates).some((v) => v == null) ||
    Object.values(s.fixed_monthly_costs_inr).some((v) => v == null)
  );
}
