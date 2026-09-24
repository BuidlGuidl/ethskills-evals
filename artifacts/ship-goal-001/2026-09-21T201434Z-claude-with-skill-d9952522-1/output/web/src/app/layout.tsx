import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "@/components/Providers";
import { ConnectButton } from "@/components/ConnectButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Toolshed",
  description: "A lending library for the neighborhood association.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="site-header">
            <Link href="/" className="brand">
              Toolshed
            </Link>
            <nav>
              <Link href="/">Browse</Link>
              <Link href="/listings/new">Lend a tool</Link>
              <Link href="/loans">My loans</Link>
              <Link href="/members">Neighbors</Link>
            </nav>
            <ConnectButton />
          </header>
          <main className="container">{children}</main>
          <footer className="site-footer">
            Deposits are held by an open-source escrow contract with no admin keys. Late fees come out of the
            deposit and go to the tool&rsquo;s owner.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
