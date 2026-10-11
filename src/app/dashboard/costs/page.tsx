import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { costReport } from "@/lib/costs";
import { Header } from "@/components/header";

export const dynamic = "force-dynamic";

const inr = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

export default async function Costs({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const s = await getSettings();
  const nowIst = new Date(Date.now() + 330 * 60_000);
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : nowIst.toISOString().slice(0, 7);
  const from = new Date(`${month}-01T00:00:00+05:30`);
  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);
  const r = await costReport(from.toISOString(), to.toISOString(), s);
  const monthLabel = from.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const max = Math.max(0.0001, ...r.lines.map((l) => l.inr));

  return (
    <>
      <Header back />
      <h1>Cost to run · <b>{monthLabel}</b></h1>
      <p className="sub">Calculated from actual usage this month: every call minute, every AI decision, every email.</p>

      <div className="verdict-stats" style={{ marginBottom: 14 }}>
        <div className="card"><b style={{ color: "var(--gold)", fontSize: 26 }}>{inr(r.perQualified)}</b><span>Cost per qualified lead ({r.qualified} qualified)</span></div>
        <div className="card"><b style={{ fontSize: 26 }}>{inr(r.perLead)}</b><span>Cost per lead ({r.leads} leads)</span></div>
        <div className="card"><b style={{ fontSize: 26 }}>{inr(r.total)}</b><span>Total cost, month to date</span></div>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 2 }}>Breakdown</h2>
        {r.lines.map((l) => (
          <div key={l.key} className="costrow">
            <div className="costhead">
              <b>{l.vendor}</b>
              <span className="mute">{l.usage}</span>
              <strong>{inr(l.inr)}</strong>
            </div>
            <div className="costbar"><i style={{ width: `${(l.inr / max) * 100}%` }} /></div>
            <div className="mute" style={{ fontSize: 12 }}>
              Rate: {l.rate} · Per qualified lead: {r.qualified ? inr(l.inr / r.qualified) : "—"}
            </div>
            <div className="mute" style={{ fontSize: 11.5, opacity: 0.8 }}>Source: {l.source}</div>
          </div>
        ))}
      </section>
      <p className="mute" style={{ fontSize: 12, marginTop: 12 }}>
        HubSpot is an existing tool and is not counted. Includes the test calls made while setting the system up.
      </p>
    </>
  );
}
