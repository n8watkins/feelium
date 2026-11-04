"use client";

import { useEffect } from "react";

import {
  DATA_COLLECTION,
  DENY_URLS,
  ERROR_SAMPLE_RATE,
  IGNORE_ERRORS,
  scrubEvent,
  TRACES_SAMPLE_RATE,
} from "@/lib/error-reporting";

type SentryModule = typeof import("@sentry/browser");

// Set once the SDK is loaded and started; error boundaries report through it.
let sentry: Promise<SentryModule | null> = Promise.resolve(null);

/** Sends an error to Sentry when reporting is on; a no-op otherwise. */
export function reportError(error: unknown) {
  void sentry.then((sdk) => sdk?.captureException(error));
}

/**
 * Starts browser error reporting when the root layout passes a DSN (the SENTRY_DSN Worker
 * secret). The SDK is loaded only then, so without a DSN nothing is downloaded or sent.
 */
export function ErrorReporting({ dsn, environment }: { dsn?: string; environment: string }) {
  useEffect(() => {
    if (!dsn) return;
    sentry = import("@sentry/browser").then((sdk) => {
      sdk.init({
        dsn,
        environment,
        sampleRate: ERROR_SAMPLE_RATE,
        tracesSampleRate: TRACES_SAMPLE_RATE,
        integrations: [sdk.browserTracingIntegration()],
        dataCollection: DATA_COLLECTION,
        ignoreErrors: IGNORE_ERRORS,
        denyUrls: DENY_URLS,
        beforeSend: (event) => scrubEvent(event),
        // Whole transactions, so beforeSendTransaction can scrub them (spans stream otherwise).
        traceLifecycle: "static",
        beforeSendTransaction: (event) => scrubEvent(event),
        beforeBreadcrumb: (crumb) => (crumb.category === "ui.input" ? null : crumb),
      });
      return sdk;
    });
  }, [dsn, environment]);
  return null;
}
