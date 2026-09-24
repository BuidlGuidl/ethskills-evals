import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { WalletButton } from "@/components/WalletButton";
import { APP_DESCRIPTION, APP_NAME, EXPLORER_URL, USDC } from "@/lib/constants";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${APP_NAME} — Send USDC on Ethereum`, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Send USDC on Ethereum`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Send USDC on Ethereum`,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-5">
            <Link href="/pay" className="flex items-center gap-2 text-lg font-semibold">
              <img src="/icon.svg" alt="" width={28} height={28} />
              {APP_NAME}
            </Link>
            <WalletButton />
          </header>
          <main className="mx-auto max-w-xl px-4 pb-16">{children}</main>
          <footer className="mx-auto max-w-xl px-4 pb-8 text-xs text-muted">
            Transfers use Circle&apos;s USDC on Ethereum mainnet (
            <a href={`${EXPLORER_URL}/token/${USDC.address}`} target="_blank" rel="noreferrer" className="underline">
              {USDC.address}
            </a>
            ). USD values from Chainlink price feeds. Transactions are final and can&apos;t be reversed.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
