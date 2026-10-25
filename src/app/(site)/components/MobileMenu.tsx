"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Navigation for narrow screens: a panel that unfolds below the header. */
export function MobileMenu({ links }: { links: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="menu-btn" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Menü schliessen" : "Menü öffnen"} onClick={() => setOpen(!open)}>
        <span /><span />
      </button>
      <nav id="mobile-menu" className="mobile-menu" data-open={open} aria-label="Hauptnavigation" inert={!open}>
        {links.map(([href, label], i) => (
          <Link key={href} href={href} onClick={() => setOpen(false)} style={{ "--i": i } as React.CSSProperties}>{label}</Link>
        ))}
      </nav>
    </>
  );
}
