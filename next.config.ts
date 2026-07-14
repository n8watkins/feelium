import type { NextConfig } from "next";

// Pin the workspace root to THIS app directory. Without this, Next.js/Turbopack walks up
// the tree looking for a lockfile and can pick an OUTER repo (this app is often checked out
// as a nested git worktree, and the parent may carry its own package-lock.json). Choosing
// the wrong root breaks module resolution - notably a missing `@swc/helpers` and a broken
// client manifest at dev time. Both `turbopack.root` (dev/build module resolution) and
// `outputFileTracingRoot` (server output tracing) are pinned to `__dirname` so the app
// always resolves against its own node_modules.
const appRoot = __dirname;
const isDev = process.env.NODE_ENV === "development";
export function buildContentSecurityPolicy(development: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
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

const contentSecurityPolicy = buildContentSecurityPolicy(isDev);

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: appRoot,
  },
  outputFileTracingRoot: appRoot,
  // Keep these server-only packages out of the bundle (native/optional bits and
  // Turbopack parsing quirks); they run only in the Node server runtime.
  serverExternalPackages: [
    "@libsql/client",
    "bcryptjs",
    "@auth/drizzle-adapter",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // The service worker must never be cached, or clients get stuck on a stale
        // worker and miss updates. It also needs a correct JS content type and to be
        // allowed to control the whole origin scope.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
