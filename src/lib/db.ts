import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { mergeSettings, type Settings } from "./settings";

// Neon when DATABASE_URL is set (production). Without it, an embedded local Postgres (PGlite)
// in ./.localdb so the whole flow runs on a laptop with no account. Same SQL either way.

type Runner = (text: string, params: unknown[]) => Promise<unknown[]>;
const g = globalThis as unknown as { __aanganDb?: Promise<Runner> };

export function schemaStatements(): string[] {
  const text = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  return text.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
}

async function makeRunner(): Promise<Runner> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const sql = neon(url);
    return (text, params) => sql.query(text, params) as Promise<unknown[]>;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const db = new PGlite(path.join(process.cwd(), ".localdb"), { extensions: { pgcrypto } });
  for (const s of schemaStatements()) await db.query(s);
  return async (text, params) => (await db.query(text, params)).rows;
}

/** Run a parameterised query and return rows. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  g.__aanganDb ??= makeRunner();
  return (await (await g.__aanganDb)(text, params)) as T[];
}

export async function getSettings(): Promise<Settings> {
  try {
    const rows = await q<{ key: string; value: unknown }>("select key, value from settings");
    return mergeSettings(Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>);
  } catch {
    return mergeSettings(null);
  }
}

export async function logEvent(leadId: string | null, actor: string, type: string, detail: unknown = {}) {
  await q("insert into lead_events (lead_id, actor, type, detail) values ($1,$2,$3,$4)", [leadId, actor, type, JSON.stringify(detail)]);
}
