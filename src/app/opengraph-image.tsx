import { branding } from "@/config/branding";
import { OG_SIZE, PhoneShot, dataUrl, shareCard } from "@/lib/og-card";
import { readPublicFile } from "@/lib/publicFile";

// The share card (Open Graph and Twitter): the n8builds family layout in
// feelium's monochrome, with the Today check-in on a phone on the right.

export const alt = `${branding.appName}: connect what you do with how you feel.`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  // Geist (OFL, public/og/Geist-LICENSE.txt), the marks and the screenshot, from public/.
  const [medium, bold, mark, n8, shot] = await Promise.all([
    readPublicFile("/og/Geist-Medium.ttf"),
    readPublicFile("/og/Geist-Bold.ttf"),
    readPublicFile("/og/feelium-tile.svg"),
    readPublicFile("/og/n8-icon.png"),
    readPublicFile("/og/today-checkin.jpg"),
  ]);

  return shareCard({
    colors: {
      bg: "#ffffff",
      bgImage: "radial-gradient(circle at 80% 50%, rgba(0,0,0,0.05), rgba(255,255,255,0) 55%)",
      ink: "#0a0a0a",
      muted: "#737373",
      body: "#404040",
      accent: "#0a0a0a",
    },
    font: "Geist",
    fonts: [
      { name: "Geist", data: medium, weight: 500 },
      { name: "Geist", data: bold, weight: 800 },
    ],
    logo: dataUrl(mark, "image/svg+xml"),
    n8Icon: dataUrl(n8, "image/png"),
    host: "feelium.n8builds.dev",
    name: branding.appName,
    nameTracking: -3,
    tagline: "Connect what you do with how you feel. A few taps a day, then see the pattern.",
    visual: (
      <PhoneShot
        src={dataUrl(shot, "image/jpeg")}
        width={780}
        height={1328}
        bezel="#0a0a0a"
        shadow="0 30px 70px rgba(0,0,0,0.18)"
      />
    ),
  });
}
