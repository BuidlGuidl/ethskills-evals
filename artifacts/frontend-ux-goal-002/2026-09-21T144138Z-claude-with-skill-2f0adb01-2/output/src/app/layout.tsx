import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
if (!process.env.NEXT_PUBLIC_SITE_URL && process.env.NODE_ENV === "production") {
  console.warn("NEXT_PUBLIC_SITE_URL not set: social preview images will point at localhost.");
}
const title = "USDC Pay: send USDC on Ethereum";
const description = "Send USDC to any Ethereum address or ENS name, straight from your wallet.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s · USDC Pay" },
  description,
  applicationName: "USDC Pay",
  openGraph: { type: "website", siteName: "USDC Pay", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
