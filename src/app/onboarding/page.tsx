import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { OnboardingSetup } from "@/components/onboarding/onboarding-setup";
import { branding } from "@/config/branding";
import { ensureProfile, getTrackingCounts } from "@/server/data";

export const metadata = { title: "Set up tracking" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await ensureProfile();

  // Never re-run onboarding once the system is no longer blank.
  const counts = await getTrackingCounts();
  if (counts.behaviors > 0 || counts.outcomes > 0) {
    redirect("/today");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-10">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up what you&apos;ll track
        </h1>
        <p className="text-sm text-muted-foreground">
          {branding.copy.tagline} Choose how to start - you can change everything later
          in Settings.
        </p>
      </div>
      <OnboardingSetup />
    </main>
  );
}
