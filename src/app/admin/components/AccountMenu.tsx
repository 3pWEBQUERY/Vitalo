"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/** Avatar button with a small menu: own account and sign-out. */
export function AccountMenu({ name, email, role, signOut }: { name: string; email: string; role: string; signOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="avatar-button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <span className="avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
        <span className="avatar-name">{name}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{name}</strong>
            <span>{email}</span>
            <span className="tag">{role}</span>
          </div>
          <Link href="/admin/account" role="menuitem" className="menu-item" onClick={() => setOpen(false)}><Icon name="person" size={16} />Mein Konto</Link>
          <a href="/" role="menuitem" className="menu-item" target="_blank" rel="noreferrer"><Icon name="external" size={16} />Website öffnen</a>
          <form action={signOut}>
            <button type="submit" role="menuitem" className="menu-item danger-text"><Icon name="logout" size={16} />Abmelden</button>
          </form>
        </div>
      )}
    </div>
  );
}
