"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * One observer for the whole page: elements with [data-reveal] get .is-in when they enter the
 * viewport, and the scroll position is exposed as --scroll for parallax. Both are skipped when
 * the visitor prefers reduced motion (CSS then shows everything statically).
 */
export function Motion() {
  const pathname = usePathname();
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    root.classList.add("motion-ready");
    const targets = () => document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)");
    if (reduced) {
      targets().forEach((el) => el.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    targets().forEach((el) => observer.observe(el));

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--scroll", String(window.scrollY));
        root.dataset.scrolled = window.scrollY > 8 ? "true" : "false";
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);
  return null;
}
