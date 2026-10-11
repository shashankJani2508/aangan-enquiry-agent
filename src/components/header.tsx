import Link from "next/link";

export function Header({ back }: { back?: boolean } = {}) {
  return (
    <div className="top">
      <Link href="/dashboard" className="brand">
        <span className="logo">A</span>
        <span>
          Aangan Studio<small>Enquiry control centre</small>
        </span>
      </Link>
      {back ? (
        <Link href="/dashboard" className="backlink">← Back to dashboard</Link>
      ) : null}
    </div>
  );
}
