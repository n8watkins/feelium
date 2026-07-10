import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { ensureProfile } from "@/server/data";

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

  await ensureProfile();

  return (
    <div className="flex min-h-dvh">
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
