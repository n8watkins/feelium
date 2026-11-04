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
 * Icon references. The sources are the SVGs in brand/ (see brand/README.md); `npm run
 * icons` renders the PNGs, src/app/favicon.ico, src/app/icon.svg (the favicon, served at
 * /icon.svg) and src/app/apple-icon.png (Next file conventions).
 */
const ICONS = {
  svg: "/icon.svg",
  favicon: "/favicon.ico",
  png192: "/icon-192.png",
  png512: "/icon-512.png",
  maskable192: "/icon-maskable-192.png",
  maskable512: "/icon-maskable-512.png",
} as const;

const MANIFEST_ICONS: BrandIcon[] = [
  // The rounded tile for "any", and a square tile with the mark in the safe zone for
  // Android masks. (The SVG favicon switches colors with the browser theme, so it is left
  // out here: an installed icon needs its own background.)
  { src: ICONS.png192, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: ICONS.png512, sizes: "512x512", type: "image/png", purpose: "any" },
  { src: ICONS.maskable192, sizes: "192x192", type: "image/png", purpose: "maskable" },
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
