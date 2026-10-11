import { z } from "zod";

// Single source of truth for the lead brief (brief section 7). Field list and enums are a
// PROPOSAL pending Shashank's sign-off (section 7, last paragraph). Missing = null, shown as
// "Not stated"; never inferred.

export const PropertyType = z.enum([
  "apartment",
  "independent_house",
  "villa",
  "office",
  "clinic",
  "studio",
  "other",
  "unknown",
]);
export const ScopeType = z.enum([
  "full_home",
  "partial_home",
  "single_room",
  "office_fitout",
  "other",
  "unknown",
]);
export const AreaBasis = z.enum(["carpet", "built_up", "unknown"]);
export const WorkType = z.enum(["new", "renovation", "unknown"]);
export const YesNoUnknown = z.enum(["yes", "no", "unknown"]);
export const DecisionMaker = z.enum([
  "self",
  "authorised_by_decider",
  "researching_for_someone",
  "unknown",
]);
export const SpecCue = z.enum(["none", "standard", "premium", "luxury"]);
export const CommercialCue = z.enum(["none", "basic", "mid", "premium"]);

export const LeadFields = z.object({
  caller_name: z.string().nullable(),
  email: z.string().nullable(),
  language: z.string().nullable(),
  property_type: PropertyType,
  city: z.string().nullable(),
  locality_or_project: z.string().nullable(),
  area_sqft: z.number().nullable(),
  area_basis: AreaBasis,
  designed_space: z.string().nullable(),
  designed_area_sqft: z.number().nullable(),
  configuration: z.string().nullable(),
  scope_summary: z.string().nullable(),
  scope_type: ScopeType,
  design_and_execution: YesNoUnknown,
  work_type: WorkType,
  current_state: z.string().nullable(),
  budget_min_inr: z.number().nullable(),
  budget_max_inr: z.number().nullable(),
  budget_phrase: z.string().nullable(),
  timeline: z.string().nullable(),
  needed_by_date: z.string().nullable(), // ISO date if the caller gave one
  weeks_to_ready: z.number().nullable(), // weeks from the call to "complete by"
  decision_maker: DecisionMaker,
  heard_about_us: z.string().nullable(),
  referrer: z.string().nullable(),
  spec_cue: SpecCue,
  commercial_tier_cue: CommercialCue,
  caller_questions: z.array(z.string()),
  agent_said: z.array(z.string()),
  notes: z.string().nullable(),
});
export type LeadFields = z.infer<typeof LeadFields>;

export const CriterionResult = z.enum(["pass", "fail", "unclear"]);
export type CriterionResult = z.infer<typeof CriterionResult>;
const Criterion = z.object({ result: CriterionResult, quote: z.string().nullable() });

export const Criteria = z.object({
  real_project: Criterion, // 1
  service_area: Criterion, // 2
  timeline: Criterion, // 3
  budget: Criterion, // 4
  decision_maker: Criterion, // 5 (never fails)
});
export type Criteria = z.infer<typeof Criteria>;

export const Tier = z.enum(["qualified", "high", "medium", "low"]);
export type Tier = z.infer<typeof Tier>;
export const ValueSource = z.enum(["stated", "estimated", "none"]);
export type ValueSource = z.infer<typeof ValueSource>;

export const GeminiDecision = z.object({
  no_content: z.boolean(),
  fields: LeadFields,
  criteria: Criteria,
  not_a_fit_reason: z.string().nullable(),
  value_inr: z.number().nullable(),
  value_source: ValueSource,
  group: z.enum(["qualified", "unqualified"]),
  tier: Tier,
  needs_review: z.boolean(),
  reason: z.string(),
  uncertain_numbers: z.array(
    z.object({
      field: z.string(),
      heard_as: z.string(),
      readings_inr: z.array(z.number()).nullable(),
      reason: z.string(),
    }),
  ),
  discrepancies: z.array(
    z.object({ topic: z.string(), transcript_says: z.string(), summary_says: z.string() }),
  ),
  brief: z.object({
    summary: z.array(z.string()), // three lines
    key_facts: z.array(z.string()),
    caller_asked: z.array(z.string()),
    agent_said: z.array(z.string()),
    open_questions: z.array(z.string()),
  }),
});
export type GeminiDecision = z.infer<typeof GeminiDecision>;

export const NOT_STATED = "Not stated";
export const show = (v: unknown): string =>
  v === null || v === undefined || v === "" || v === "unknown" ? NOT_STATED : String(v);

export const TIER_LABEL: Record<Tier, string> = {
  qualified: "Qualified",
  high: "High",
  medium: "Medium",
  low: "Low",
};
