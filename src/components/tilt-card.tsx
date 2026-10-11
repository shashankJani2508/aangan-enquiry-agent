"use client";

import { useRef, useState, type ReactNode } from "react";

// 3D mind-map panel that gently follows the pointer (a few degrees), like the reference shot.
// Movement is small and smooth so click targets stay under the cursor. "Flat view" turns it off.
const BASE = { x: 14, y: -8, z: 1.5 };

export function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [flat, setFlat] = useState(false);
  const [t, setT] = useState(BASE);

  const move = (e: React.PointerEvent) => {
    if (flat || !ref.current || e.pointerType !== "mouse") return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setT({ x: BASE.x - py * 8, y: BASE.y + px * 10, z: BASE.z });
  };

  const transform = flat ? "none" : `rotateX(${t.x}deg) rotateY(${t.y}deg) rotateZ(${t.z}deg) scale(.97)`;

  return (
    <div className="stage big-stage" style={{ position: "relative" }}>
      <div className="grid-floor" aria-hidden="true" style={{ opacity: flat ? 0 : 1 }} />
      <button type="button" className="flat-toggle" onClick={() => { setFlat((f) => !f); setT(BASE); }}>
        {flat ? "3D view" : "Flat view"}
      </button>
      <section
        ref={ref}
        className={`card flow slab ${flat ? "is-flat" : "floating"}`}
        style={{ transform }}
        onPointerMove={move}
        onPointerLeave={() => setT(BASE)}
        aria-label="Where this month's enquiries went"
      >
        {children}
      </section>
    </div>
  );
}
