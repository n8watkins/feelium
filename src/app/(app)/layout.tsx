import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout for the authenticated app. Guards every child route with a server-side
 * `getUser()` check (defense in depth alongside the proxy) and renders the mobile-first
 * shell: desktop sidebar + scrollable main + mobile bottom navigation.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
