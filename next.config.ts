import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep these server-only packages out of the bundle (native/optional bits and
  // Turbopack parsing quirks); they run only in the Node server runtime.
  serverExternalPackages: [
    "@libsql/client",
    "bcryptjs",
    "@auth/drizzle-adapter",
    "nodemailer",
  ],
  async headers() {
    return [
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
