import { createHmac, timingSafeEqual } from "node:crypto";

// Signed (HMAC) tokens for designer outcome links and dashboard sessions. No PII inside.
const secret = () => {
  const s = process.env.APP_SIGNING_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SIGNING_SECRET must be set (32+ chars)");
  return s;
};
const mac = (msg: string) => createHmac("sha256", secret()).update(msg).digest("base64url");

export function signToken(payload: string, ttlSeconds: number): string {
  const body = `${payload}.${Math.floor(Date.now() / 1000) + ttlSeconds}`;
  return `${body}.${mac(body)}`;
}

export function verifyToken(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const body = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(mac(body));
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  const j = body.lastIndexOf(".");
  if (Number(body.slice(j + 1)) < Date.now() / 1000) return null;
  return body.slice(0, j);
}

export const outcomeUrl = (leadId: string, days: number) =>
  `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/outcome/${signToken(`o:${leadId}`, days * 86_400)}`;
