import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { NOT_STATED } from "@/lib/lead-schema";
import { fmtIST } from "@/lib/time";
import { Header } from "@/components/header";
import { avatarFor, roleFor, slugOf } from "@/lib/designers-roster";

export const dynamic = "force-dynamic";

// The founder's view of one lead: the verdict, the facts that matter, who meets them and when,
// and the brief. No transcript, no raw fields (owner decision 11 Oct 2026).
const TIER: Record<string, { label: string; tone: string }> = {
  qualified: { label: "Qualified", tone: "qualified" },
  high: { label: "Unqualified · High probability", tone: "high" },
  medium: { label: "Unqualified · Medium probability", tone: "medium" },
  low: { label: "Unqualified · Low probability", tone: "low" },
};
const lakh = (n: number | string | null | undefined) => (n == null ? null : `₹${(Number(n) / 100_000).toFixed(1).replace(/\.0$/, "")} lakh`);
const nice = (v: unknown) => (v == null || v === "" || v === "unknown" ? NOT_STATED : String(v).replace(/_/g, " "));

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [lead] = await q<Record<string, any>>("select * from leads where id=$1", [id]);
  if (!lead) notFound();
  const [bookings, outcomes] = await Promise.all([
    q<Record<string, any>>("select * from bookings where lead_id=$1 order by created_at desc limit 1", [id]),
    q<Record<string, any>>("select * from outcomes where lead_id=$1 order by submitted_at desc limit 1", [id]),
  ]);
  const booking = bookings[0];
  const f = (lead.fields ?? {}) as Record<string, any>;
  const brief = lead.brief ?? {};
  const crit = (lead.criteria ?? {}) as Record<string, { result: string }>;
  const t = TIER[lead.tier] ?? { label: lead.state === "no_content" ? "Empty call" : "Sorting…", tone: "none" };
  const value = lakh(lead.value_inr);
  const facts: [string, string][] = [
    ["Property", [f.configuration, nice(f.property_type) !== NOT_STATED ? nice(f.property_type) : null].filter(Boolean).join(" · ") || NOT_STATED],
    ["Size", f.area_sqft ? `${f.area_sqft} sq ft${f.area_basis === "carpet" ? " carpet" : ""}` : NOT_STATED],
    ["Location", [f.locality_or_project, f.city].filter(Boolean).join(", ") || NOT_STATED],
    ["Scope", nice(f.scope_summary)],
    ["Timeline", nice(f.timeline)],
    ["Budget", lead.stated_budget_max_inr ? `${lakh(lead.stated_budget_min_inr) ?? ""}${lead.stated_budget_min_inr ? " – " : ""}${lakh(lead.stated_budget_max_inr)}` : NOT_STATED],
    ["Decision-maker", nice(f.decision_maker)],
    ["Heard about us", nice(f.referrer ? `Referral: ${f.referrer}` : f.heard_about_us)],
  ];
  const checks = (
    [
      ["Real project", crit.real_project?.result],
      ["Service area", crit.service_area?.result],
      ["Timeline", crit.timeline?.result],
      ["Budget", crit.budget?.result],
      ["Decision-maker", crit.decision_maker?.result],
    ] as [string, string | undefined][]
  ).filter(([, r]) => r) as [string, string][];
  const outcome = outcomes[0];
  const img = booking ? avatarFor(booking.designer_name) : null;

  return (
    <>
      <Header back />
      <section className="card verdict" style={{ marginTop: 14 }}>
        <div className="verdict-top">
          <span className="av lg">{(lead.caller_name ?? "?").charAt(0)}</span>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0 }}>{lead.caller_name ?? "Name not stated"}</h1>
            <div className="mute" style={{ fontSize: 13 }}>Called {fmtIST(lead.created_at)}</div>
          </div>
          <span className={`pill big-pill t-${t.tone}`}>{t.label}</span>
        </div>
        <p className="why">{lead.reason ?? ""}</p>
        <div className="verdict-stats">
          <div><b>{value ?? "Unknown"}</b><span>{lead.value_source === "stated" ? "Budget the caller stated" : lead.value_source === "estimated" ? "Internal estimate (never shared)" : "Value"}</span></div>
          {lead.not_a_fit_reason ? <div><b style={{ color: "var(--l)" }}>Not a fit</b><span>{lead.not_a_fit_reason}</span></div> : null}
          {lead.needs_review ? <div><b style={{ color: "var(--m)" }}>Needs review</b><span>Front desk to confirm details</span></div> : null}
          {lead.converted_at ? <div><b style={{ color: "var(--q)" }}>Converted</b><span>by the front desk</span></div> : null}
        </div>
        <div className="actions">
          {lead.caller_phone ? <a className="btn" href={`tel:${lead.caller_phone}`}>📞 Call {lead.caller_name?.split(" ")[0] ?? "caller"}</a> : <span className="btn ghost">No phone captured</span>}
          {lead.caller_email ? <a className="btn ghost" href={`mailto:${lead.caller_email}`}>✉ Email</a> : null}
        </div>
      </section>

      <div className="two" style={{ marginTop: 14 }}>
        <section className="card">
          <h2 style={{ marginTop: 2 }}>The brief</h2>
          <div className="brief">
            {(brief.summary ?? []).map((l: string, i: number) => <p key={i}>{l}</p>)}
            {lead.ai_status === "unavailable" ? <p className="warn">AI brief unavailable. The front desk should call back.</p> : null}
          </div>
          {brief.open_questions?.length ? (
            <>
              <h2>Still to find out</h2>
              <ul className="ticks">{brief.open_questions.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            </>
          ) : null}
          {brief.caller_asked?.length ? (
            <>
              <h2>The caller asked</h2>
              <ul className="ticks">{brief.caller_asked.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            </>
          ) : null}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 2 }}>Meeting</h2>
          {booking && booking.status === "booked" ? (
            <Link href={`/dashboard/designers/${slugOf(booking.designer_name)}`} className="meet">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" width={56} height={56} />
              ) : null}
              <span>
                <b>{booking.designer_name}</b>
                <small>{roleFor(booking.designer_name)}</small>
                <em>{fmtIST(booking.start_time)} IST</em>
              </span>
            </Link>
          ) : (
            <p className="mute">
              {lead.tier === "qualified"
                ? lead.booking_status === "booking_failed"
                  ? `Not booked: ${nice(lead.booking_fail_reason)}. The brief was emailed to the team.`
                  : "Booking in progress."
                : lead.tier === "high" || lead.tier === "medium"
                  ? "No designer meeting yet. The front desk calls this lead first."
                  : "No meeting: this lead is recorded only."}
            </p>
          )}
          {outcome ? (
            <div className="outcome">
              <b>{nice(outcome.outcome)}</b>
              {outcome.project_value_inr ? <span> · {lakh(outcome.project_value_inr)}</span> : null}
              {outcome.reason ? <span> · {outcome.reason}</span> : null}
            </div>
          ) : null}
          <h2>Fit check</h2>
          <div className="checks">
            {checks.map(([k, r]) => (
              <span key={k} className={`check ${r}`}>{r === "pass" ? "✓" : r === "fail" ? "✕" : "?"} {k}</span>
            ))}
          </div>
        </section>
      </div>

      <h2>Key facts</h2>
      <div className="facts">
        {facts.map(([k, v]) => (
          <div key={k} className="card fact">
            <span>{k}</span>
            <b className={v === NOT_STATED ? "mute" : ""}>{v}</b>
          </div>
        ))}
      </div>
    </>
  );
}
