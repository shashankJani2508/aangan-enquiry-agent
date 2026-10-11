// npm run fixture:sign -- fixtures/call-completed.sample.json [url]
// Signs a fixture with VAANI_WEBHOOK_SECRET and POSTs it to the local webhook.
import "dotenv/config";
import fs from "node:fs";
import { signBody } from "../src/lib/vaani";

async function main() {
  const file = process.argv[2] ?? "fixtures/call-completed.sample.json";
  const url = process.argv[3] ?? "http://localhost:3000/api/webhooks/vaani";
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  obj.id = process.env.KEEP_ID ? obj.id : `evt_test_${Date.now()}`;
  if (obj.data) obj.data.call_id = process.env.KEEP_ID ? obj.data.call_id : `call_test_${Date.now()}`;
  const raw = JSON.stringify(obj);
  const res = await fetch(url, { method: "POST", body: raw, headers: { "content-type": "application/json", "X-VaaniVoice-Event": obj.type, "X-VaaniVoice-Delivery": `dlv_${Date.now()}`, "X-VaaniVoice-Signature": signBody(raw, process.env.VAANI_WEBHOOK_SECRET ?? "") } });
  console.log(res.status, await res.text());
}
main();
