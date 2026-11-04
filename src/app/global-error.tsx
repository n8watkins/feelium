"use client";

import { useEffect } from "react";

import { reportError } from "@/components/error-reporting";

/**
 * The last-resort error page, for a failure in the root layout itself. It replaces the
 * whole document, so it can't rely on the app's stylesheet or providers: plain, inline
 * styles that read well in light and dark, with Retry and a link home.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          colorScheme: "light dark",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <main style={{ maxWidth: "24rem" }}>
          <h1 style={{ fontSize: "1.125rem", margin: "0 0 0.5rem" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: "0 0 1.25rem" }}>
            feelium didn&apos;t load. Nothing you&apos;ve recorded was affected.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ font: "inherit", fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1.25rem", borderRadius: 999, border: "1px solid currentColor", background: "transparent", color: "inherit", cursor: "pointer" }}
          >
            Try again
          </button>{" "}
          {/* A full page load on purpose: the root layout itself just failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ fontSize: "0.875rem", color: "inherit", marginLeft: "0.75rem" }}>
            Go home
          </a>
        </main>
      </body>
    </html>
  );
}
