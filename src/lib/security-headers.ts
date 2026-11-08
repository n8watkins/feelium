/** Third-party hosts the page talks to, each only when its feature is switched on. */
export type ExternalHosts = {
  /** Cloudflare Web Analytics (CF_WEB_ANALYTICS_TOKEN). */
  webAnalytics?: boolean;
  /** The Sentry ingest origin from SENTRY_DSN. */
  sentryOrigin?: string | null;
};

export function buildContentSecurityPolicy(
  nonce: string,
  development: boolean,
  { webAnalytics = false, sentryOrigin = null }: ExternalHosts = {},
) {
  const connect = [
    "'self'",
    ...(webAnalytics ? ["https://cloudflareinsights.com"] : []),
    ...(sentryOrigin ? [sentryOrigin] : []),
    ...(development ? ["ws:", "http:"] : []),
  ];
  // Sonner injects its stylesheet as an inline <style>: allowed by the hash of its exact
  // CSS. It appends the element empty and fills it in after, so the empty element is
  // checked first; the empty string's hash allows exactly that (an empty style, no CSS).
  const sonnerStyleHash =
    "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}' ${sonnerStyleHash}`}`,
    ...(development
      ? []
      : [
          `style-src-elem 'self' 'nonce-${nonce}' ${sonnerStyleHash}`,
          "style-src-attr 'unsafe-inline'",
        ]),
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // The analytics script itself is allowed by its nonce ('strict-dynamic' ignores hosts).
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
