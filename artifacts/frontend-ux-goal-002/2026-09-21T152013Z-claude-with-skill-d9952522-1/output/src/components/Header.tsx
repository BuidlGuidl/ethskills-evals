"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-4">
      <Link href="/pay" className="flex items-center gap-2 text-lg font-bold">
        <img src="/logo.svg" alt="" width={28} height={28} />
        Settle
      </Link>
      <ConnectButton chainStatus="icon" showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "full" }} />
    </header>
  );
}
