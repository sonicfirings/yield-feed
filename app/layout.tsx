import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Halcyon",
  description: "A USDC-native pool dashboard built on Arc testnet."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
