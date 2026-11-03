import type { AdapterAccount } from "next-auth/adapters";

/** The account row to store: who signed in with what, without the provider's tokens. */
export function withoutOAuthTokens(account: AdapterAccount): AdapterAccount {
  return {
    ...account,
    access_token: undefined,
    refresh_token: undefined,
    id_token: undefined,
    expires_at: undefined,
    session_state: undefined,
  };
}
