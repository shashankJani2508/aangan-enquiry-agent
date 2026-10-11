import pricing from "../../pricing.config.json";
import type { LeadFields } from "./lead-schema";

// Internal value estimate (brief 8.2). Only used when no budget was stated. Aggressive:
// the high end of the range. Returns null ("unknown") rather than guessing.
// Label everywhere: "Internal estimate".

export type Estimate = { inr: number | null; basis: string };

const COMMERCIAL = new Set(["office", "clinic", "studio"]);

type EstimateInput = Pick<
  LeadFields,
  | "property_type"
  | "scope_type"
  | "area_sqft"
  | "designed_area_sqft"
  | "spec_cue"
  | "commercial_tier_cue"
>;

export function estimateValue(f: EstimateInput): Estimate {
  const isCommercial = COMMERCIAL.has(f.property_type) || f.scope_type === "office_fitout";

  if (isCommercial) {
    const tier = f.commercial_tier_cue === "none" ? "basic" : f.commercial_tier_cue;
    const rate = pricing.commercial_per_sqft_inr[tier].high;
    const area = f.designed_area_sqft ?? f.area_sqft;
    if (!area) return { inr: null, basis: "unknown: commercial, no area" };
    return { inr: Math.round(area * rate), basis: `${area} sq ft x ₹${rate} (commercial ${tier}, high end)` };
  }

  if (f.scope_type === "single_room") {
    const hi = pricing.residential_single_room_all_in_inr.high;
    return { inr: hi, basis: "single room, high end of all-in range" };
  }

  if (f.property_type === "unknown" && f.scope_type === "unknown") {
    return { inr: null, basis: "unknown: no property type or scope" };
  }

  const tier = f.spec_cue === "none" ? "standard" : f.spec_cue;
  const rate = pricing.residential_per_sqft_inr[tier].high;
  if (rate == null) return { inr: null, basis: "unknown: luxury has no upper bound" };

  if (f.scope_type === "partial_home") {
    if (!f.designed_area_sqft) return { inr: null, basis: "unknown: partial home, designed area not given" };
    return {
      inr: Math.round(f.designed_area_sqft * rate),
      basis: `${f.designed_area_sqft} sq ft designed area x ₹${rate} (residential ${tier}, high end)`,
    };
  }

  if (f.scope_type === "full_home") {
    if (!f.area_sqft) return { inr: null, basis: "unknown: full home, no area" };
    return {
      inr: Math.round(f.area_sqft * rate),
      basis: `${f.area_sqft} sq ft x ₹${rate} (residential ${tier}, high end)`,
    };
  }

  return { inr: null, basis: "unknown: scope not clear enough to estimate" };
}
