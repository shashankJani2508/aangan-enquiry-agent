import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { convertLead, handleVaaniEvent, processLead } from "@/lib/process-lead";
import { toEnvelope } from "@/lib/vaani";
import * as hubspot from "@/lib/hubspot";

export const runtime = "nodejs";
export const maxDuration = 300;

// Scheduled sweeper (brief 5.10): retry stuck events and steps, poll HubSpot for front-desk
// conversions, and read front-desk status back into Neon. Vercel Cron sends
// "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const report: Record<string, unknown> = {};

  // 1. Events that were received but never processed (e.g. the function was killed).
  const stuck = await q<{ event_id: string; payload: string }>(
    "select event_id, payload::text from webhook_events where status in ('received','error') and received_at < now() - interval '3 minutes' order by received_at limit 20");
  for (const e of stuck) {
    try {
      const raw = JSON.parse(e.payload);
      await handleVaaniEvent(toEnvelope(typeof raw === "string" ? JSON.parse(raw) : raw, null, null, e.event_id));
      await q("update webhook_events set status='processed', processed_at=now() where event_id=$1", [e.event_id]);
    } catch (err) {
      await q("update webhook_events set status='error', error=$2 where event_id=$1", [e.event_id, String(err).slice(0, 1000)]);
    }
  }
  report.events_retried = stuck.length;

  // 2. Leads with failed or stale steps.
  const leads = await q<{ id: string }>("select distinct lead_id id from action_steps where status='failed' and attempts < 5 or (status='running' and locked_at < now() - interval '5 minutes') limit 20");
  for (const l of leads) await processLead(l.id).catch(() => {});
  report.leads_retried = leads.length;

  // 3. HubSpot: conversions ("send to designer" ticked) and status read-back.
  try {
    const conv = await hubspot.findConversions();
    for (const c of conv) {
      const lead = c.leadId
        ? (await q<{ id: string }>("select id from leads where id=$1", [c.leadId]))[0]
        : (await q<{ id: string }>("select id from leads where hubspot_contact_id=$1 order by created_at desc limit 1", [c.id]))[0];
      if (lead) await convertLead(lead.id, c.budgetNow);
    }
    report.conversions = conv.length;
    const open = await q<{ id: string; hubspot_contact_id: string }>("select id, hubspot_contact_id from leads where hubspot_contact_id is not null and hubspot_contact_id <> 'dry-run' and created_at > now() - interval '90 days' limit 100");
    const statuses = await hubspot.readStatuses(open.map((o) => o.hubspot_contact_id));
    for (const o of open) {
      if (o.hubspot_contact_id in statuses) await q("update leads set frontdesk_status=$2, frontdesk_status_at=now() where id=$1 and frontdesk_status is distinct from $2", [o.id, statuses[o.hubspot_contact_id]]);
    }
    report.statuses_read = Object.keys(statuses).length;
  } catch (e) {
    report.hubspot_error = String(e).slice(0, 300);
  }
  return NextResponse.json(report);
}
