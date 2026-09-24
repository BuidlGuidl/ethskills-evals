"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export function Header() {
  return (
    <header className="header">
      <Link href="/pay" className="brand">
        <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="16" fill="#2775ca" />
          <path d="M10 17h9m0 0-3.5-3.5M19 17l-3.5 3.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(1.5 -1)" />
        </svg>
        USDC Pay
      </Link>
      <ConnectButton showBalance={false} chainStatus="icon" accountStatus={{ smallScreen: "avatar", largeScreen: "full" }} />
    </header>
  );
}
