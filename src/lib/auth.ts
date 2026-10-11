import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signToken, verifyToken } from "./tokens";

// Dashboard login: email magic link (Resend) to an allow-list. The link and the session cookie
// carry only a hash of the email (no PII in URLs). Roles: founder, admin.
// DASHBOARD_USERS="nikhil@example.com:founder,shashank@example.com:admin"  TODO(owner)

export const hashEmail = (e: string) => createHash("sha256").update(e.trim().toLowerCase()).digest("hex").slice(0, 32);

export function allowedUsers(): { email: string; role: "founder" | "admin"; hash: string }[] {
  return (process.env.DASHBOARD_USERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [email, role] = s.split(":");
      return { email, role: role === "founder" ? "founder" : "admin", hash: hashEmail(email) } as const;
    });
}

export const SESSION_COOKIE = "aangan_session";

export async function currentUser(): Promise<{ hash: string; role: "founder" | "admin" } | null> {
  const tok = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = tok ? verifyToken(tok) : null;
  if (!payload?.startsWith("s:")) return null;
  const hash = payload.slice(2);
  if (hash === "link") return { hash, role: "founder" }; // private founder link
  const u = allowedUsers().find((x) => x.hash === hash);
  return u ? { hash, role: u.role } : null;
}

export async function requireUser(role?: "founder") {
  // Owner decision (11 Oct 2026): no login at all. The link is shared only with the founder and
  // opens straight on the dashboard. Set DASHBOARD_OPEN=0 to bring the login back.
  if (process.env.DASHBOARD_OPEN !== "0") return { hash: "open", role: "founder" as const };
  const u = await currentUser();
  if (!u) redirect("/login"); // only reached without the private link
  if (role && u.role !== role) redirect("/dashboard");
  return u;
}

export const loginLinkToken = (hash: string) => signToken(`l:${hash}`, 15 * 60);
export const sessionToken = (hash: string) => signToken(`s:${hash}`, 7 * 86_400);
