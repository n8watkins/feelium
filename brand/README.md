# Feelium brand

The Feelium mark is two overlapping discs, what you did and how you felt.
It is black and white: one disc is grey, the other is ink (or paper on dark), and the overlap takes the opposite tone, so the place where they meet stands out without any color.

## Colors

| Name | Hex | Use |
| --- | --- | --- |
| Ink | `#0A0A0A` | The tile background; the right disc on light surfaces; the overlap on dark surfaces. |
| Paper | `#FAFAFA` | The right disc on dark surfaces and on the tile; the overlap on light surfaces. |
| Grey light | `#A3A3A3` | The left disc on light surfaces, and in the dark-mode favicon (it separates better on dark tab bars at 16 px). |
| Grey dark | `#737373` | The left disc on the tile and on dark surfaces. |

There is no accent color. Do not add a hue to the mark.

## Which file to use where

| File | What it is | Use it for |
| --- | --- | --- |
| `feelium-tile.svg`, `feelium.png` (512), `feelium-tile-1024.png` | The mark on a rounded ink tile | Anywhere a solid background is needed: the GitHub OAuth app logo (`feelium.png`, since the light grey disc would vanish on a white page), avatars, app listings, social cards. |
| `feelium-mark-light.svg`, `.png` (512 wide), `-1024.png` | Light grey and ink discs, paper overlap, transparent | Light backgrounds: docs, slides. |
| `feelium-mark-dark.svg`, `.png` (512 wide), `-1024.png` | Dark grey and paper discs, ink overlap, transparent | Dark backgrounds. |
| `feelium-favicon.svg` | The bare mark, switching between the light and dark versions with the browser's color scheme | The browser-tab icon. `npm run icons` copies it to `src/app/icon.svg`. |
| `feelium-tile-square.svg` | The tile without rounded corners | The Apple touch icon, which iOS rounds itself. |
| `feelium-tile-maskable.svg` | The square tile with the mark scaled to 72%, inside the maskable safe zone | Android maskable icons. |

Leave clear space around the mark of at least a tenth of its width.

## In the app

- Pages use the inline `BrandMark` component (`src/components/brand-mark.tsx`). Its colors follow the `--logo-left`, `--logo-right` and `--logo-lens` tokens in `src/app/globals.css` (the overlap uses the page background), so it switches with light and dark mode and is never duplicated as an image.
- `src/app/icon.svg` is the favicon and `src/app/favicon.ico` its fallback; `src/app/apple-icon.png` is the iOS icon. Next links all three.
- The PWA manifest uses `public/icon-192.png`, `public/icon-512.png` and the two `public/icon-maskable-*.png` files.
- `npm run icons` renders every PNG and the ICO from the SVGs here. Run it after changing a source, and commit the output.
