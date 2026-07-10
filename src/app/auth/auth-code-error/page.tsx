import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign-in link expired
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          That sign-in link is invalid or has already been used. Request a new one to
          continue.
        </p>
      </div>
      <Button asChild>
        <Link href="/login">Back to sign in</Link>
      </Button>
    </main>
  );
}
