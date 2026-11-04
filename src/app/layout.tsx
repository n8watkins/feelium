import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";

import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { branding } from "@/config/branding";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: branding.appName,
    template: `%s · ${branding.appName}`,
  },
  description: branding.appDescription,
  applicationName: branding.appName,
  appleWebApp: {
    capable: true,
    // "default": dark text on the light status bar; iOS switches it to light text in dark mode.
    statusBarStyle: "default",
    title: branding.appShortName,
    // Launch screens in the app's own light and dark backgrounds
    // (scripts/generate-splash.mjs), so the installed app never flashes white.
    startupImage: [
      {
        url: "/splash/1290x2796-light.png",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
      },
      {
        url: "/splash/1290x2796-dark.png",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/1179x2556-light.png",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
      },
      {
        url: "/splash/1179x2556-dark.png",
        media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/1170x2532-light.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
      },
      {
        url: "/splash/1170x2532-dark.png",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/750x1334-light.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: light)",
      },
      {
        url: "/splash/750x1334-dark.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/1640x2360-light.png",
        media: "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: light)",
      },
      {
        url: "/splash/1640x2360-dark.png",
        media: "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)",
      },
      {
        url: "/splash/1668x2388-light.png",
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: light)",
      },
      {
        url: "/splash/1668x2388-dark.png",
        media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // enables env(safe-area-inset-*) for the bottom nav
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The per-request CSP nonce from src/proxy.ts. Reading it also renders every page,
  // the 404 included, per request, so Next stamps the nonce on its own scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          nonce={nonce}
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/* Above the phone tab bar (h-16 plus the safe area), so toasts never cover it. */}
          <Toaster mobileOffset={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }} />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
