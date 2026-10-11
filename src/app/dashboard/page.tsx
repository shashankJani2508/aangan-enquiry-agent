import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSettings, q } from "@/lib/db";
import { costRatesUnset } from "@/lib/settings";
import { costReport } from "@/lib/costs";
import { statusLine, type LeadRow } from "@/lib/status-line";
import { fmtIST } from "@/lib/time";
import { Header } from "@/components/header";
import { designers } from "@/lib/scheduler";
import { avatarFor, roleFor, slugOf } from "@/lib/designers-roster";

export const dynamic = "force-dynamic";

const LEAD_SELECT = `select l.*, (select o.outcome from outcomes o where o.lead_id=l.id order by submitted_at desc limit 1) outcome from leads l`;
const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);

// Two groups only: Qualified, and Unqualified (High / Medium / Low probability of conversion).
const PILL: Record<string, string> = { qualified: "Qualified", high: "Unqualified · High", medium: "Unqualified · Medium", low: "Unqualified · Low" };
const COLOR: Record<string, string> = { qualified: "#3fd0b0", unqualified: "#c9d6d2", high: "#e2b56a", medium: "#8fa7ff", low: "#f07178", booked: "#3fd0b0" };

// Every clickable thing on the page maps to one of these views of the lead list (fixed SQL only).
const VIEWS: Record<string, { label: string; where: string }> = {
  all: { label: "All leads", where: "true" },
  qualified: { label: "Qualified", where: "l.tier='qualified'" },
  qdirect: { label: "Qualified on the call", where: "l.tier='qualified' and l.converted_at is null" },
  highall: { label: "High probability (incl. converted)", where: "l.tier='high' or exists (select 1 from lead_events e where e.lead_id=l.id and e.type='frontdesk.converted' and e.detail->>'from_tier'='high')" },
  medall: { label: "Medium probability (incl. converted)", where: "l.tier='medium' or exists (select 1 from lead_events e where e.lead_id=l.id and e.type='frontdesk.converted' and e.detail->>'from_tier'='medium')" },
  unqall: { label: "Unqualified on the call (incl. later converted)", where: "l.tier in ('high','medium','low') or exists (select 1 from lead_events e where e.lead_id=l.id and e.type='frontdesk.converted')" },
  highconv: { label: "High probability → converted to Qualified", where: "exists (select 1 from lead_events e where e.lead_id=l.id and e.type='frontdesk.converted' and e.detail->>'from_tier'='high')" },
  medconv: { label: "Medium probability → converted to Qualified", where: "exists (select 1 from lead_events e where e.lead_id=l.id and e.type='frontdesk.converted' and e.detail->>'from_tier'='medium')" },
  unqualified: { label: "Unqualified", where: "l.tier in ('high','medium','low')" },
  high: { label: "Unqualified · High probability · not converted", where: "l.tier='high'" },
  medium: { label: "Unqualified · Medium probability · not converted", where: "l.tier='medium'" },
  low: { label: "Unqualified · Low probability", where: "l.tier='low'" },
  booked: { label: "Qualified · meeting booked", where: "l.tier='qualified' and l.booking_status='booked'" },
  notbooked: { label: "Qualified · not booked yet", where: "l.tier='qualified' and coalesce(l.booking_status,'none')<>'booked'" },
  review: { label: "Front desk to verify (system unsure)", where: "l.needs_review and l.tier<>'qualified'" },
  won: { label: "Projects won", where: "exists (select 1 from outcomes o where o.lead_id=l.id and o.outcome='won')" },
  today: { label: "Today", where: "l.created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')" },
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ m?: string; view?: string; q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const s = await getSettings();
  const nowIst = new Date(Date.now() + 330 * 60_000);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : nowIst.toISOString().slice(0, 7);
  const mStart = new Date(`${month}-01T00:00:00+05:30`);
  const mEnd = new Date(mStart);
  mEnd.setUTCMonth(mEnd.getUTCMonth() + 1);
  const win = [mStart.toISOString(), mEnd.toISOString()];
  const view = sp.view && VIEWS[sp.view] ? sp.view : "all";

  let since = new Date(`${nowIst.toISOString().slice(0, 10)}T${s.working_end}:00+05:30`);
  if (since > new Date()) since = new Date(since.getTime() - 86_400_000);
  for (let i = 0; i < 7 && !s.working_days.includes(new Date(since.getTime() + 330 * 60_000).getUTCDay() || 7); i++) since = new Date(since.getTime() - 86_400_000);

  const [overnight, counts, perDay, money, costs, list, conv] = await Promise.all([
    q<LeadRow>(`${LEAD_SELECT} where l.created_at >= $1 and l.state <> 'no_content' order by l.created_at desc limit 6`, [since.toISOString()]),
    q<Record<string, number>>(
      `select count(*) filter (where state<>'no_content')::int leads,
        count(*) filter (where tier='qualified')::int qualified, count(*) filter (where tier='high')::int high, count(*) filter (where tier='medium')::int medium,
        count(*) filter (where tier='low')::int low, count(*) filter (where needs_review and tier<>'qualified')::int review,
        count(*) filter (where tier='qualified' and booking_status='booked')::int booked,
        count(*) filter (where created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') and state<>'no_content')::int today
      from leads where created_at >= $1 and created_at < $2`, win),
    q<{ d: string; n: number }>(`select to_char(created_at at time zone 'Asia/Kolkata','DD') d, count(*)::int n from leads where created_at >= $1 and created_at < $2 and state<>'no_content' group by 1 order by 1`, win),
    q<Record<string, number>>(
      `select count(*) filter (where o.outcome='won')::int won, count(*) filter (where o.outcome='lost')::int lost,
        coalesce(sum(o.project_value_inr) filter (where o.outcome='won'),0)::bigint value_won
      from outcomes o join leads l on l.id=o.lead_id where l.created_at >= $1 and l.created_at < $2`, win),
    q<{ amt: number }>(`select coalesce(sum(amount_inr),0)::float amt from costs where created_at >= $1 and created_at < $2`, win),
    q<LeadRow>(
      `${LEAD_SELECT} where l.created_at >= $1 and l.created_at < $2 and l.state<>'no_content' and (${VIEWS[view].where})
        and ($3::text is null or l.caller_name ilike '%'||$3||'%' or l.caller_phone like '%'||$3||'%')
      order by l.created_at desc limit 200`, [...win, sp.q || null]),
    q<{ hconv: number; mconv: number }>(
      `select count(*) filter (where e.detail->>'from_tier'='high')::int hconv, count(*) filter (where e.detail->>'from_tier'='medium')::int mconv
       from lead_events e join leads l on l.id=e.lead_id where e.type='frontdesk.converted' and l.created_at >= $1 and l.created_at < $2`, win),
  ]);
  const c = counts[0] ?? {};
  const m = money[0] ?? {};
  const unq = (c.high ?? 0) + (c.medium ?? 0) + (c.low ?? 0);
  const qRate = c.leads ? Math.round(((c.qualified ?? 0) / c.leads) * 100) : 0;
  const daysInMonth = Math.round((mEnd.getTime() - mStart.getTime()) / 86_400_000);
  const fixed = Object.values(s.fixed_monthly_costs_inr).reduce<number>((a, v) => a + (v ?? 0), 0);
  const elapsed = Math.min(1, Math.max(0, (Date.now() - mStart.getTime()) / (mEnd.getTime() - mStart.getTime())));
  const cost = await costReport(win[0], win[1], s);
  void costs; void fixed; void elapsed;
  const dayMap = Object.fromEntries(perDay.map((p) => [Number(p.d), p.n]));
  const maxDay = Math.max(1, ...perDay.map((p) => p.n));
  const hour = nowIst.getUTCHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const monthLabel = mStart.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const href = (v: string) => `?${new URLSearchParams({ m: month, view: v }).toString()}#leads`;

  // Mind map (3 levels): enquiries -> Qualified on the call (-> meeting booked) and Unqualified on the
  // call -> High / Medium / Low; High and Medium -> converted to Qualified by the front desk / not.
  const hconv = conv[0]?.hconv ?? 0, mconv = conv[0]?.mconv ?? 0;
  const qDirect = Math.max(0, (c.qualified ?? 0) - hconv - mconv);
  const highAll = (c.high ?? 0) + hconv, medAll = (c.medium ?? 0) + mconv;
  const unqAll = highAll + medAll + (c.low ?? 0);
  type Pt = { x: number; y: number };
  type MapNode = { id: string; view: string; parent: string; at: Pt; w: number; h: number; title: string; sub: string; n: number; color: string; level: 1 | 2 | 3 };
  const HUB: Pt = { x: 80, y: 280 };
  const mapNodes: MapNode[] = [
    { id: "q", view: "qdirect", parent: "hub", at: { x: 250, y: 120 }, w: 250, h: 70, title: "Qualified", sub: "On the call: 8 lakh+ and a fit", n: qDirect, color: COLOR.qualified, level: 1 },
    { id: "u", view: "unqall", parent: "hub", at: { x: 250, y: 400 }, w: 250, h: 70, title: "Unqualified", sub: "Sorted by probability", n: unqAll, color: COLOR.unqualified, level: 1 },
    { id: "qb", view: "booked", parent: "q", at: { x: 590, y: 120 }, w: 230, h: 58, title: "Meeting booked", sub: "With a designer (all qualified)", n: c.booked ?? 0, color: COLOR.qualified, level: 2 },
    { id: "uh", view: "highall", parent: "u", at: { x: 590, y: 280 }, w: 230, h: 58, title: "High probability", sub: "5–8 lakh · front desk calls", n: highAll, color: COLOR.high, level: 2 },
    { id: "um", view: "medall", parent: "u", at: { x: 590, y: 410 }, w: 230, h: 58, title: "Medium probability", sub: "2–5 lakh or to verify", n: medAll, color: COLOR.medium, level: 2 },
    { id: "ul", view: "low", parent: "u", at: { x: 590, y: 530 }, w: 230, h: 58, title: "Low probability", sub: "≤2 lakh or not a fit", n: c.low ?? 0, color: COLOR.low, level: 2 },
    { id: "hc", view: "highconv", parent: "uh", at: { x: 880, y: 245 }, w: 220, h: 50, title: "Converted → Qualified", sub: "Front desk sent to a designer", n: hconv, color: COLOR.qualified, level: 3 },
    { id: "hn", view: "high", parent: "uh", at: { x: 880, y: 315 }, w: 220, h: 50, title: "Not converted", sub: "Still with the front desk", n: c.high ?? 0, color: COLOR.high, level: 3 },
    { id: "mc", view: "medconv", parent: "um", at: { x: 880, y: 375 }, w: 220, h: 50, title: "Converted → Qualified", sub: "Front desk sent to a designer", n: mconv, color: COLOR.qualified, level: 3 },
    { id: "mn", view: "medium", parent: "um", at: { x: 880, y: 445 }, w: 220, h: 50, title: "Not converted", sub: "Still with the front desk", n: c.medium ?? 0, color: COLOR.medium, level: 3 },
  ];
  const VBW = 1120, VBH = 600;
  const byId = Object.fromEntries(mapNodes.map((n) => [n.id, n]));
  const startOf = (id: string): Pt => (id === "hub" ? { x: HUB.x + 38, y: HUB.y } : { x: byId[id].at.x + byId[id].w, y: byId[id].at.y });
  const curve = (a: Pt, b: Pt) => `M${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`;
  const ds = designers();
  const upcoming = await q<{ designer_name: string; n: number; next: string | null }>(
    "select designer_name, count(*)::int n, min(start_time) next from bookings where status='booked' and start_time > now() group by 1",
  );
  const byDesigner = Object.fromEntries(upcoming.map((r) => [r.designer_name, r]));

  return (
    <>
      <Header />
      <h1>
        {greet}, <b>Nikhil</b>.
      </h1>
      <p className="sub">
        {overnight.length ? (
          <>
            <Link href={href("today")} className="link">{overnight.length} new {overnight.length === 1 ? "enquiry" : "enquiries"}</Link> since {fmtIST(since)}.
          </>
        ) : (
          `A quiet night: no new enquiries since ${fmtIST(since)}.`
        )}
      </p>

      <div className="stage big-stage" style={{ position: "relative" }}>
        <div className="grid-floor" aria-hidden="true" />
        <section className="card flow slab" aria-label="Where this month's enquiries went">
          <svg viewBox={`0 0 ${VBW} ${VBH}`} role="img">
            <defs>
              <radialGradient id="core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#c9fff1" />
                <stop offset="35%" stopColor="#3fd0b0" />
                <stop offset="100%" stopColor="#3fd0b0" stopOpacity="0" />
              </radialGradient>
              <filter id="soft"><feGaussianBlur stdDeviation="3" /></filter>
            </defs>
            <text x="26" y="36" fill="#86a29b" fontSize="13" letterSpacing="2.5">ENQUIRIES · {monthLabel.toUpperCase()} · TAP ANY NODE</text>
            {mapNodes.map((nd) => (
              <path key={`e-${nd.id}`} d={curve(startOf(nd.parent), nd.at)} fill="none" stroke={nd.color} strokeOpacity={nd.n ? 0.85 : 0.2} strokeWidth={nd.n ? 1.8 + Math.min(5, nd.n / 2) : 1.2} />
            ))}
            {mapNodes.map((nd, i) =>
              nd.n ? (
                <circle key={`p-${nd.id}`} className="pulse" r="3" fill={nd.color}>
                  <animateMotion dur={`${2.2 + (i % 4) * 0.5}s`} repeatCount="indefinite" path={curve(startOf(nd.parent), nd.at)} />
                </circle>
              ) : null,
            )}
            <g>
              <circle cx={HUB.x} cy={HUB.y} r="56" fill="url(#core)" opacity=".55" filter="url(#soft)" />
              <circle cx={HUB.x} cy={HUB.y} r="38" fill="#0b2621" stroke="#3fd0b0" strokeOpacity=".6" />
              <circle cx={HUB.x} cy={HUB.y} r="38" fill="none" stroke="#3fd0b0" strokeOpacity=".5" className="pulse">
                <animate attributeName="r" values="38;64" dur="2.6s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values=".5;0" dur="2.6s" repeatCount="indefinite" />
              </circle>
              <text x={HUB.x} y={HUB.y + 10} textAnchor="middle" fill="#e8f1ee" fontSize="30" fontWeight="500">{c.leads ?? 0}</text>
              <text x={HUB.x} y={HUB.y + 64} textAnchor="middle" fill="#86a29b" fontSize="13">all enquiries</text>
            </g>
            {mapNodes.map((nd) => {
              const on = view === nd.view;
              const fs = nd.level === 1 ? 19 : nd.level === 2 ? 16 : 14;
              return (
                <g key={nd.id}>
                  <circle cx={nd.at.x} cy={nd.at.y} r={nd.level === 3 ? 5 : 6} fill={nd.color} />
                  <rect x={nd.at.x + 12} y={nd.at.y - nd.h / 2} width={nd.w - 12} height={nd.h} rx="13" fill={on ? "rgba(63,208,176,.18)" : "rgba(18,40,36,.88)"} stroke={nd.color} strokeOpacity={on ? 1 : 0.45} strokeWidth={on ? 2.2 : 1.2} />
                  <text x={nd.at.x + 28} y={nd.at.y - (nd.level === 3 ? 2 : 4)} fill="#e8f1ee" fontSize={fs} fontWeight="600">{nd.title}</text>
                  <text x={nd.at.x + 28} y={nd.at.y + (nd.level === 1 ? 20 : nd.level === 2 ? 17 : 15)} fill="#86a29b" fontSize={nd.level === 3 ? 11.5 : 12.5}>{nd.sub}</text>
                  <text x={nd.at.x + nd.w - 14} y={nd.at.y + 10} textAnchor="end" fill={nd.color} fontSize={nd.level === 1 ? 32 : nd.level === 2 ? 26 : 22} fontWeight="500">{nd.n}</text>
                </g>
              );
            })}
          </svg>
          {[{ v: "all", x: HUB.x - 48, y: HUB.y - 48, w: 96, h: 124 }, ...mapNodes.map((nd) => ({ v: nd.view, x: nd.at.x + 12, y: nd.at.y - nd.h / 2, w: nd.w - 12, h: nd.h }))].map((bx, i) => (
            <Link key={`hit-${i}`} href={href(bx.v)} className="hit" aria-label={VIEWS[bx.v].label}
              style={{ left: `${(bx.x / VBW) * 100}%`, top: `${(bx.y / VBH) * 100}%`, width: `${(bx.w / VBW) * 100}%`, height: `${(bx.h / VBH) * 100}%` }} />
          ))}
        </section>
      </div>

      <div className="cc">
        <section className="card">
          <div className="chipline">
            <span className="live">● Live</span>
            <Link href={href("all")}>{monthLabel}</Link>
            <Link href={href("today")}>{c.today ?? 0} today →</Link>
          </div>
          <Link href={href("qualified")} style={{ display: "block" }}>
            <div style={{ fontSize: 13, color: "var(--mute)" }}>Qualification rate</div>
            <div className="big">
              {qRate}%<small>{c.qualified ?? 0} of {c.leads ?? 0} qualified →</small>
            </div>
          </Link>
          <div className="spark" style={{ marginTop: 14 }} role="img" aria-label="Enquiries per day">
            {Array.from({ length: daysInMonth }, (_, i) => {
              const n = dayMap[i + 1] ?? 0;
              return <i key={i} className={n ? "" : "z"} title={`${i + 1}: ${n}`} style={{ height: `${Math.max(4, (n / maxDay) * 100)}%` }} />;
            })}
          </div>
          <div className="axis"><span>1</span><span>enquiries per day</span><span>{daysInMonth}</span></div>
          <div className="mini">
            <Link href={href("won")}><b style={{ color: "var(--gold)" }}>{inr(m.value_won)}</b><span>Project value won →</span></Link>
            <Link href={href("booked")}><b>{c.booked ?? 0}</b><span>Meetings booked →</span></Link>
            <Link href={href("review")} title="Unqualified leads the system was unsure about (no budget or detail, unclear location or scope, a misheard number). The front desk checks them by phone.">
              <b>{c.review ?? 0}</b><span>Front desk to verify →</span>
            </Link>
            <Link href={`/dashboard/costs?m=${month}`}>
              <b>{cost.perQualified == null ? "—" : `₹${cost.perQualified.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}</b>
              <span>Cost per qualified lead →</span>
            </Link>
          </div>
          <form style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <input type="month" name="m" defaultValue={month} aria-label="Month" style={{ flex: 1 }} />
            <button>Go</button>
          </form>
          {costRatesUnset(s) ? <p className="mute" style={{ fontSize: 11.5, margin: "10px 0 0" }}>Cost may be understated: vendor rates not set yet.</p> : null}
        </section>
      </div>

      <h2 id="leads">Leads</h2>
      <div className="tree-filters">
        <Link className={`chip ${view === "all" ? "on" : ""}`} href={href("all")}>All <b>{c.leads ?? 0}</b></Link>
        <Link className={`chip ${view === "qualified" || view === "booked" ? "on" : ""}`} href={href("qualified")}>Qualified <b>{c.qualified ?? 0}</b></Link>
        <div className="branch">
          <Link className={`chip ${["unqualified", "high", "medium", "low"].includes(view) ? "on" : ""}`} href={href("unqualified")}>Unqualified <b>{unq}</b></Link>
          <div className="sub-chips">
            {(["high", "medium", "low"] as const).map((t) => (
              <Link key={t} className={`chip sm ${view === t ? "on" : ""}`} href={href(t)}>
                <span className={`dot bg-${t}`} />
                {t[0].toUpperCase() + t.slice(1)} probability <b>{c[t] ?? 0}</b>
              </Link>
            ))}
          </div>
        </div>
        <form style={{ marginLeft: "auto" }}>
          <input type="hidden" name="m" value={month} />
          <input type="hidden" name="view" value={view} />
          <input name="q" placeholder="Search name or phone" defaultValue={sp.q ?? ""} />
        </form>
      </div>
      <section className="card">
        <div className="mute" style={{ fontSize: 12.5, marginBottom: 6 }}>
          Showing: <b style={{ color: "var(--ink)" }}>{VIEWS[view].label}</b> · {list.length} {list.length === 1 ? "lead" : "leads"} · {monthLabel}
          {view !== "all" ? <> · <Link className="link" href={href("all")}>clear</Link></> : null}
        </div>
        {list.length ? list.map((l) => <LeadItem key={l.id} l={l} />) : <div className="empty">No leads here yet.</div>}
      </section>

      <h2>Designers · {ds.length} in-house</h2>
      <div className="designers">
        {ds.map((d) => {
          const r = byDesigner[d.name];
          const img = avatarFor(d.name);
          return (
            <Link key={d.name} href={`/dashboard/designers/${slugOf(d.name)}`} className="card dcard">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" width={44} height={44} />
              ) : (
                <span className="av">{d.name.charAt(0)}</span>
              )}
              <span style={{ minWidth: 0 }}>
                <b>{d.name}</b>
                <small>{roleFor(d.name)}</small>
                <em style={{ color: r ? "var(--gold)" : "var(--teal)" }}>{r ? `${r.n} upcoming · next ${fmtIST(r.next)}` : "All slots free"}</em>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function LeadItem({ l }: { l: LeadRow }) {
  const initial = (l.caller_name ?? "?").trim().charAt(0).toUpperCase();
  const tier = l.tier ?? "none";
  return (
    <Link href={`/dashboard/leads/${l.id}`} className="lead">
      <span className="av">{initial}</span>
      <span style={{ minWidth: 0 }}>
        <span className="n">{l.caller_name ?? "Name not stated"}</span>
        <span className="s">{statusLine(l)}</span>
      </span>
      <span className="r">
        <span className={`pill t-${tier}`}>{tier === "none" ? "Sorting…" : PILL[tier]}</span>
        <span>{fmtIST(l.created_at)}</span>
      </span>
    </Link>
  );
}
