/**
 * Single source of truth for all brand-facing identity: product name, PWA manifest
 * fields, icon references, and key marketing copy.
 *
 * Fleet requirement: NOTHING else in the codebase should hardcode the product name or
 * brand copy. Import from here instead, so the real product name can drop in by editing
 * this one file. The product is officially "Untitled" for now - this is a deliberate,
 * neutral placeholder.
 */

/** Neutral placeholder product name. Replace here (and only here) when branding lands. */
const APP_NAME = "Untitled";

/** Short name used where space is tight (PWA home-screen label, headers). */
const APP_SHORT_NAME = "Untitled";

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
 * foundation shipped a single scalable SVG mark; Phase 6 (PWA) added the rasterized
 * PNG sizes and maskable variant. The PNGs are derived from the SVG by
 * `node scripts/generate-pwa-icons.mjs`; the iOS apple-touch icon lives at
 * src/app/apple-icon.png (Next file convention).
 */
const ICONS = {
  svg: "/icon.svg",
  favicon: "/favicon.ico",
  png192: "/icon-192.png",
  png512: "/icon-512.png",
  maskable512: "/icon-maskable-512.png",
} as const;

const MANIFEST_ICONS: BrandIcon[] = [
  // Scalable SVG first for browsers that honor it; raster PNGs guarantee installability
  // (Chromium favors a concrete 192/512) and a dedicated maskable icon for Android masks.
  { src: ICONS.svg, sizes: "any", type: "image/svg+xml", purpose: "any" },
  { src: ICONS.png192, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: ICONS.png512, sizes: "512x512", type: "image/png", purpose: "any" },
  { src: ICONS.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
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
