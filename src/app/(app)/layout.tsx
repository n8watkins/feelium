import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BottomNav } from "@/components/bottom-nav";
import { TimezoneSync } from "@/components/timezone-sync";
import { TopBar } from "@/components/top-bar";
import { ensureProfile, StaleSessionError } from "@/server/data";

/**
 * Layout for the authenticated app. Guards every child route with a server-side session
 * check (defense in depth alongside the proxy) and ensures the user's profile row exists
 * on first sign-in. Renders the shell: a top bar (with the tabs on desktop), the page, and
 * the bottom tab bar on phones. Pages are 48rem wide; one that marks itself `data-wide`
 * (Insights) gets 64rem.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  let profile: Awaited<ReturnType<typeof ensureProfile>>;
  try {
    profile = await ensureProfile();
  } catch (error) {
    // Stale JWT whose user was deleted (account deletion elsewhere, or a dev DB reset):
    // route through the recovery sign-out, which clears the cookie and lands on /login.
    if (error instanceof StaleSessionError) {
      redirect("/api/account/signout");
    }
    throw error;
  }

  const account = {
    name: session.user.name || session.user.email || "You",
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  };
  return (
    <>
      <TopBar account={account} />
      <main className="mx-auto w-full max-w-3xl flex-1 pb-28 has-[[data-wide]]:max-w-5xl md:pb-16">
        {/* In the page flow, above the content, so it never covers the header or Check in. */}
        <TimezoneSync
          currentTimeZone={profile.timezone}
          shouldSync={profile.autoSyncTimezone}
        />
        {children}
      </main>
      <BottomNav />
    </>
  );
}
