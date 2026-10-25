"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "./Icon";

type Theme = "light" | "dark";

/** Switches between light (default) and dark. The new theme spreads as a circle from the button. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function apply(next: Theme) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("vitalo-theme", next);
    } catch {
      // Private mode: the choice lasts for this visit only.
    }
    setTheme(next);
  }

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = theme === "light" ? "dark" : "light";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduced) {
      apply(next);
      return;
    }
    const { clientX: x, clientY: y } = event;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => flushSync(() => apply(next)));
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)", pseudoElement: "::view-transition-new(root)" },
      );
    });
  }

  const label = theme === "light" ? "Dunkles Design einschalten" : "Helles Design einschalten";
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <span className="theme-icon" data-active={theme === "light"}><Icon name="moon" size={18} /></span>
      <span className="theme-icon" data-active={theme === "dark"}><Icon name="sun" size={18} /></span>
    </button>
  );
}
