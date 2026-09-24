import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CreditsBanner } from "@/components/CreditsBanner";

const DESCRIPTION = "A neighbourhood tool lending library. Borrow a drill, put down a USDC deposit, bring it back.";

export const metadata: Metadata = {
  title: "Toolshed",
  description: DESCRIPTION,
  // Set NEXT_PUBLIC_SITE_URL in production so shared links unfurl with absolute URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Toolshed",
    description: DESCRIPTION,
    type: "website",
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: "Toolshed" }],
  },
  twitter: { card: "summary", title: "Toolshed", description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-5xl px-4 pb-10 pt-6">
            <CreditsBanner />
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
