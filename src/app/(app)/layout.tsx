import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { TimezoneSync } from "@/components/timezone-sync";
import { DEFAULT_TIME_ZONE } from "@/lib/date";
import { ensureProfile, getCurrentProfile, StaleSessionError } from "@/server/data";

/**
 * Layout for the authenticated app. Guards every child route with a server-side session
 * check (defense in depth alongside the proxy) and ensures the user's profile row exists
 * on first sign-in. Renders the mobile-first shell: desktop sidebar + scrollable main +
 * mobile bottom navigation.
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

  const profile = await getCurrentProfile();

  try {
    await ensureProfile();
  } catch (error) {
    // Stale JWT whose user was deleted (account deletion elsewhere, or a dev DB reset):
    // route through the recovery sign-out, which clears the cookie and lands on /login.
    if (error instanceof StaleSessionError) {
      redirect("/api/account/signout");
    }
    throw error;
  }

  return (
    <div className="flex min-h-dvh">
      <TimezoneSync
        currentTimeZone={profile?.timezone ?? DEFAULT_TIME_ZONE}
        shouldSync={profile?.autoSyncTimezone ?? false}
      />
      <AppSidebar />
      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="mx-auto w-full max-w-2xl flex-1 pb-24 md:pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
