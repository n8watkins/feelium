"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

/** Light, dark or system, as one segmented control (a radio group). */
export function ThemeControl() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render no selection on the server.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const current = mounted ? (theme ?? "system") : null;
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-full bg-muted p-1 text-sm font-medium">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={current === option.value}
          onClick={() => setTheme(option.value)}
          className={
            current === option.value
              ? "h-8 rounded-full bg-primary px-3.5 text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              : "h-8 rounded-full px-3.5 text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
