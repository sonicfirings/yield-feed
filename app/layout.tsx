import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yield Feed",
  description: "Daily ranked stablecoin and crypto yield opportunities."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
