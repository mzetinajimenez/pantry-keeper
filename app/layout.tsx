import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pantry Keeper",
  description: "Scan and catalog the items in your pantry from your phone.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pantry",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-full text-slate-900 antialiased">{children}</body>
    </html>
  );
}
