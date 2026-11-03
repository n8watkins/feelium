// Where the suite runs. By default Playwright starts a local production build on a fresh
// SQLite file (scripts/start-e2e-server.sh). PLAYWRIGHT_BASE_URL points it at a deployment
// that is already running instead, such as the Worker on workers.dev or
// `npm run preview:worker`. That deployment needs its own throwaway database, migrated and
// seeded (npm run db:migrate && npm run db:seed), named here by FEELIUM_E2E_DB_URL (and
// FEELIUM_E2E_DB_AUTH_TOKEN), and FEELIUM_E2E_AUTH_SECRET must be its AUTH_SECRET so the
// suite can mint a session for the seeded demo user. A local workerd run on plain HTTP
// (`npm run preview:worker`) also needs AUTH_URL=http://localhost:<port> in .dev.vars, so
// Auth.js uses the unprefixed cookie the suite sets for an http:// base URL.
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required with PLAYWRIGHT_BASE_URL`);
  return value;
}

export const e2e = externalBaseURL
  ? {
      external: true,
      baseURL: externalBaseURL,
      database: {
        url: required("FEELIUM_E2E_DB_URL"),
        authToken: process.env.FEELIUM_E2E_DB_AUTH_TOKEN,
      },
      sessionSecret: required("FEELIUM_E2E_AUTH_SECRET"),
    }
  : {
      external: false,
      baseURL: "http://127.0.0.1:3100",
      database: { url: "file:./.data/e2e.db", authToken: undefined },
      // Matches scripts/start-e2e-server.sh.
      sessionSecret: "feelium-e2e-secret-not-for-production",
    };
