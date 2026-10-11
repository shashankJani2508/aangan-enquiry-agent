import { describe, expect, it } from "vitest";
import { decideTier, type FitResults, type RubricInput } from "@/lib/rubric";
import { estimateValue } from "@/lib/estimator";
import { DEFAULT_SETTINGS as S } from "@/lib/settings";

const PASS: FitResults = {
  real_project: "pass",
  service_area: "pass",
  timeline: "pass",
  budget: "pass",
  decision_maker: "pass",
};
const L = (lakh: number) => Math.round(lakh * 100_000);
const run = (p: Partial<RubricInput>) =>
  decideTier({ fit: PASS, statedBudgetMaxInr: null, estimateInr: null, ...p }, S);

describe("value bands: required boundary tests (brief 6.2)", () => {
  it.each([
    [8.0, "qualified"],
    [7.99, "high"],
    [5.0, "high"],
    [4.99, "medium"],
    [2.01, "medium"],
  ])("stated %s lakh -> %s", (lakh, tier) => {
    expect(run({ statedBudgetMaxInr: L(lakh) }).tier).toBe(tier);
  });

  it("stated 2.0 lakh -> low (fit check fails on criterion 4)", () => {
    const r = run({ statedBudgetMaxInr: L(2.0) });
    expect(r.tier).toBe("low");
    expect(r.not_a_fit_reason).toMatch(/budget/);
  });
  it("estimated 2.0 lakh -> low by value", () => {
    expect(run({ estimateInr: L(2.0) }).tier).toBe("low");
  });
  it("stated range 1 to 2 lakh -> low (upper end used)", () => {
    expect(run({ statedBudgetMaxInr: L(2) }).tier).toBe("low");
  });
  it("stated range 2 to 3 lakh -> medium", () => {
    expect(run({ statedBudgetMaxInr: L(3) }).tier).toBe("medium");
  });
  it("stated range 6 to 9 lakh -> qualified", () => {
    expect(run({ statedBudgetMaxInr: L(9) }).tier).toBe("qualified");
  });
  it("no budget and no usable estimate -> medium, needs_review", () => {
    const r = run({});
    expect(r.tier).toBe("medium");
    expect(r.needs_review).toBe(true);
    expect(r.value_source).toBe("none");
  });
  it("front desk converts a High lead with a new budget of 3 lakh -> qualified, no re-check", () => {
    const r = run({ statedBudgetMaxInr: L(3), convertedByFrontDesk: true });
    expect(r.tier).toBe("qualified");
    expect(r.group).toBe("qualified");
  });
  it("fit fails on service area with a stated budget of 20 lakh -> low", () => {
    const r = run({ fit: { ...PASS, service_area: "fail" }, statedBudgetMaxInr: L(20) });
    expect(r.tier).toBe("low");
    expect(r.not_a_fit_reason).toMatch(/service area/);
  });
  it("fit fails on timeline (3 weeks) with a stated budget of 4 to 5 lakh -> low", () => {
    const r = run({ fit: { ...PASS, timeline: "fail" }, statedBudgetMaxInr: L(5) });
    expect(r.tier).toBe("low");
    expect(r.not_a_fit_reason).toMatch(/timeline/);
  });
  it("stated budget wins over the estimate", () => {
    const r = run({ statedBudgetMaxInr: L(6), estimateInr: L(30) });
    expect(r.tier).toBe("high");
    expect(r.value_source).toBe("stated");
  });
});

describe("fit check boundaries (brief 6.1)", () => {
  it.each(["real_project", "service_area"] as const)("unclear %s -> medium needs_review", (k) => {
    const r = run({ fit: { ...PASS, [k]: "unclear" }, statedBudgetMaxInr: L(20) });
    expect(r.tier).toBe("medium");
    expect(r.needs_review).toBe(true);
  });
  it("no completion date (timeline unclear) passes -> tier from value (owner decision)", () => {
    expect(run({ fit: { ...PASS, timeline: "unclear" }, estimateInr: L(21) }).tier).toBe("qualified");
  });
  it("unclear budget or decision maker is treated as passing", () => {
    const r = run({ fit: { ...PASS, budget: "unclear", decision_maker: "unclear" }, estimateInr: L(20) });
    expect(r.tier).toBe("qualified");
  });
  it("decision maker never fails the lead", () => {
    const r = run({ fit: { ...PASS, decision_maker: "fail" }, estimateInr: L(20) });
    expect(r.tier).toBe("qualified");
  });
  it("office above 3,000 sq ft -> medium needs_review (R9)", () => {
    const r = run({ officeOverMaxSqft: true, estimateInr: L(60) });
    expect(r.tier).toBe("medium");
    expect(r.needs_review).toBe(true);
  });
});

describe("estimator (brief 8.2)", () => {
  const base = {
    property_type: "apartment" as const,
    scope_type: "full_home" as const,
    area_sqft: null as number | null,
    designed_area_sqft: null as number | null,
    spec_cue: "none" as const,
    commercial_tier_cue: "none" as const,
  };
  it("full home: carpet x ₹2,400 (T01: 1,400 sq ft -> ₹33.6 lakh)", () => {
    expect(estimateValue({ ...base, area_sqft: 1400 }).inr).toBe(3_360_000);
  });
  it("office: area x ₹1,800 (T06: 800 sq ft -> ₹14.4 lakh)", () => {
    expect(estimateValue({ ...base, property_type: "office", scope_type: "office_fitout", area_sqft: 800 }).inr).toBe(1_440_000);
  });
  it("coworking pod 180 sq ft -> about ₹3.2 lakh -> medium (T18, R9)", () => {
    const e = estimateValue({ ...base, property_type: "office", scope_type: "office_fitout", area_sqft: 180 });
    expect(e.inr).toBe(324_000);
    expect(run({ estimateInr: e.inr }).tier).toBe("medium");
  });
  it("single room -> ₹8 lakh -> qualified (R8)", () => {
    const e = estimateValue({ ...base, scope_type: "single_room" });
    expect(e.inr).toBe(800_000);
    expect(run({ estimateInr: e.inr }).tier).toBe("qualified");
  });
  it("partial home without designed area -> unknown", () => {
    expect(estimateValue({ ...base, scope_type: "partial_home", area_sqft: 1100 }).inr).toBeNull();
  });
  it("partial home with designed area uses it", () => {
    expect(estimateValue({ ...base, scope_type: "partial_home", designed_area_sqft: 400 }).inr).toBe(960_000);
  });
  it("luxury cue -> unknown (no upper bound)", () => {
    expect(estimateValue({ ...base, area_sqft: 2000, spec_cue: "luxury" }).inr).toBeNull();
  });
  it("premium cue uses the premium high end", () => {
    expect(estimateValue({ ...base, area_sqft: 1000, spec_cue: "premium" }).inr).toBe(3_500_000);
  });
  it("no type and no scope -> unknown", () => {
    expect(estimateValue({ ...base, property_type: "unknown", scope_type: "unknown", area_sqft: 900 }).inr).toBeNull();
  });
});

// The proposed labels (eval-proposed-labels.md), encoded as rubric inputs. Checks that the
// code rubric reproduces each proposed tier from the same fit result and value. This tests
// our rules, not Gemini; the Gemini comparison is `npm run eval:transcripts`.
describe("code rubric reproduces eval-proposed-labels.md", () => {
  type Row = [id: string, fit: Partial<FitResults>, stated: number | null, est: number | null, tier: string, review?: boolean];
  const rows: Row[] = [
    ["T01", {}, null, L(33.6), "qualified"],
    ["T02", {}, null, L(22.8), "qualified"],
    ["T03", { service_area: "fail" }, null, null, "low"],
    ["T04", { real_project: "fail" }, null, null, "low"],
    ["T05", {}, null, L(57.6), "qualified"],
    ["T06", {}, null, L(14.4), "qualified"],
    ["T07", { timeline: "fail" }, null, null, "low"],
    ["T10", {}, L(1.5), null, "low"],
    ["T11", {}, null, null, "medium", true],
    ["T12", {}, null, L(132), "qualified"],
    ["T13", {}, null, null, "medium", true],
    ["T14", { decision_maker: "unclear" }, null, null, "medium", true],
    ["T15", {}, null, L(21), "qualified"],
    ["T16", {}, null, null, "medium", true],
    ["T17", {}, null, L(25.2), "qualified"],
    ["T18", {}, null, L(3.24), "medium"],
    ["T19", { real_project: "fail" }, null, null, "low"],
    ["T20", {}, null, L(21.6), "qualified"],
    ["W01", {}, null, L(43.2), "qualified"],
    ["W02", { real_project: "unclear" }, null, null, "medium", true],
    ["W03", {}, null, null, "medium", true],
    ["W04", {}, null, L(21.6), "qualified"],
    ["W05", { real_project: "unclear" }, null, null, "medium", true],
    ["W06", {}, null, null, "medium", true],
    ["W07", { real_project: "fail" }, null, null, "low"],
    ["W08", {}, null, L(20.4), "qualified"],
    ["W09", {}, null, null, "medium", true],
    ["W10", { real_project: "fail" }, null, null, "low"],
    ["F01", {}, null, L(22.08), "qualified"],
    ["F02", {}, null, null, "medium", true],
    ["F03", { service_area: "fail" }, L(20), null, "low"],
    ["F04", { real_project: "unclear" }, null, null, "medium", true],
    ["F05", {}, L(80), null, "qualified"],
    ["F06", {}, L(40), null, "qualified"],
    ["F07", { real_project: "unclear" }, null, null, "medium", true],
    ["F08", { timeline: "fail" }, L(5), null, "low"],
    ["F09", {}, null, L(27.6), "qualified"],
    ["F10", {}, L(22), null, "qualified"],
  ];
  it.each(rows)("%s", (_id, fit, stated, est, tier, review) => {
    const r = run({ fit: { ...PASS, ...fit }, statedBudgetMaxInr: stated, estimateInr: est });
    expect(r.tier).toBe(tier);
    if (review) expect(r.needs_review).toBe(true);
  });
});

import { candidateSlots, findSlot, icsInvite } from "@/lib/scheduler";
describe("built-in automatic booking", () => {
  const d1 = { name: "Asha", email: "asha@x.com" };
  const d2 = { name: "Vikram", email: "vik@x.com" };
  it("only offers slots inside Mon-Sat 10:00-19:00 IST", () => {
    const slots = candidateSlots(new Date("2026-10-10T16:30:00Z"), S, 3); // Sat 22:00 IST
    expect(slots[0].toISOString()).toBe("2026-10-12T04:30:00.000Z"); // Mon 10:00 IST, Sunday skipped
    for (const t of slots) {
      const ist = new Date(t.getTime() + 330 * 60_000);
      expect(ist.getUTCDay()).not.toBe(0);
      expect(ist.getUTCHours()).toBeGreaterThanOrEqual(10);
      expect(ist.getUTCHours()).toBeLessThan(19);
    }
  });
  it("respects minimum notice and picks the earliest free slot", () => {
    const r = findSlot(new Date("2026-10-12T04:30:00Z"), S, [d1], new Set(), {}); // +18h -> Tue 10:00 IST
    expect(r!.start.toISOString()).toBe("2026-10-13T04:30:00.000Z");
  });
  it("never double-books a designer and uses the other one", () => {
    const r = findSlot(new Date("2026-10-12T04:30:00Z"), S, [d1, d2], new Set(["Asha|2026-10-13T04:30:00.000Z"]), {});
    expect(r!.designer).toEqual(d2);
    expect(r!.start.toISOString()).toBe("2026-10-13T04:30:00.000Z");
  });
  it("balances load across designers", () => {
    expect(findSlot(new Date("2026-10-12T04:30:00Z"), S, [d1, d2], new Set(), { Asha: 5 })!.designer).toEqual(d2);
  });
  it("designers sharing one inbox are still separate people", () => {
    const a = { name: "Asha", email: "me@x.com" }, b = { name: "Vikram", email: "me@x.com" };
    const r = findSlot(new Date("2026-10-12T04:30:00Z"), S, [a, b], new Set(["Asha|2026-10-13T04:30:00.000Z"]), {});
    expect(r!.designer.name).toBe("Vikram");
    expect(r!.start.toISOString()).toBe("2026-10-13T04:30:00.000Z");
  });
  it("builds a valid calendar invite", () => {
    const ics = icsInvite({ start: new Date("2026-10-13T04:30:00Z"), minutes: 60, title: "Consultation", description: "x", organizer: "asha@x.com", attendees: ["asha@x.com", "c@x.com"] });
    expect(ics).toContain("DTSTART:20261013T043000Z");
    expect(ics).toContain("DTEND:20261013T053000Z");
    expect(ics).toContain("RSVP=TRUE:mailto:c@x.com");
  });
});
