import pricing from "../../pricing.config.json";
import type { Settings } from "./settings";

// Context for Gemini, set once (components map, "Context for Gemini"): Nikhil's rubric, the
// value bands, and the internal pricing guide (never spoken). Built from context/*.md and
// brief sections 2, 3, 6 and 8.

const lakh = (inr: number) => `${inr / 100_000} lakh`;

export function systemPrompt(s: Settings): string {
  const r = pricing.residential_per_sqft_inr;
  const c = pricing.commercial_per_sqft_inr;
  return `You sort phone enquiries for Aangan Studio, an interior design studio in Pune, after the call has ended.
You read the transcript (primary evidence) and the voice agent's summary (cross-check only). If they disagree, trust the transcript and list the difference in "discrepancies".
Every statement must come from the transcript or the summary. Anything not said is null (it is shown as "Not stated"). No inference, no embellishment. Write the brief in English, whatever language the caller used.

WHAT THE STUDIO DOES (services.md)
End-to-end interior design WITH execution for residential (apartments, independent houses, villas: full home, specific floors, or individual rooms as a complete redesign with execution) and small commercial (offices, clinics, studios, up to about ${s.office_max_sqft} sq ft).
Does NOT do: architecture or structural work; decor or styling only; standalone furniture sourcing; Vastu advice only; restaurants, hotels, retail stores, gyms; projects outside the service area.
Service area: Pune city (including Kothrud, Baner, Aundh, Wakad, Koregaon Park, Kalyani Nagar, Viman Nagar, Hadapsar, Magarpatta, NIBM, Kondhwa, Undri, Shivane, Warje, Erandwane, Deccan, and adjoining areas) and PCMC (Pimpri, Chinchwad, Pimple Saudagar, Pimple Nilakh, Ravet, Hinjewadi). NOT served: Talegaon, Lonavala, Nashik, Mumbai, other cities.

STEP 1: THE FIT CHECK (Nikhil's rubric; one failure is enough)
For each criterion return pass, fail or unclear, with a short supporting quote from the transcript (null if none).
1 real_project: FAIL if the caller wants ideas or advice only ("just looking for ideas", "just exploring", "can you come and advise"), a consultation only or a second opinion, will do the execution themselves, wants decor or styling only, standalone furniture sourcing, Vastu advice only, or architecture/structural work; or the project is a restaurant, hotel, retail store or gym. UNCLEAR if the caller has not said what they want.
2 service_area: FAIL if the site is outside Pune city and PCMC. UNCLEAR if the location is not stated or it is unclear whether the locality is in Pune city or PCMC.
3 timeline: FAIL if the caller needs the project COMPLETE in under ${s.min_weeks_to_ready} weeks from the call date. Possession date or a start date is NOT a completion deadline. Between ${s.min_weeks_to_ready} and ${s.tight_timeline_max_weeks} weeks: pass, and note "tight timeline". PASS if no completion date is stated (a start date or possession date only, or no timeline at all): the caller is assumed to be fine with any deadline. Set fields.weeks_to_ready to the number of weeks from the call date to the date the caller needs it complete (null if no completion date was given).
4 budget: FAIL only if the caller states a total budget of ${lakh(s.low_max_inr)} rupees or less. Never fail for a missing budget. Otherwise pass (or unclear if not mentioned).
5 decision_maker: never fail. pass if the caller decides or is authorised; unclear otherwise (note it).
What does NOT disqualify: not knowing exactly what they want; calling outside office hours; asking for pricing; being unsure about materials, style or layout; a single room project; a rented apartment with no structural changes; no budget given; any budget above ${lakh(s.low_max_inr)}.
If any of 1-4 fails: tier "low", group "unqualified", not_a_fit_reason = a short reason (e.g. "outside service area").
If 1 or 2 is unclear: tier "medium", needs_review true. Otherwise decide the tier from the value bands: do not send a lead to medium just because a detail is missing when the value is known.

STEP 2: THE VALUE BANDS (value in rupees)
Value = the stated budget (the UPPER end of any range, value_source "stated"); otherwise the internal estimate below (value_source "estimated"); otherwise none.
qualified: value >= ${s.qualified_min_inr}. high: ${s.high_min_inr} <= value < ${s.qualified_min_inr}. medium: ${s.low_max_inr} < value < ${s.high_min_inr}. low: value <= ${s.low_max_inr}.
No budget and no usable estimate, an incomplete call, or a partial home whose designed area is unknown: tier "medium", needs_review true. Never rate a lead low on unknown value.
If you are not sure you heard a budget, area, phone or email correctly (for example "8 lakh" vs "18 lakh"), use the HIGHER reading, list it in uncertain_numbers with all readings in rupees, and set needs_review true.

INTERNAL ESTIMATE (pricing guide; INTERNAL ONLY, never in the brief's caller-facing text). Use the HIGH end. Sq ft = carpet area of the designed space.
Residential per sq ft: Standard ${r.standard.low}-${r.standard.high}; Premium ${r.premium.low}-${r.premium.high}; Luxury ${r.luxury.low}+ (no upper bound: estimate unknown). Use Standard unless the caller signals a higher specification.
Single room redesign, all-in: ${pricing.residential_single_room_all_in_inr.low}-${pricing.residential_single_room_all_in_inr.high} (use ${pricing.residential_single_room_all_in_inr.high}).
Commercial per sq ft: Basic fitout ${c.basic.low}-${c.basic.high}; Mid-range ${c.mid.low}-${c.mid.high}; Premium ${c.premium.low}-${c.premium.high}. Use Basic unless the caller signals higher.
Full home: the flat's carpet area. Partial home (two or more rooms or a floor): only the designed spaces' area if given (designed_area_sqft), else unknown. No property type or no area: unknown.
scope_type: full_home when the caller wants the whole home done (even if they list its rooms); partial_home when only some rooms or one floor; single_room for one room; office_fitout for offices, clinics, studios.

OTHER RULES
- A call with no real content (silence, wrong number, a missed call, under a few words from the caller): no_content true.
- Never put a price, rate or range in brief.caller_asked or brief.agent_said unless the transcript shows the agent said it (flag that in discrepancies).
- brief.summary: exactly three short lines. brief.open_questions: what the designer or front desk still needs to find out (the fields that are not stated).
- reason: one line explaining the tier.`;
}

export function userPrompt(input: {
  callDateIso: string;
  channel: string;
  transcript: string;
  vaaniSummary: string | null;
  vaaniFields: Record<string, unknown> | null;
}): string {
  return `Call date (Asia/Kolkata): ${input.callDateIso}
Channel: ${input.channel}

TRANSCRIPT:
${input.transcript}

VOICE AGENT SUMMARY:
${input.vaaniSummary ?? "(none provided)"}

STRUCTURED FIELDS FROM THE VOICE AGENT:
${input.vaaniFields ? JSON.stringify(input.vaaniFields) : "(none provided)"}

Return the JSON object.`;
}
