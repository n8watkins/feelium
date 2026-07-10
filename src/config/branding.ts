/**
 * Single source of truth for all brand-facing identity: product name, PWA manifest
 * fields, icon references, and key marketing copy.
 *
 * Fleet requirement: NOTHING else in the codebase should hardcode the product name or
 * brand copy. Import from here instead, so the product name lives in exactly one place.
 */

/** Product name. */
const APP_NAME = "feelium";

/** Short name used where space is tight (PWA home-screen label, headers). */
const APP_SHORT_NAME = "feelium";

/** One-line description of what the product does. */
const APP_DESCRIPTION =
  "A personal tracker for connecting what you do with how you feel.";

export type BrandIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: "any" | "maskable" | "monochrome";
};

/**
 * Icon references live here so swapping artwork is a one-file change. The Phase 1
 * foundation ships a single scalable SVG mark; rasterized PNG sizes and an
 * apple-touch-icon are a Phase 6 (PWA polish) follow-up.
 */
const ICONS = {
  svg: "/icon.svg",
  favicon: "/favicon.ico",
} as const;

const MANIFEST_ICONS: BrandIcon[] = [
  { src: ICONS.svg, sizes: "any", type: "image/svg+xml", purpose: "any" },
  { src: ICONS.svg, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
];

export const branding = {
  appName: APP_NAME,
  appShortName: APP_SHORT_NAME,
  appDescription: APP_DESCRIPTION,

  /** Key brand copy, kept here so tone stays consistent and easy to rebrand. */
  copy: {
    tagline: "What did I do, how did I feel, and are they connected?",
    authSubtitle: "Sign in to record what you did and how you felt.",
    magicLinkSent:
      "Check your email for the sign-in link. In local development it is printed to the server console instead.",
  },

  icons: ICONS,

  /**
   * PWA manifest fields consumed by src/app/manifest.ts. Colors are neutral to match
   * the placeholder brand.
   */
  manifest: {
    name: APP_NAME,
    shortName: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    startUrl: "/today",
    display: "standalone" as const,
    themeColor: "#ffffff",
    backgroundColor: "#ffffff",
    icons: MANIFEST_ICONS,
  },
} as const;

export type Branding = typeof branding;
