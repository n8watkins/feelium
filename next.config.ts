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
};

export default nextConfig;
