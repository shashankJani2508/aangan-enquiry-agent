import type { CriterionResult, GeminiDecision, Tier, ValueSource } from "./lead-schema";
import { estimateValue } from "./estimator";
import type { Settings } from "./settings";

// The rubric (brief section 6). Gemini decides; this code re-checks and the rules win.

export type FitResults = {
  real_project: CriterionResult;
  service_area: CriterionResult;
  timeline: CriterionResult;
  budget: CriterionResult;
  decision_maker: CriterionResult;
};

export type RubricInput = {
  fit: FitResults;
  statedBudgetMaxInr: number | null; // upper end of any stated range (already the higher reading)
  estimateInr: number | null;
  notAFitReason?: string | null;
  convertedByFrontDesk?: boolean;
  officeOverMaxSqft?: boolean; // R9
};

export type RubricResult = {
  group: "qualified" | "unqualified";
  tier: Tier;
  needs_review: boolean;
  value_inr: number | null;
  value_source: ValueSource;
  not_a_fit_reason: string | null;
  reason: string;
};

const FAIL_REASON: Record<string, string> = {
  real_project: "not a real project (advice/ideas only, self-execution, decor only, or out of scope)",
  service_area: "outside service area (Pune city and PCMC)",
  timeline: "timeline too short",
  budget: "stated budget too low for the scope",
};

export function tierForValue(valueInr: number, s: Settings): Tier {
  if (valueInr >= s.qualified_min_inr) return "qualified";
  if (valueInr >= s.high_min_inr) return "high";
  if (valueInr > s.low_max_inr) return "medium";
  return "low";
}

export function decideTier(input: RubricInput, s: Settings): RubricResult {
  const value_inr = input.statedBudgetMaxInr ?? input.estimateInr;
  const value_source: ValueSource =
    input.statedBudgetMaxInr != null ? "stated" : input.estimateInr != null ? "estimated" : "none";

  // Brief 2.17 / 12.4: a front-desk conversion counts as Qualified, no re-check.
  if (input.convertedByFrontDesk) {
    return {
      group: "qualified",
      tier: "qualified",
      needs_review: false,
      value_inr,
      value_source,
      not_a_fit_reason: null,
      reason: "Converted by the front desk (counts as Qualified, no re-check)",
    };
  }

  // Step 1: fit check. One failure on criteria 1-4 is enough (R5). A stated budget at or
  // below the low line is criterion 4 failing, whatever Gemini said.
  const fit = { ...input.fit };
  if (input.statedBudgetMaxInr != null && input.statedBudgetMaxInr <= s.low_max_inr) fit.budget = "fail";
  for (const k of ["real_project", "service_area", "timeline", "budget"] as const) {
    if (fit[k] === "fail") {
      const nf = input.notAFitReason || FAIL_REASON[k];
      return {
        group: "unqualified",
        tier: "low",
        needs_review: false,
        value_inr,
        value_source,
        not_a_fit_reason: nf,
        reason: `Not a fit: ${nf}`,
      };
    }
  }

  // Unclear on 1 or 2 -> Medium, needs_review. Owner decision (11 Oct 2026): no stated
  // completion date means any deadline is fine, so an unclear timeline passes. 4 and 5 pass too.
  const unclear = (["real_project", "service_area"] as const).filter((k) => fit[k] === "unclear");
  if (unclear.length) {
    return {
      group: "unqualified",
      tier: "medium",
      needs_review: true,
      value_inr,
      value_source,
      not_a_fit_reason: null,
      reason: `Fit unclear on: ${unclear.join(", ")}`,
    };
  }
  if (input.officeOverMaxSqft) {
    return {
      group: "unqualified",
      tier: "medium",
      needs_review: true,
      value_inr,
      value_source,
      not_a_fit_reason: null,
      reason: `Office above about ${s.office_max_sqft} sq ft: unclear fit`,
    };
  }

  // Step 2: value bands. Never rate Low on unknown value.
  if (value_inr == null) {
    return {
      group: "unqualified",
      tier: "medium",
      needs_review: true,
      value_inr: null,
      value_source: "none",
      not_a_fit_reason: null,
      reason: "No budget and no usable detail for an estimate",
    };
  }
  const tier = tierForValue(value_inr, s);
  const lakh = (value_inr / 100_000).toFixed(2).replace(/\.00$/, "");
  return {
    group: tier === "qualified" ? "qualified" : "unqualified",
    tier,
    needs_review: false,
    value_inr,
    value_source,
    not_a_fit_reason: null, // a stated budget <= low line already failed criterion 4 above
    reason: `Value ₹${lakh} lakh (${value_source === "stated" ? "stated budget" : "internal estimate"})`,
  };
}

/** Upper end of the stated budget, taking the higher reading of any uncertain budget number (8.3). */
export function statedBudgetMax(d: Pick<GeminiDecision, "fields" | "uncertain_numbers">): number | null {
  const f = d.fields;
  let max = f.budget_max_inr ?? f.budget_min_inr ?? null;
  for (const u of d.uncertain_numbers) {
    if (/budget/i.test(u.field) && u.readings_inr?.length) {
      const hi = Math.max(...u.readings_inr);
      max = max == null ? hi : Math.max(max, hi);
    }
  }
  return max;
}

export type Recheck = {
  final: RubricResult;
  estimate: { inr: number | null; basis: string };
  overridden: boolean;
  override_note: string | null;
};

/** Code re-check of Gemini's decision (brief 8.1). If the rules disagree, the rules win. */
export function recheckDecision(d: GeminiDecision, s: Settings): Recheck {
  const estimate = estimateValue(d.fields);
  const fit: FitResults = {
    real_project: d.criteria.real_project.result,
    service_area: d.criteria.service_area.result,
    timeline: d.criteria.timeline.result,
    budget: d.criteria.budget.result,
    decision_maker: d.criteria.decision_maker.result,
  };
  // R4: if Gemini gave a weeks-to-ready figure, the setting decides the timeline criterion.
  const notes: string[] = [];
  if (d.fields.weeks_to_ready != null) {
    const derived: CriterionResult = d.fields.weeks_to_ready < s.min_weeks_to_ready ? "fail" : "pass";
    if (derived !== fit.timeline) notes.push(`timeline ${fit.timeline} -> ${derived} (${d.fields.weeks_to_ready} weeks)`);
    fit.timeline = derived;
  }
  const commercial = ["office", "clinic", "studio"].includes(d.fields.property_type) || d.fields.scope_type === "office_fitout";
  const final = decideTier(
    {
      fit,
      statedBudgetMaxInr: statedBudgetMax(d),
      estimateInr: estimate.inr,
      notAFitReason: d.not_a_fit_reason,
      officeOverMaxSqft: commercial && (d.fields.area_sqft ?? 0) > s.office_max_sqft,
    },
    s,
  );
  if (final.tier !== d.tier) notes.push(`tier ${d.tier} -> ${final.tier}`);
  if (final.needs_review !== d.needs_review && final.tier === d.tier) notes.push(`needs_review ${d.needs_review} -> ${final.needs_review}`);
  // Keep Gemini's needs_review if it raised one we would not (e.g. uncertain numbers).
  if (d.needs_review && !final.needs_review) final.needs_review = true;
  if (final.tier === d.tier) final.reason = d.reason || final.reason;
  return {
    final,
    estimate,
    overridden: notes.some((n) => n.startsWith("tier")),
    override_note: notes.length ? notes.join("; ") : null,
  };
}
