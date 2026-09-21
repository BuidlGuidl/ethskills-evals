import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const description = "Send USDC to any Ethereum address or ENS name. Non-custodial, straight from your wallet.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Settle — Send USDC", template: "%s · Settle" },
  description,
  applicationName: "Settle",
  openGraph: { title: "Settle — Send USDC", description, siteName: "Settle", type: "website" },
  twitter: { card: "summary_large_image", title: "Settle — Send USDC", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
