/**
 * Which deployment this server is. APP_ENV is set per deployment (wrangler.jsonc sets
 * "production" for the Cloudflare Worker, which serves production); the legacy Vercel
 * deployment, which predates it, maps VERCEL_ENV onto the same names until it is
 * retired. Anything else is a local run.
 *
 * Only a deployed environment fails closed without Turso: a local SQLite file there would
 * be ephemeral and could appear to accept writes before silently losing them.
 */
export type AppEnv = "production" | "preview" | "development";

const APP_ENVS: readonly AppEnv[] = ["production", "preview", "development"];

export function appEnv(environment: Record<string, string | undefined> = process.env): AppEnv {
  const explicit = environment.APP_ENV;
  if (explicit) {
    if (!(APP_ENVS as readonly string[]).includes(explicit)) {
      throw new Error(`APP_ENV must be one of ${APP_ENVS.join(", ")}; got "${explicit}".`);
    }
    return explicit as AppEnv;
  }
  if (environment.VERCEL_ENV === "production") return "production";
  if (environment.VERCEL === "1" || environment.VERCEL_ENV) return "preview";
  return "development";
}

/** True for a deployment (production or preview) rather than a local run. */
export function isDeployed(environment: Record<string, string | undefined> = process.env): boolean {
  return appEnv(environment) !== "development";
}
