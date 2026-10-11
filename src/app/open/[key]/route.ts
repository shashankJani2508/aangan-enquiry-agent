import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { signToken } from "@/lib/tokens";

export const runtime = "nodejs";

// Owner decision (11 Oct 2026): no password. The founder opens one private link
// (/open/<DASHBOARD_ACCESS_KEY>) and lands on the dashboard; a 1-year signed cookie keeps him in.
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const want = Buffer.from(process.env.DASHBOARD_ACCESS_KEY ?? "");
  const got = Buffer.from(key);
  if (want.length < 24 || got.length !== want.length || !timingSafeEqual(got, want)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set(SESSION_COOKIE, signToken("s:link", 365 * 86_400), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 365 * 86_400 });
  return res;
}
