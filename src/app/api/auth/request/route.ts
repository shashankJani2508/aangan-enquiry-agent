import { NextResponse } from "next/server";
import { allowedUsers, hashEmail, loginLinkToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const user = allowedUsers().find((u) => u.email.toLowerCase() === email);
  if (user) {
    const link = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/auth/verify?t=${encodeURIComponent(loginLinkToken(hashEmail(email)))}`;
    const r = await sendEmail({ to: [email], subject: "Your Aangan dashboard login link", text: `Log in (valid 15 minutes): ${link}`, html: `<p><a href="${link}">Log in to the Aangan dashboard</a> (valid 15 minutes)</p>`, idempotencyKey: `login:${hashEmail(email)}:${Math.floor(Date.now() / 60000)}` });
    // Local development without Resend: print the link to the server console only.
    if (r.status === "dry_run" && process.env.NODE_ENV !== "production") console.log("[dev] login link:", link);
  }
  return NextResponse.redirect(new URL("/login?sent=1", req.url), 303);
}
