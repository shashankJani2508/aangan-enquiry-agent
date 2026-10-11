import { revalidatePath } from "next/cache";
import { getSettings, q } from "@/lib/db";
import { cancelBooking, type BookingRow } from "@/lib/booking";
import { verifyToken } from "@/lib/tokens";
import { fmtIST } from "@/lib/time";

export const dynamic = "force-dynamic";

// The caller's "change or cancel" page, linked from the booking email. Signed link, no login.
const bookingId = (t: string) => {
  const p = verifyToken(decodeURIComponent(t));
  return p?.startsWith("b:") ? p.slice(2) : null;
};

async function act(form: FormData) {
  "use server";
  const id = bookingId(String(form.get("t")));
  if (!id) return;
  await cancelBooking(id, await getSettings(), form.get("do") === "move");
  revalidatePath("/booking");
}

export default async function ManageBooking({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = bookingId(token);
  if (!id) return <div className="card" style={{ maxWidth: 460, margin: "40px auto" }}>This link is invalid or has expired.</div>;
  const [b] = await q<BookingRow>("select * from bookings where id=$1", [id]);
  const [latest] = b ? await q<BookingRow>("select * from bookings where lead_id=$1 order by created_at desc limit 1", [b.lead_id]) : [];
  const current = latest ?? b;
  return (
    <div className="card" style={{ maxWidth: 460, margin: "40px auto" }}>
      <h1 style={{ fontSize: 24 }}>Your Aangan Studio consultation</h1>
      {current?.status === "booked" ? (
        <>
          <p>
            Booked with <b>{current.designer_name.split(" ")[0]}</b> on <b>{fmtIST(current.start_time)} IST</b>.
          </p>
          <form action={act} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="hidden" name="t" value={token} />
            <button name="do" value="move">Move to the next free time</button>
            <button name="do" value="cancel" style={{ background: "transparent", color: "var(--l)", border: "1px solid var(--l)" }}>
              Cancel
            </button>
          </form>
          <p className="mute" style={{ fontSize: 13 }}>A new calendar invite is emailed when you move it.</p>
        </>
      ) : (
        <p>This consultation is cancelled. Call the studio any time to book again.</p>
      )}
    </div>
  );
}
