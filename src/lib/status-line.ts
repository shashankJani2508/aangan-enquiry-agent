// One-line status (brief 8.4): a template over fields, never written by an LLM.
export type LeadRow = {
  id: string;
  created_at: string;
  caller_name: string | null;
  caller_phone: string | null;
  tier: string | null;
  needs_review: boolean;
  value_inr: number | null;
  value_source: string | null;
  fields: { property_type?: string; configuration?: string | null; area_sqft?: number | null; locality_or_project?: string | null } | null;
  state: string;
  booking_status: string | null;
  booking_fail_reason: string | null;
  hubspot_push_ok: boolean | null;
  frontdesk_status: string | null;
  not_a_fit_reason: string | null;
  outcome: string | null;
  converted_at: string | null;
};

const lakh = (n: number) => `₹${(n / 100_000).toFixed(1).replace(/\.0$/, "")}L`;

export function statusLine(l: LeadRow): string {
  const f = l.fields ?? {};
  const value = l.value_inr != null ? `${lakh(l.value_inr)} ${l.value_source === "stated" ? "stated" : "internal est."}` : "value unknown";
  const what = [f.configuration ?? (f.property_type && f.property_type !== "unknown" ? f.property_type : null), f.area_sqft ? `${f.area_sqft} sq ft` : null, f.locality_or_project].filter(Boolean).join(", ") || "details not stated";
  let status: string;
  if (l.state === "no_content") status = "no content";
  else if (l.tier === "low" && l.not_a_fit_reason) status = `not a fit: ${l.not_a_fit_reason}`;
  else if (l.tier === "qualified") status = l.outcome ? `outcome: ${l.outcome}` : l.booking_status === "booked" ? "meeting booked" : l.booking_status === "link_sent" ? "booking link sent" : l.booking_status === "booking_failed" ? `booking failed (${l.booking_fail_reason})` : "booking pending";
  else status = l.frontdesk_status ? `front desk: ${l.frontdesk_status}` : "with front desk";
  const flags = [l.needs_review ? "needs review" : null, l.converted_at ? "converted" : null, l.hubspot_push_ok === false ? "HubSpot push failed" : null, l.state === "needs_attention" ? "needs attention" : null].filter(Boolean);
  return `${value} · ${what} · ${status}${flags.length ? " · " + flags.join(", ") : ""}`;
}
