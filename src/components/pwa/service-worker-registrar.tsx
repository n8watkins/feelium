"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) once, on the client, after mount.
 *
 * Renders nothing. Mounted high in the tree so the PWA is installable and can receive
 * push on every route. Registration failures are swallowed on purpose: the app must work
 * fine in browsers without service-worker support (PRD 23 graceful degradation).
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });
    };

    // Defer until the page has loaded so registration never competes with first paint.
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
