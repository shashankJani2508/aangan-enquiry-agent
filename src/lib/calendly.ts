// Calendly booking (brief section 10; API_NOTES.md). Needs a paid plan (Standard+) and a
// personal access token with scheduled_events:write. Picks the earliest open slot.
const API = "https://api.calendly.com";

export type Booking = {
  start_time: string;
  designer_name: string | null;
  designer_email: string | null;
  event_uri: string | null;
  invitee_uri: string | null;
  cancel_url: string | null;
  reschedule_url: string | null;
  dry_run: boolean;
};
export class CalendlyConfigError extends Error {}

export const calendlyConfigured = () => !!(process.env.CALENDLY_TOKEN && process.env.CALENDLY_EVENT_TYPE_URI);

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(path.startsWith("http") ? path : API + path, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CALENDLY_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: body as Record<string, any> };
}

export async function bookNextSlot(invitee: { name: string; email: string }): Promise<Booking> {
  if (!calendlyConfigured()) {
    return { start_time: new Date(Date.now() + 86_400_000).toISOString(), designer_name: "DRY RUN designer", designer_email: null, event_uri: null, invitee_uri: null, cancel_url: null, reschedule_url: null, dry_run: true };
  }
  const eventType = process.env.CALENDLY_EVENT_TYPE_URI!;
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = new Date(Date.now() + 5 * 60_000).toISOString();
    const end = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const avail = await call(`/event_type_available_times?event_type=${encodeURIComponent(eventType)}&start_time=${start}&end_time=${end}`);
    if (avail.status === 401 || avail.status === 403) throw new CalendlyConfigError(`Calendly ${avail.status}: check plan and token`);
    if (avail.status >= 500) throw new Error(`Calendly ${avail.status}`);
    const slot = (avail.body.collection ?? []).find((s: any) => s.status === "available");
    if (!slot) throw new Error("No free designer slot in the next 7 days");
    const payload: Record<string, unknown> = {
      event_type: eventType,
      start_time: slot.start_time,
      invitee: { name: invitee.name, email: invitee.email, timezone: "Asia/Kolkata" },
    };
    // Omit location for round-robin event types; otherwise it must match the event type.
    if (process.env.CALENDLY_LOCATION_JSON) payload.location = JSON.parse(process.env.CALENDLY_LOCATION_JSON);
    const res = await call("/invitees", { method: "POST", body: JSON.stringify(payload) });
    if (res.status === 400 || res.status === 404 || res.status === 409) continue; // slot just taken: re-query
    if (res.status === 401 || res.status === 403) throw new CalendlyConfigError(`Calendly ${res.status}: check plan and token`);
    if (res.status >= 300) throw new Error(`Calendly invitee ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
    const r = res.body.resource ?? {};
    // The assigned host is not in the response: read it from the scheduled event.
    let designer_name: string | null = null;
    let designer_email: string | null = null;
    if (r.event) {
      const ev = await call(r.event);
      const m = ev.body.resource?.event_memberships?.[0];
      designer_name = m?.user_name ?? null;
      designer_email = m?.user_email ?? null;
    }
    return { start_time: slot.start_time, designer_name, designer_email, event_uri: r.event ?? null, invitee_uri: r.uri ?? null, cancel_url: r.cancel_url ?? null, reschedule_url: r.reschedule_url ?? null, dry_run: false };
  }
  throw new Error("Slot taken 3 times in a row");
}

/** Free-plan booking: the public event link with the caller's name and email prefilled. */
export function schedulingLink(base: string, name: string | null, email: string): string {
  const u = new URL(base);
  if (name) u.searchParams.set("name", name);
  u.searchParams.set("email", email);
  return u.toString();
}
