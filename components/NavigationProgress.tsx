"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Event custom untuk trigger progress bar dari komponen lain
export const NAVIGATION_START_EVENT = "navigationstart";

export function emitNavigationStart() {
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT));
}

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    setLoading(true);
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    // fallback: sembunyikan setelah 3 detik kalau pathname tidak berubah
    hideTimerRef.current = setTimeout(() => setLoading(false), 3000);
  }, []);

  const hide = useCallback(() => {
    if (hideTimerRef.current !== null) clearTimeout(hideTimerRef.current);
    setLoading(false);
  }, []);

  // Dengarkan klik pada link (mencakup <Link> dan <a> biasa)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Abaikan link eksternal, anchor hash, mailto, tel, download, dan target _blank
      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.hasAttribute("download") ||
        anchor.target === "_blank"
      ) {
        return;
      }

      // Abaikan kalau ada modifier key (ctrl+click, cmd+click, dll)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Abaikan kalau defaultPrevented
      if (e.defaultPrevented) return;

      show();
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [show]);

  // Dengarkan event custom (untuk navigasi programmatic seperti router.push)
  useEffect(() => {
    function handleNavStart() {
      show();
    }
    window.addEventListener(NAVIGATION_START_EVENT, handleNavStart);
    return () => window.removeEventListener(NAVIGATION_START_EVENT, handleNavStart);
  }, [show]);

  // Sembunyikan progress bar saat pathname/searchParams berubah (navigasi selesai)
  useEffect(() => {
    hide();
  }, [pathname, searchParams, hide]);

  if (!loading) return null;

  return <div className="navigation-progress" />;
}

