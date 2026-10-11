import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

// Applies db/schema.sql (idempotent).
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const text = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  const stmts = text.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
  for (const s of stmts) await sql.query(s);
  console.log(`Applied ${stmts.length} statements.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
