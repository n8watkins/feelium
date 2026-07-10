/**
 * Post-auth redirect validation.
 *
 * Only accept same-origin RELATIVE paths that start with a single "/". Reject absolute
 * URLs, protocol-relative URLs ("//host"), backslash tricks ("/\\host"), and anything
 * with control characters. This prevents an open-redirect where a crafted `next`/
 * `callbackUrl` sends a freshly-authenticated user to an attacker-controlled origin.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback = "/today",
): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  // Must be a relative path.
  if (next[0] !== "/") return fallback;
  // Reject protocol-relative ("//evil.com") and backslash ("/\\evil.com") forms.
  if (next[1] === "/" || next[1] === "\\") return fallback;
  // Reject control characters (0x00-0x1f), e.g. newlines used for header injection.
  for (let i = 0; i < next.length; i += 1) {
    if (next.charCodeAt(i) < 0x20) return fallback;
  }
  return next;
}
