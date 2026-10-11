import { redirect } from "next/navigation";

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  if (process.env.DASHBOARD_OPEN !== "0") redirect("/dashboard");
  const sp = await searchParams;
  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h1>Aangan dashboard</h1>
      {sp.sent ? <p>If that email is allowed, a login link is on its way (valid 15 minutes).</p> : null}
      {sp.error ? <p className="warn">That link is invalid or expired.</p> : null}
      <form method="post" action="/api/auth/request" style={{ display: "flex", gap: 8 }}>
        <input type="email" name="email" required placeholder="you@example.com" style={{ flex: 1 }} />
        <button type="submit">Send link</button>
      </form>
    </div>
  );
}
