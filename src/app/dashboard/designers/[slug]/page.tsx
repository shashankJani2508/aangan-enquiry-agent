import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtIST } from "@/lib/time";
import { Header } from "@/components/header";
import { designers } from "@/lib/scheduler";
import { avatarFor, roleFor, slugOf } from "@/lib/designers-roster";

export const dynamic = "force-dynamic";

export default async function DesignerPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const { slug } = await params;
  const d = designers().find((x) => slugOf(x.name) === slug);
  if (!d) notFound();
  const [upcoming, past, won] = await Promise.all([
    q<Record<string, any>>(
      "select b.start_time, l.id, l.caller_name, l.fields, l.value_inr from bookings b join leads l on l.id=b.lead_id where b.designer_name=$1 and b.status='booked' and b.start_time > now() order by b.start_time",
      [d.name],
    ),
    q<{ n: number }>("select count(*)::int n from bookings where designer_name=$1 and status='booked' and start_time <= now()", [d.name]),
    q<{ n: number; v: number }>(
      "select count(*)::int n, coalesce(sum(o.project_value_inr),0)::float v from outcomes o join bookings b on b.lead_id=o.lead_id where b.designer_name=$1 and o.outcome='won'",
      [d.name],
    ),
  ]);
  const img = avatarFor(d.name);
  return (
    <>
      <Header back />
      <section className="card verdict" style={{ marginTop: 14 }}>
        <div className="verdict-top">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" width={72} height={72} style={{ borderRadius: "50%", boxShadow: "0 0 0 2px rgba(63,208,176,.4), 0 0 24px rgba(63,208,176,.3)" }} />
          ) : null}
          <div>
            <h1 style={{ margin: 0 }}>{d.name}</h1>
            <div className="mute">{roleFor(d.name)}</div>
          </div>
        </div>
        <div className="verdict-stats">
          <div><b>{upcoming.length}</b><span>Upcoming meetings</span></div>
          <div><b>{past[0]?.n ?? 0}</b><span>Meetings held</span></div>
          <div><b style={{ color: "var(--gold)" }}>{won[0]?.n ?? 0}</b><span>Projects won</span></div>
          <div><b>{upcoming[0] ? fmtIST(upcoming[0].start_time) : "Free"}</b><span>Next slot taken</span></div>
        </div>
      </section>
      <h2>Upcoming meetings</h2>
      <section className="card">
        {upcoming.length ? (
          upcoming.map((u) => (
            <Link key={u.id} href={`/dashboard/leads/${u.id}`} className="lead">
              <span className="av">{(u.caller_name ?? "?").charAt(0)}</span>
              <span style={{ minWidth: 0 }}>
                <span className="n">{u.caller_name ?? "Name not stated"}</span>
                <span className="s">
                  {[u.fields?.configuration, u.fields?.area_sqft ? `${u.fields.area_sqft} sq ft` : null, u.fields?.locality_or_project].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="r"><span className="pill t-qualified">{fmtIST(u.start_time)}</span></span>
            </Link>
          ))
        ) : (
          <div className="empty">All slots free.</div>
        )}
      </section>
    </>
  );
}
