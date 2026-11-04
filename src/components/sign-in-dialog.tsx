"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useRef, useState, type ReactNode } from "react";

import { signInWithGitHub } from "@/app/login/actions";
import { BrandMark } from "@/components/brand-mark";
import { branding } from "@/config/branding";
import { cn } from "@/lib/utils";

/** Official GitHub mark. Decorative: the button's text is its label. */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * Sign-in, over whatever page you are on: a bottom sheet on phones, a centered dialog
 * from sm up. GitHub is the only way in; `next` is where you land afterwards. Radix
 * provides the focus trap, Escape, and the dialog's labelling.
 */
export function SignInDialog({
  open,
  onOpenChange,
  next,
  error,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  next: string;
  error?: string;
  /** The button that opens it; focus returns there when it closes. */
  trigger?: ReactNode;
}) {
  const continueRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          // Start on the one action, so Enter signs in.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            continueRef.current?.focus();
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:pb-6",
            "sm:data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start justify-between">
            <BrandMark className="h-7" />
            <Dialog.Close
              className="-m-2 rounded-full p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <Dialog.Title className="mt-5 text-2xl font-semibold tracking-tight">
            Sign in to {branding.appName}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your check-ins stay private to your account. You&apos;ll come right back
            {next === "/" || next === "/today" ? "." : " to where you were."}
          </Dialog.Description>
          {error ? (
            <p role="alert" className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-red-700 dark:text-destructive">
              {error}
            </p>
          ) : null}
          <form action={signInWithGitHub} className="mt-6">
            <input type="hidden" name="next" value={next} />
            <button
              ref={continueRef}
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <GitHubMark />
              Continue with GitHub
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            New here? The same button creates your account.{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              How your data is handled
            </Link>
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A button that opens the sign-in dialog, returning to this page afterwards. */
export function SignInButton({ className, children, next }: { className?: string; children: ReactNode; next?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <SignInDialog
      open={open}
      onOpenChange={setOpen}
      next={next ?? (pathname === "/" ? "/today" : pathname)}
      trigger={
        <button type="button" className={className}>
          {children}
        </button>
      }
    />
  );
}

/**
 * /login: the landing page with the dialog already open (deep links, the sign-out
 * redirect, a signed-out visit to an app page). Closing it leaves you on the landing page.
 */
export function SignInRoute({ next, error }: { next: string; error?: string }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  return (
    <SignInDialog
      open={open}
      next={next}
      error={error}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) router.replace("/", { scroll: false });
      }}
    />
  );
}
