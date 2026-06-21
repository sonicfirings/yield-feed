import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARC Yield Pool",
  description: "Owner-operated ARC testnet yield pool with transparent 5% estimated APY."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
