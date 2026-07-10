import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components (browser). Reads the public local
 * Supabase URL and anon key from the environment.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
