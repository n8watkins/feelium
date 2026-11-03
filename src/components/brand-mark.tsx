import { cn } from "@/lib/utils";

/**
 * The Feelium mark: a grey disc and an ink disc (what you did, how you felt), with the
 * overlap in the page's own background. Colors come from the --logo-* tokens in
 * globals.css, so it follows light and dark mode.
 * brand/README.md has the exported files and colors.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="68 128 376 256"
      className={cn("h-6 w-auto shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="196" cy="256" r="118" fill="var(--logo-left)" />
      <circle cx="316" cy="256" r="118" fill="var(--logo-right)" />
      <path
        d="M 256.0 154.4 A 118 118 0 0 1 256.0 357.6 A 118 118 0 0 1 256.0 154.4 Z"
        fill="var(--logo-lens)"
      />
    </svg>
  );
}
