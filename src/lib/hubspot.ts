// HubSpot (brief section 12; API_NOTES.md). Our backend is the only writer.
// Scopes: crm.objects.contacts.read, crm.objects.contacts.write, crm.schemas.contacts.write (setup only).
const API = "https://api.hubapi.com";
export const hubspotConfigured = () => !!process.env.HUBSPOT_ACCESS_TOKEN;

// Custom contact properties (created by scripts/hubspot-setup.ts; see HUBSPOT_SETUP.md).
export const P = {
  tier: "aangan_tier", // enumeration: Qualified | High | Medium | Low
  needsReview: "aangan_needs_review",
  notAFit: "aangan_not_a_fit_reason",
  value: "aangan_value_inr",
  valueSource: "aangan_value_source",
  budgetMin: "aangan_stated_budget_min_inr",
  budgetMax: "aangan_stated_budget_max_inr",
  estimate: "aangan_internal_estimate_inr",
  propertyType: "aangan_property_type",
  area: "aangan_area_sqft",
  locality: "aangan_locality",
  scope: "aangan_scope",
  timeline: "aangan_timeline",
  currentState: "aangan_current_state",
  callTime: "aangan_call_time",
  sendToDesigner: "aangan_send_to_designer",
  budgetNow: "aangan_budget_now_inr",
  leadId: "aangan_lead_id",
} as const;

async function hs(path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (res.status >= 300) throw new Error(`HubSpot ${res.status} ${path}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as Record<string, any>;
}

async function searchContact(prop: string, value: string): Promise<string | null> {
  const r = await hs("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: prop, operator: "EQ", value }] }], limit: 1 }),
  });
  return r.results?.[0]?.id ?? null;
}

/** Create or update the contact. De-dupe by email, else phone; a repeat caller updates the same one. */
export async function upsertContact(c: { email: string | null; phone: string | null; name: string | null; props: Record<string, unknown> }): Promise<{ id: string; dry_run: boolean }> {
  if (!hubspotConfigured()) return { id: "dry-run", dry_run: true };
  const [first, ...rest] = (c.name ?? "").trim().split(/\s+/);
  const properties: Record<string, unknown> = { ...c.props };
  if (first) properties.firstname = first;
  if (rest.length) properties.lastname = rest.join(" ");
  if (c.email) properties.email = c.email;
  if (c.phone) properties.phone = c.phone;
  let id = (c.email && (await searchContact("email", c.email))) || (c.phone && (await searchContact("phone", c.phone))) || null;
  if (id) await hs(`/crm/v3/objects/contacts/${id}`, { method: "PATCH", body: JSON.stringify({ properties }) });
  else id = (await hs("/crm/v3/objects/contacts", { method: "POST", body: JSON.stringify({ properties }) })).id as string;
  return { id: id!, dry_run: false };
}

export async function updateContact(id: string, props: Record<string, unknown>) {
  if (!hubspotConfigured()) return;
  await hs(`/crm/v3/objects/contacts/${id}`, { method: "PATCH", body: JSON.stringify({ properties: props }) });
}

export async function createNote(contactId: string, body: string): Promise<string> {
  if (!hubspotConfigured()) return "dry-run";
  const r = await hs("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: { hs_note_body: body, hs_timestamp: new Date().toISOString() },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
    }),
  });
  return r.id;
}

export async function createTask(contactId: string, t: { subject: string; body: string; dueAt: Date; priority: "HIGH" | "MEDIUM" | "LOW" }): Promise<string> {
  if (!hubspotConfigured()) return "dry-run";
  const props: Record<string, unknown> = {
    hs_task_subject: t.subject,
    hs_task_body: t.body,
    hs_timestamp: t.dueAt.toISOString(),
    hs_task_priority: t.priority,
    hs_task_status: "NOT_STARTED",
    hs_task_type: "CALL",
  };
  if (process.env.HUBSPOT_TASK_OWNER_ID) props.hubspot_owner_id = process.env.HUBSPOT_TASK_OWNER_ID; // TODO(owner): owner rule
  const r = await hs("/crm/v3/objects/tasks", {
    method: "POST",
    body: JSON.stringify({ properties: props, associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }] }] }),
  });
  return r.id;
}

/** Conversion detection by polling (brief 12.4): "send to designer" ticked, tier not yet Qualified. */
export async function findConversions(): Promise<{ id: string; budgetNow: number | null; leadId: string | null }[]> {
  if (!hubspotConfigured()) return [];
  const r = await hs("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: P.sendToDesigner, operator: "EQ", value: "true" }, { propertyName: P.tier, operator: "NEQ", value: "Qualified" }] }],
      properties: [P.budgetNow, P.leadId],
      limit: 100,
    }),
  });
  return (r.results ?? []).map((c: any) => ({ id: c.id, budgetNow: c.properties?.[P.budgetNow] ? Number(c.properties[P.budgetNow]) : null, leadId: c.properties?.[P.leadId] ?? null }));
}

/** Read-back (brief 12.5). TODO(owner): which property/stage to read; default hs_lead_status. */
export async function readStatuses(ids: string[]): Promise<Record<string, string | null>> {
  if (!hubspotConfigured() || !ids.length) return {};
  const prop = process.env.HUBSPOT_STATUS_PROPERTY || "hs_lead_status";
  const r = await hs("/crm/v3/objects/contacts/batch/read", { method: "POST", body: JSON.stringify({ properties: [prop], inputs: ids.map((id) => ({ id })) }) });
  return Object.fromEntries((r.results ?? []).map((c: any) => [c.id, c.properties?.[prop] ?? null]));
}
