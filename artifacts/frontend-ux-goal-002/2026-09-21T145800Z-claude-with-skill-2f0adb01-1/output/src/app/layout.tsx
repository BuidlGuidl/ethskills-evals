import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { env } from "@/lib/env";
import { APP_NAME } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

const description = "Send USDC on Ethereum to any address or ENS name.";

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description,
  applicationName: APP_NAME,
  openGraph: { type: "website", siteName: APP_NAME, title: APP_NAME, description },
  twitter: { card: "summary_large_image", title: APP_NAME, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Providers>
          <header className="border-b border-border bg-surface">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/pay" className="flex items-center gap-2 font-semibold">
                <span className="grid size-7 place-items-center rounded-full bg-accent text-sm text-accent-foreground">$</span>
                {APP_NAME}
              </Link>
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
            </div>
          </header>
          <main className="mx-auto max-w-xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
