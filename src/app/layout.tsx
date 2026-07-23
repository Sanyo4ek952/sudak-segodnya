import type { Metadata, Viewport } from "next";
import { getSiteUrl } from "@/shared/lib/seo";
import { AppShell } from "@/widgets/app-shell/ui/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: "Судак Сегодня",
  description: "Городская лента актуальных событий, объявлений и организаций Судака.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Судак Сегодня",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#166d88"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
