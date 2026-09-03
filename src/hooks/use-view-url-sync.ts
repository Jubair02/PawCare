"use client";

import { useEffect, useRef } from "react";

import { useAppStore } from "@/lib/store";

/**
 * Mirrors the SPA's current view into `?view=` and back.
 *
 * The whole app renders at `/` and navigates through a zustand string, so
 * before this there were no shareable links, the browser Back button walked out
 * of the app entirely, and a refresh only survived because the view happened to
 * be persisted to localStorage.
 *
 * The shell's role guard still runs, so a link to another role's view is bounced
 * to that user's home view rather than trusted.
 */
export function useViewUrlSync(isValidView: (view: string) => boolean) {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const adopted = useRef(false);

  // Adopt ?view= from the address bar once, on first mount.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("view");
    if (fromUrl && isValidView(fromUrl) && fromUrl !== view) {
      setView(fromUrl);
    }
    adopted.current = true;
    // Deliberately mount-only: later URL changes arrive through popstate.
  }, []);

  // Mirror view changes back into the URL.
  useEffect(() => {
    if (!adopted.current) return;

    const url = new URL(window.location.href);
    const current = url.searchParams.get("view");
    if (current === view) return;

    url.searchParams.set("view", view);
    // The first write only labels the entry the user already landed on; real
    // navigations push, so Back steps through the app instead of leaving it.
    if (current === null) {
      window.history.replaceState({ view }, "", url);
    } else {
      window.history.pushState({ view }, "", url);
    }
  }, [view]);

  // Back / forward.
  useEffect(() => {
    const onPopState = () => {
      const fromUrl = new URLSearchParams(window.location.search).get("view");
      if (fromUrl && isValidView(fromUrl)) setView(fromUrl);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isValidView, setView]);
}
