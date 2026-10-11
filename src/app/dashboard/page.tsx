import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSettings, q } from "@/lib/db";
import { costRatesUnset } from "@/lib/settings";
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
  unqualified: { label: "Unqualified", where: "l.tier in ('high','medium','low')" },
  high: { label: "Unqualified · High probability", where: "l.tier='high'" },
  medium: { label: "Unqualified · Medium probability", where: "l.tier='medium'" },
  low: { label: "Unqualified · Low probability", where: "l.tier='low'" },
  booked: { label: "Qualified · meeting booked", where: "l.tier='qualified' and l.booking_status='booked'" },
  notbooked: { label: "Qualified · not booked yet", where: "l.tier='qualified' and coalesce(l.booking_status,'none')<>'booked'" },
  review: { label: "Needs review", where: "l.needs_review and l.tier<>'qualified'" },
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

  const [overnight, counts, perDay, money, costs, list] = await Promise.all([
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
  ]);
  const c = counts[0] ?? {};
  const m = money[0] ?? {};
  const unq = (c.high ?? 0) + (c.medium ?? 0) + (c.low ?? 0);
  const qRate = c.leads ? Math.round(((c.qualified ?? 0) / c.leads) * 100) : 0;
  const daysInMonth = Math.round((mEnd.getTime() - mStart.getTime()) / 86_400_000);
  const fixed = Object.values(s.fixed_monthly_costs_inr).reduce<number>((a, v) => a + (v ?? 0), 0);
  const elapsed = Math.min(1, Math.max(0, (Date.now() - mStart.getTime()) / (mEnd.getTime() - mStart.getTime())));
  const totalCost = (costs[0]?.amt ?? 0) + fixed * elapsed;
  const dayMap = Object.fromEntries(perDay.map((p) => [Number(p.d), p.n]));
  const maxDay = Math.max(1, ...perDay.map((p) => p.n));
  const hour = nowIst.getUTCHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const monthLabel = mStart.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const href = (v: string) => `?${new URLSearchParams({ m: month, view: v }).toString()}#leads`;

  // Mind map: hub -> Qualified (-> booked) and Unqualified -> High / Medium / Low.
  const HUB = { x: 70, y: 200 };
  const Q = { x: 250, y: 85 }, U = { x: 250, y: 300 };
  const QB = { x: 500, y: 85 };
  const UH = { x: 500, y: 225 }, UM = { x: 500, y: 300 }, UL = { x: 500, y: 375 };
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`;
  const edges: [string, { x: number; y: number }, { x: number; y: number }, number][] = [
    ["qualified", { x: HUB.x + 32, y: HUB.y }, Q, c.qualified ?? 0],
    ["unqualified", { x: HUB.x + 32, y: HUB.y }, U, unq],
    ["booked", { x: Q.x + 190, y: Q.y }, QB, c.booked ?? 0],
    ["high", { x: U.x + 190, y: U.y }, UH, c.high ?? 0],
    ["medium", { x: U.x + 190, y: U.y }, UM, c.medium ?? 0],
    ["low", { x: U.x + 190, y: U.y }, UL, c.low ?? 0],
  ];
  const nodes: { v: string; at: { x: number; y: number }; title: string; sub: string; n: number; big?: boolean }[] = [
    { v: "qualified", at: Q, title: "Qualified", sub: "8 lakh+ and passes fit", n: c.qualified ?? 0, big: true },
    { v: "unqualified", at: U, title: "Unqualified", sub: "Sorted by probability", n: unq, big: true },
    { v: "booked", at: QB, title: "Meeting booked", sub: "With a designer", n: c.booked ?? 0 },
    { v: "high", at: UH, title: "High probability", sub: "5–8 lakh · call task", n: c.high ?? 0 },
    { v: "medium", at: UM, title: "Medium probability", sub: "2–5 lakh / needs review", n: c.medium ?? 0 },
    { v: "low", at: UL, title: "Low probability", sub: "≤2 lakh or not a fit", n: c.low ?? 0 },
  ];
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

      <div className="cc">
        <div className="stage" style={{ position: "relative" }}>
          <div className="grid-floor" aria-hidden="true" />
          <section className="card flow slab" aria-label="Where this month's enquiries went">
            <svg viewBox="0 0 720 430" role="img">
              <defs>
                <radialGradient id="core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#c9fff1" />
                  <stop offset="35%" stopColor="#3fd0b0" />
                  <stop offset="100%" stopColor="#3fd0b0" stopOpacity="0" />
                </radialGradient>
                <filter id="soft"><feGaussianBlur stdDeviation="3" /></filter>
              </defs>
              <text x="22" y="30" fill="#86a29b" fontSize="11" letterSpacing="2">ENQUIRIES · {monthLabel.toUpperCase()} · TAP ANY NODE</text>
              {edges.map(([k, a, b, n]) => (
                <path key={k} d={curve(a, b)} fill="none" stroke={COLOR[k]} strokeOpacity={n ? 0.85 : 0.22} strokeWidth={n ? 1.6 + Math.min(4, n / 2) : 1} />
              ))}
              {edges.map(([k, a, b, n], i) =>
                n ? (
                  <circle key={`p-${k}`} className="pulse" r="2.6" fill={COLOR[k]}>
                    <animateMotion dur={`${2.2 + i * 0.4}s`} repeatCount="indefinite" path={curve(a, b)} />
                  </circle>
                ) : null,
              )}
              <g>
                <circle cx={HUB.x} cy={HUB.y} r="46" fill="url(#core)" opacity=".55" filter="url(#soft)" />
                <circle cx={HUB.x} cy={HUB.y} r="32" fill="#0b2621" stroke="#3fd0b0" strokeOpacity=".6" />
                <circle cx={HUB.x} cy={HUB.y} r="32" fill="none" stroke="#3fd0b0" strokeOpacity=".5" className="pulse">
                  <animate attributeName="r" values="32;54" dur="2.6s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values=".5;0" dur="2.6s" repeatCount="indefinite" />
                </circle>
                <text x={HUB.x} y={HUB.y + 8} textAnchor="middle" fill="#e8f1ee" fontSize="24" fontWeight="500">{c.leads ?? 0}</text>
                <text x={HUB.x} y={HUB.y + 54} textAnchor="middle" fill="#86a29b" fontSize="11">all enquiries</text>
              </g>
              {nodes.map((nd) => {
                const w = 190, h = nd.big ? 58 : 50;
                const col = COLOR[nd.v];
                const on = view === nd.v;
                return (
                  <g key={nd.v}>
                    <circle cx={nd.at.x} cy={nd.at.y} r="5" fill={col} />
                    <rect x={nd.at.x + 12} y={nd.at.y - h / 2} width={w - 12} height={h} rx="11" fill={on ? "rgba(63,208,176,.18)" : "rgba(18,40,36,.85)"} stroke={col} strokeOpacity={on ? 1 : 0.4} strokeWidth={on ? 2 : 1} />
                    <text x={nd.at.x + 26} y={nd.at.y - (nd.big ? 3 : 2)} fill="#e8f1ee" fontSize={nd.big ? 15 : 12.5} fontWeight="600">{nd.title}</text>
                    <text x={nd.at.x + 26} y={nd.at.y + (nd.big ? 15 : 14)} fill="#86a29b" fontSize="10.5">{nd.sub}</text>
                    <text x={nd.at.x + w - 12} y={nd.at.y + 8} textAnchor="end" fill={col} fontSize={nd.big ? 24 : 20} fontWeight="500">{nd.n}</text>
                  </g>
                );
              })}
            </svg>
            {[{ v: "all", x: HUB.x - 40, y: HUB.y - 40, w: 80, h: 105 }, ...nodes.map((nd) => ({ v: nd.v, x: nd.at.x + 12, y: nd.at.y - (nd.big ? 29 : 25), w: 178, h: nd.big ? 58 : 50 }))].map((b) => (
              <Link key={`hit-${b.v}`} href={href(b.v)} className="hit" aria-label={VIEWS[b.v].label}
                style={{ left: `${(b.x / 720) * 100}%`, top: `${(b.y / 430) * 100}%`, width: `${(b.w / 720) * 100}%`, height: `${(b.h / 430) * 100}%` }} />
            ))}
          </section>
        </div>

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
            <Link href={href("review")}><b>{c.review ?? 0}</b><span>Need review →</span></Link>
            <div><b>{c.qualified ? inr(totalCost / c.qualified) : "—"}</b><span>Cost per qualified lead</span></div>
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
