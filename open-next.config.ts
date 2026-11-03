import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental or tag cache: every page except the static root redirect renders per
// request (the proxy sets a per-request CSP nonce and every app page reads the session),
// and nothing uses fetch caching, unstable_cache, "use cache" or ISR. The server actions'
// revalidatePath calls only refresh the client Router Cache for those dynamic routes,
// which needs no server-side cache store. Add the R2 incremental cache and D1 tag cache
// (https://opennext.js.org/cloudflare/caching) if a route ever becomes static or cached.
export default defineCloudflareConfig();
