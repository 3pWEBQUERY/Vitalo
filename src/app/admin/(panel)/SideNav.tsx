"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number };
export type NavSection = { title?: string; items: NavItem[] };

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

export function SideNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen(!open)} aria-label={open ? "Navigation schliessen" : "Navigation öffnen"}>
        <Icon name={open ? "x" : "menu"} size={20} />
      </button>
      <nav id="admin-nav" className="side-nav" data-open={open} aria-label="Admin">
        {sections.map((section, index) => (
          <div className="side-section" key={section.title ?? index}>
            {section.title && <div className="side-title">{section.title}</div>}
            {section.items.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                <Icon name={item.icon} size={18} />
                <span className="side-label">{item.label}</span>
                {item.badge ? <span className="badge">{item.badge > 99 ? "99+" : item.badge}</span> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}

/** Title of the current area for the top bar, taken from the navigation. */
export function CurrentArea({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const items = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));
  const match = items.filter((i) => isActive(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0];
  if (pathname === "/admin/account") return <div className="crumbs"><span className="crumb-current">Mein Konto</span></div>;
  if (!match) return <div className="crumbs" />;
  return (
    <div className="crumbs">
      {match.section && <span className="crumb-section">{match.section}</span>}
      {match.section && <Icon name="chevronRight" size={12} />}
      <Link href={match.href} className="crumb-current">{match.label}</Link>
    </div>
  );
}
