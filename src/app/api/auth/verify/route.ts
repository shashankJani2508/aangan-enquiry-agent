import { NextResponse } from "next/server";
import { allowedUsers, SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { verifyToken } from "@/lib/tokens";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const payload = verifyToken(t);
  const hash = payload?.startsWith("l:") ? payload.slice(2) : null;
  if (!hash || !allowedUsers().some((u) => u.hash === hash)) return NextResponse.redirect(new URL("/login?error=1", req.url));
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set(SESSION_COOKIE, sessionToken(hash), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 86_400 });
  return res;
}
