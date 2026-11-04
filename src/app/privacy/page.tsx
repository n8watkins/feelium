import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { PrivacyCard } from "@/components/privacy-card";
import { branding } from "@/config/branding";

export const metadata = { title: "Privacy" };

/** Public: someone deciding whether to sign in can read how their data is handled. */
export default function PublicPrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5 md:px-8">
        <Link href="/login" className="flex items-center gap-2 font-semibold">
          <BrandMark className="h-5" />
          {branding.appName}
        </Link>
        <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Sign in
        </Link>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-16 md:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <PrivacyCard dataHref="/settings/data" />
      </main>
    </div>
  );
}
