import Link from "next/link";
import "./globals.css";

export const metadata = { title: "Streak", description: "Daily onchain check-ins on Base" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/feed" className="brand">
            Streak
          </Link>
          <nav>
            <Link href="/feed">Feed</Link>
            <Link href="/leaderboard">Leaderboard</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
