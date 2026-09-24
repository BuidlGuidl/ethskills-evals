import type {Metadata} from "next";
import Link from "next/link";

import {ConnectButton, SessionProvider} from "@/components/session.tsx";
import {Providers} from "@/components/providers.tsx";

import "./globals.css";

export const metadata: Metadata = {
  title: "Toolshed",
  description: "The neighbourhood association's lending library.",
};

const NAV = [
  {href: "/", label: "Browse"},
  {href: "/requests", label: "Requests"},
  {href: "/loans", label: "Loans"},
  {href: "/tools/mine", label: "My tools"},
];

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SessionProvider>
            <header className="border-b border-stone-200 bg-white">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
                <Link href="/" className="text-lg font-semibold tracking-tight">
                  Toolshed
                </Link>
                <nav className="flex gap-4 text-sm text-stone-600">
                  {NAV.map((item) => (
                    <Link key={item.href} href={item.href} className="hover:text-stone-900">
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="ml-auto">
                  <ConnectButton />
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
          </SessionProvider>
        </Providers>
      </body>
    </html>
  );
}
