import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bitmapverse v0.1 — Portal experimental",
  description:
    "Demostración privada de resolución determinista y tránsito verificable entre territorios Bitmap.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
