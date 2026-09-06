import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Smart Market Watchlist",
    template: "%s | Smart Market Watchlist",
  },
  description:
    "A market watchlist that explains what meaningfully changed since your last review.",
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