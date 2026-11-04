import type { SVGProps } from "react";

// The three tab icons, drawn to match the logo's rounded geometry (stroke 1.75, 24px).
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Today: a clock face. */
export function TodayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <path d="M12 7.5V12l3 2" {...stroke} />
    </svg>
  );
}

/** Insights: two overlapping circles, the logo's idea. */
export function InsightsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="9" cy="12" r="5.5" {...stroke} />
      <circle cx="15" cy="12" r="5.5" {...stroke} />
    </svg>
  );
}

/** Settings: two sliders. */
export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...stroke} />
      <circle cx="16" cy="7" r="2" {...stroke} />
      <circle cx="10" cy="17" r="2" {...stroke} />
    </svg>
  );
}
