/**
 * Cloudflare Web Analytics: cookie-free page views, no personal data. Rendered only when
 * the CF_WEB_ANALYTICS_TOKEN Worker variable is set, so local, CI and test runs send
 * nothing. The script carries the CSP nonce, and the policy allows its beacon host
 * (src/lib/security-headers.ts).
 */
export function WebAnalytics({ token, nonce }: { token?: string; nonce?: string }) {
  if (!token) return null;
  return (
    <script
      defer
      nonce={nonce}
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token, spa: true })}
    />
  );
}
