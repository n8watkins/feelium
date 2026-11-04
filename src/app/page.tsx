import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/landing-page";

/**
 * "/": the landing page for signed-out visitors; signed-in visitors go straight to Today
 * (decided on the server from the session cookie, so there is no flash). The installed
 * app starts at /today and never sees this page.
 */
export default async function RootPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/today");
  return <LandingPage />;
}
