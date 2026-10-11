import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { looksLikeVaani, MAX_WEBHOOK_BYTES, stripRecording, toEnvelope, verifySignature, verifyUrlKey, type Envelope } from "@/lib/vaani";
import { q } from "@/lib/db";
import { handleVaaniEvent } from "@/lib/process-lead";

export const runtime = "nodejs";
export const maxDuration = 300;

// Vaani posts signed events here (brief section 9). Verify the raw body, de-duplicate by the
// envelope id, answer 2xx fast, then do the work with after(). Bad-but-signed payloads get 200
// (logged) so Vaani does not auto-disable the webhook after 5 failures.
export async function POST(req: Request) {
  const original = await req.text();
  if (original.length > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "too large" }, { status: 413 });
  // Accept either the documented HMAC signature or the secret key in the webhook URL (?k=...).
  const sigOk =
    verifySignature(original, req.headers.get("x-vaanivoice-signature"), process.env.VAANI_WEBHOOK_SECRET ?? "") ||
    verifyUrlKey(req.url, process.env.VAANI_URL_KEY) ||
    (process.env.VAANI_ALLOW_UNSIGNED === "1" && looksLikeVaani(req.headers.get("x-webhook-event"), original));
  const raw = stripRecording(original); // never keep recording links
  // Setup-only capture mode (VAANI_CAPTURE=1): keep every delivery so the real header and payload
  // format can be confirmed. Unsigned deliveries are stored but never acted on.
  if (process.env.VAANI_CAPTURE === "1") {
    const headers = Object.fromEntries([...req.headers].filter(([k]) => !/cookie|authorization/i.test(k)));
    await q("insert into webhook_captures (sig_ok, headers, body) values ($1,$2,$3)", [sigOk, JSON.stringify(headers), raw]);
    if (!sigOk) return NextResponse.json({ ok: true, captured: true });
  }
  if (!sigOk) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  let env: Envelope;
  try {
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 32);
    env = toEnvelope(JSON.parse(raw), req.headers.get("x-vaanivoice-event") ?? req.headers.get("x-webhook-event"), req.headers.get("x-vaanivoice-delivery"), hash);
  } catch (e) {
    console.error("vaani webhook: unparseable signed payload", String(e).slice(0, 200));
    return NextResponse.json({ ok: true, ignored: "unparseable" });
  }
  const inserted = await q("insert into webhook_events (event_id, delivery_id, type, payload) values ($1,$2,$3,$4) on conflict (event_id) do nothing returning event_id",
    [env.id, req.headers.get("x-vaanivoice-delivery"), env.type, raw]);
  if (!inserted.length) return NextResponse.json({ ok: true, duplicate: true });

  after(async () => {
    try {
      await handleVaaniEvent(env);
      await q("update webhook_events set status='processed', processed_at=now() where event_id=$1", [env.id]);
    } catch (e) {
      console.error("vaani event failed", env.id, String(e).slice(0, 300));
      await q("update webhook_events set status='error', error=$2 where event_id=$1", [env.id, String(e).slice(0, 1000)]);
    }
  });
  return NextResponse.json({ ok: true });
}
