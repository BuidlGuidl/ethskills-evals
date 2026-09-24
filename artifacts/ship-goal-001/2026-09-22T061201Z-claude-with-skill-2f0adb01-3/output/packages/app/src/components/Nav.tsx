"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "./ConnectButton";
import { useMembership, useUsdcBalance } from "@/hooks/useToolshed";
import { formatUsdc } from "@/lib/format";

const LINKS = [
  { href: "/", label: "Browse" },
  { href: "/borrow", label: "My loans" },
  { href: "/lend", label: "My tools" },
];

export function Nav() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { isSteward, isMember } = useMembership();
  const balance = useUsdcBalance();

  const links = isSteward ? [...LINKS, { href: "/steward", label: "Steward" }] : LINKS;

  return (
    <header className="border-b border-shed-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          🧰 Toolshed
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={
                pathname === link.href
                  ? "rounded-lg bg-shed-100 px-3 py-1.5 text-sm font-medium"
                  : "rounded-lg px-3 py-1.5 text-sm text-shed-600 hover:bg-shed-100"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {isConnected && balance.data !== undefined && (
            <span className="hidden text-sm text-shed-600 sm:inline">{formatUsdc(balance.data as bigint)}</span>
          )}
          {isConnected && !isMember && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
              Not a member yet
            </span>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
