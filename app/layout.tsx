import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yield Feed",
  description: "ARC testnet yield opportunities ranked by risk-adjusted return."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
