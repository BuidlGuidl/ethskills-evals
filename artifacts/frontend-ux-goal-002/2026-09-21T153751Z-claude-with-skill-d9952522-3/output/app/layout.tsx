import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Providers } from "./providers";
import "./globals.css";

const title = "USDC Pay: send USDC on Ethereum";
const description = "Send USDC on Ethereum to any address or ENS name. See your balances in dollars before you pay.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: title, template: "%s · USDC Pay" },
  description,
  applicationName: "USDC Pay",
  openGraph: { title, description, siteName: "USDC Pay", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main className="main">{children}</main>
          <footer className="footer muted">
            USDC on Ethereum mainnet · prices from Chainlink · transfers are final, double-check the recipient
          </footer>
        </Providers>
      </body>
    </html>
  );
}
