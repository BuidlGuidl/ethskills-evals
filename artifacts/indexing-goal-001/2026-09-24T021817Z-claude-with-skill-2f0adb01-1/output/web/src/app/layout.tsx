import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Streak",
  description: "Daily onchain check-ins for the community, on Base.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="top">
            <h1>
              <Link href="/">Streak</Link>
            </h1>
            <nav>
              <Link href="/">Feed</Link>
              <Link href="/leaderboard">Leaderboard</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
