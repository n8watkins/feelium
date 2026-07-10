import type { MetadataRoute } from "next";

import { branding } from "@/config/branding";

/**
 * PWA manifest, served at /manifest.webmanifest. All values come from the single
 * branding config module so rebranding is a one-file change.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: branding.manifest.name,
    short_name: branding.manifest.shortName,
    description: branding.manifest.description,
    start_url: branding.manifest.startUrl,
    display: branding.manifest.display,
    background_color: branding.manifest.backgroundColor,
    theme_color: branding.manifest.themeColor,
    icons: branding.manifest.icons.map((icon) => ({
      src: icon.src,
      sizes: icon.sizes,
      type: icon.type,
      purpose: icon.purpose,
    })),
  };
}
