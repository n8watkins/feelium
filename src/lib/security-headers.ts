export function buildContentSecurityPolicy(nonce: string, development: boolean) {
  // Sonner injects its stylesheet as an inline <style>: allowed by the hash of its exact
  // CSS. It appends the element empty and fills it in after, so the empty element is
  // checked first; the empty string's hash allows exactly that (an empty style, no CSS).
  const sonnerStyleHash =
    "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY=' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";
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
    `connect-src 'self'${development ? " ws: http:" : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
