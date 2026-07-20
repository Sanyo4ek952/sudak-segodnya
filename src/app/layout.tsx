import type { Metadata, Viewport } from "next";
import { PublicNavigation } from "@/widgets/public-navigation/ui/public-navigation";
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
        <PublicNavigation />
        <main className="mx-auto min-h-screen w-full max-w-content px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
