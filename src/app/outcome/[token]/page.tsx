import { getSettings, logEvent, q } from "@/lib/db";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

// Designer outcome page (brief 13.2): signed per-lead link, no login.
const leadFromToken = (t: string) => {
  const p = verifyToken(decodeURIComponent(t));
  return p?.startsWith("o:") ? p.slice(2) : null;
};

async function submit(form: FormData) {
  "use server";
  const leadId = leadFromToken(String(form.get("t")));
  if (!leadId) return;
  const recent = await q<{ n: number }>("select count(*)::int n from outcomes where lead_id=$1 and submitted_at > now() - interval '1 hour'", [leadId]);
  if (recent[0].n >= 10) return; // rate limit
  const outcome = String(form.get("outcome"));
  const reason = String(form.get("reason") || "") || null;
  if ((outcome === "lost" || outcome === "cancelled") && !reason) return;
  const value = form.get("value") ? Math.round(Number(form.get("value"))) : null;
  await q("insert into outcomes (lead_id, outcome, reason, project_value_inr, notes) values ($1,$2,$3,$4,$5)", [leadId, outcome, reason, outcome === "won" ? value : null, String(form.get("notes") || "") || null]);
  await logEvent(leadId, "designer", "outcome", { outcome, reason });
}

export default async function Outcome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const leadId = leadFromToken(token);
  if (!leadId) return <div className="card">This link is invalid or has expired.</div>;
  const [lead] = await q<{ caller_name: string | null }>("select caller_name from leads where id=$1", [leadId]);
  const last = await q<{ outcome: string }>("select outcome from outcomes where lead_id=$1 order by submitted_at desc limit 1", [leadId]);
  const s = await getSettings();
  return (
    <div className="card" style={{ maxWidth: 480, margin: "20px auto" }}>
      <h1>Outcome: {lead?.caller_name ?? "lead"}</h1>
      {last[0] ? <p className="mute">Last recorded: {last[0].outcome}</p> : null}
      <form action={submit} style={{ display: "grid", gap: 8 }}>
        <input type="hidden" name="t" value={token} />
        <select name="outcome" required>
          <option value="met">Meeting held</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
        <input name="value" type="number" min="0" placeholder="Project value if won (₹)" />
        <select name="reason" defaultValue="">
          <option value="">Reason (required if lost or cancelled)</option>
          {s.outcome_reasons.map((r) => <option key={r}>{r}</option>)}
        </select>
        <textarea name="notes" placeholder="Notes" rows={3} />
        <button>Save outcome</button>
      </form>
    </div>
  );
}
