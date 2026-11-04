/**
 * Shared Sentry settings for the browser (src/components/error-reporting.tsx) and the
 * Worker (worker/index.ts). Error reporting is off unless the SENTRY_DSN Worker secret is
 * set, so local, CI and test runs send nothing.
 *
 * Feelium holds health-like data, so events carry no person: no user, IP, cookies,
 * headers, request bodies or query strings, and URLs keep only their path.
 */

/** Share of errors sent. All of them: the app is small, and errors should be rare. */
export const ERROR_SAMPLE_RATE = 1;
/** Share of requests traced for performance. Low, to stay inside the free quota. */
export const TRACES_SAMPLE_RATE = 0.05;

/** Sentry's own collection switches, all off; `scrubEvent` removes anything left over. */
export const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
};

/** Noise that isn't ours: browser extensions, aborted requests, flaky networks. */
export const IGNORE_ERRORS: (string | RegExp)[] = [
  /^AbortError/,
  "The user aborted a request",
  "The operation was aborted",
  /^NetworkError when attempting to fetch resource/,
  "Failed to fetch",
  "Load failed",
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  // Next.js uses thrown errors for redirects and 404s; they aren't failures.
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
];
export const DENY_URLS: RegExp[] = [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//];

/** "https://feelium.n8builds.dev/history/2026-11-01?x=1#y" -> "https://feelium.n8builds.dev/history/2026-11-01" */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, "");
}

type Scrubbable = {
  user?: unknown;
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown; data?: unknown; env?: unknown };
  breadcrumbs?: { data?: Record<string, unknown> & { url?: unknown; from?: unknown; to?: unknown } }[];
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

/** Sentry `beforeSend`: removes anything that could identify a person or their data. */
export function scrubEvent<T extends Scrubbable>(event: T): T {
  delete event.user;
  if (event.request) {
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.env;
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (!crumb.data) continue;
    for (const key of ["url", "from", "to"] as const) {
      const value = crumb.data[key];
      if (typeof value === "string") crumb.data[key] = stripQuery(value);
    }
  }
  return event;
}

/** The Sentry ingest origin of a DSN, for the Content Security Policy; null if invalid. */
export function sentryOrigin(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
