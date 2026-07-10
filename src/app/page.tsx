import { redirect } from "next/navigation";

/**
 * The MVP has no distinct marketing landing page. Send visitors to Today; the proxy
 * redirects unauthenticated users to /login.
 */
export default function RootPage() {
  redirect("/today");
}
