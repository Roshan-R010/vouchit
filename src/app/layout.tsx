import type { Metadata } from "next";
import "./globals.css";
import "./uploads.css";

export const metadata: Metadata = {
  title: "Vouch — Warranty, made clear",
  description: "A fictional interactive demo of product registration and warranty claims.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
