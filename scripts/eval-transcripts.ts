// npm run eval:transcripts [-- T01 T02 ...]
// Runs every enquiry in context/enquiries through the Gemini step + code re-check and writes a
// CSV comparing the result with eval-proposed-labels.md (Shashank's PROPOSALS, not Nikhil's
// decisions). Reports agreement and every disagreement; neither side is called "correct".
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { runGemini } from "../src/lib/gemini";
import { recheckDecision } from "../src/lib/rubric";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const ROOT = path.resolve(__dirname, "..");
const ENQ_DIR = path.join(ROOT, "context", "enquiries");
const OUT_DIR = path.join(ROOT, "eval-output");

type Label = { tier: string; review: boolean; raw: string };

function loadLabels(): Record<string, Label> {
  const md = fs.readFileSync(path.join(ROOT, "eval-proposed-labels.md"), "utf8");
  const out: Record<string, Label> = {};
  for (const line of md.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (!/^[TWF]\d{2}$/.test(cells[1] ?? "")) continue;
    const raw = cells[6];
    const t = raw.toLowerCase();
    const tier = t.startsWith("not an enquiry") ? "not_an_enquiry" : t.startsWith("qualified") ? "qualified" : t.startsWith("high") ? "high" : t.startsWith("medium") ? "medium" : t.startsWith("low") ? "low" : raw;
    out[cells[1]] = { tier, review: t.includes("needs_review"), raw };
  }
  return out;
}

const MONTHS: Record<string, string> = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };

function callDate(header: string): string {
  const m = header.match(/(\d{1,2})(?:\D\d{1,2})?\s+(January|February|March|April|May|June|July|August|September|October|November|December)/i);
  if (!m) return "2026-09-15 (approximate)";
  return `2026-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const only = process.argv.slice(2);
  const labels = loadLabels();
  const files = fs.readdirSync(ENQ_DIR).filter((f) => f.endsWith(".txt")).sort().filter((f) => !only.length || only.includes(f.replace(".txt", "")));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows: Record<string, unknown>[] = [];
  const queue = [...files];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const id = f.replace(".txt", "");
      const text = fs.readFileSync(path.join(ENQ_DIR, f), "utf8");
      const channel = id.startsWith("T") ? "phone" : id.startsWith("W") ? "whatsapp" : "web_form";
      const g = await runGemini(
        { callDateIso: callDate(text.split("\n")[0]), channel, transcript: text, vaaniSummary: null, vaaniFields: null },
        DEFAULT_SETTINGS,
      );
      const label = labels[id];
      let row: Record<string, unknown> = { id, channel, proposed_tier: label?.tier, proposed_needs_review: label?.review, tokens_in: g.tokensIn, tokens_out: g.tokensOut };
      if (!g.ok) {
        row = { ...row, final_tier: "medium", final_needs_review: true, agree: label?.tier === "medium", error: "AI decision unavailable: " + g.error };
      } else if (g.decision.no_content) {
        row = { ...row, gemini_tier: "no_content", final_tier: "not_an_enquiry", agree: label?.tier === "not_an_enquiry", reason: g.decision.reason };
      } else {
        const rc = recheckDecision(g.decision, DEFAULT_SETTINGS);
        row = {
          ...row,
          gemini_tier: g.decision.tier,
          final_tier: rc.final.tier,
          agree: rc.final.tier === label?.tier,
          final_needs_review: rc.final.needs_review,
          value_inr: rc.final.value_inr,
          value_source: rc.final.value_source,
          internal_estimate_inr: rc.estimate.inr,
          estimate_basis: rc.estimate.basis,
          scope_type: g.decision.fields.scope_type,
          area_sqft: g.decision.fields.area_sqft,
          weeks_to_ready: g.decision.fields.weeks_to_ready,
          fit: Object.entries(g.decision.criteria).map(([k, v]) => `${k}=${v.result}`).join(" "),
          not_a_fit_reason: rc.final.not_a_fit_reason,
          code_override: rc.override_note,
          reason: rc.final.reason,
        };
      }
      rows.push(row);
      console.log(`${id}: proposed=${row.proposed_tier} final=${row.final_tier} ${row.agree ? "AGREE" : "DISAGREE"}${row.error ? " ERROR " + row.error : ""}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const cols = ["id", "channel", "proposed_tier", "proposed_needs_review", "gemini_tier", "final_tier", "agree", "final_needs_review", "value_inr", "value_source", "internal_estimate_inr", "estimate_basis", "scope_type", "area_sqft", "weeks_to_ready", "fit", "not_a_fit_reason", "code_override", "reason", "tokens_in", "tokens_out", "error"];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const csvPath = path.join(OUT_DIR, `eval-${stamp}.csv`);
  fs.writeFileSync(csvPath, [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n"));
  const agree = rows.filter((r) => r.agree).length;
  const dis = rows.filter((r) => !r.agree);
  const summary = [
    `# Eval ${stamp}`,
    `Model: ${process.env.GEMINI_MODEL}. Compared with eval-proposed-labels.md (proposals, not decisions).`,
    `Agreement: ${agree}/${rows.length}.`,
    "",
    "| ID | Proposed | Final (after code re-check) | Gemini said | Reason / error |",
    "|---|---|---|---|---|",
    ...dis.map((r) => `| ${r.id} | ${r.proposed_tier} | ${r.final_tier} | ${r.gemini_tier ?? ""} | ${String(r.error ?? r.reason ?? "").replace(/\|/g, "/")} |`),
  ].join("\n");
  fs.writeFileSync(csvPath.replace(/\.csv$/, ".md"), summary);
  console.log(`\nAgreement ${agree}/${rows.length}. CSV: ${csvPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
