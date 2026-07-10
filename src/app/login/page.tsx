import { branding } from "@/config/branding";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; next?: string }>;
}) {
  const { error, sent, next } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {branding.appName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {branding.copy.authSubtitle}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              We&apos;ll email you a magic link. No password required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <p
                role="status"
                className="rounded-md border border-border bg-muted px-3 py-2 text-sm"
              >
                {branding.copy.magicLinkSent}
              </p>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <form className="space-y-4">
              <input type="hidden" name="next" value={next ?? ""} />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <Button
                type="submit"
                formAction={sendMagicLink}
                className="w-full"
              >
                Email me a magic link
              </Button>

              <div className="relative py-1 text-center text-xs text-muted-foreground">
                <span className="relative z-10 bg-card px-2">
                  or use a password
                </span>
                <span className="absolute inset-x-0 top-1/2 -z-0 border-t border-border" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  formAction={signInWithPassword}
                  variant="outline"
                  className="flex-1"
                >
                  Sign in
                </Button>
                <Button
                  type="submit"
                  formAction={signUpWithPassword}
                  variant="ghost"
                  className="flex-1"
                >
                  Create account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {branding.copy.tagline}
        </p>
      </div>
    </main>
  );
}
