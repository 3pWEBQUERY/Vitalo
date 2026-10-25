"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import type { SearchHit } from "../search/route";

export type Command = { label: string; href: string; icon: IconName; group: string; keywords?: string };

/** ⌘K: jump to any page, start a common task or find a person, food, brand or post. */
export function CommandPalette({ commands }: { commands: Command[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQuery("");
      setHits([]);
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/admin/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (response.ok) setHits((await response.json()).hits);
      } catch {
        // Aborted by the next keystroke.
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = commands.filter((c) => !q || `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q)).slice(0, q ? 6 : 12);
    return [...matched.map((c) => ({ group: c.group, label: c.label, href: c.href, icon: c.icon, detail: undefined as string | undefined })), ...hits.map((h) => ({ ...h, icon: "search" as IconName }))];
  }, [commands, hits, query]);

  useEffect(() => setActive(0), [query, hits.length]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  let lastGroup = "";
  return (
    <dialog ref={dialog} className="palette" onCancel={(e) => { e.preventDefault(); setOpen(false); }} onClick={(e) => e.target === dialog.current && setOpen(false)}>
      <div className="palette-search">
        <Icon name="search" size={18} />
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen oder Befehl eingeben …"
          aria-label="Suchen"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && items[active]) { e.preventDefault(); go(items[active].href); }
          }}
        />
        {loading ? <span className="spinner" aria-hidden /> : <kbd>esc</kbd>}
      </div>
      <div className="palette-list" role="listbox">
        {items.length === 0 && <p className="palette-empty">{query.trim().length < 2 ? "Tippe mindestens zwei Zeichen." : "Nichts gefunden."}</p>}
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <div key={`${item.href}-${i}`}>
              {header && <div className="palette-group">{header}</div>}
              <button type="button" role="option" aria-selected={i === active} className="palette-item" onMouseMove={() => setActive(i)} onClick={() => go(item.href)}>
                <Icon name={item.icon} size={16} />
                <span className="palette-label">{item.label}</span>
                {item.detail && <span className="palette-detail">{item.detail}</span>}
                <Icon name="chevronRight" size={14} className="palette-go" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> auswählen</span><span><kbd>↵</kbd> öffnen</span><span><kbd>⌘</kbd><kbd>K</kbd> schliessen</span></div>
    </dialog>
  );
}

export function SearchButton() {
  return (
    <button type="button" className="search-trigger" onClick={() => window.dispatchEvent(new Event("open-command-palette"))}>
      <Icon name="search" size={16} />
      <span>Suchen …</span>
      <kbd>⌘K</kbd>
    </button>
  );
}
