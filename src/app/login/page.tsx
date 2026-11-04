import { LandingPage } from "@/components/landing/landing-page";
import { SignInRoute } from "@/components/sign-in-dialog";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata = { title: "Sign in" };

/**
 * /login is the fallback that opens the sign-in dialog over the landing page: deep links,
 * the sign-out redirect, and signed-out visits to app pages (the proxy sends those here
 * with ?next=). Signed-in visitors are redirected to Today by the proxy.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <>
      <LandingPage />
      <SignInRoute next={safeRedirectPath(next ?? null, "/today")} error={error ? "Sign-in didn't go through. Please try again." : undefined} />
    </>
  );
}
