import type { Metadata, Viewport } from "next";
import { AppShell } from "@/widgets/app-shell/ui/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Судак Сегодня",
  description: "Городская лента актуальных событий, объявлений и организаций Судака."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f9fa"
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
