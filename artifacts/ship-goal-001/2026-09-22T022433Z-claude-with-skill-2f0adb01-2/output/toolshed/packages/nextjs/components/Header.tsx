"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import {
  Bars3Icon,
  BugAntIcon,
  ClipboardDocumentCheckIcon,
  PlusCircleIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Browse",
    href: "/",
    icon: <WrenchScrewdriverIcon className="h-4 w-4" />,
  },
  {
    label: "Your shed",
    href: "/dashboard",
    icon: <ClipboardDocumentCheckIcon className="h-4 w-4" />,
  },
  {
    label: "Lend something",
    href: "/list",
    icon: <PlusCircleIcon className="h-4 w-4" />,
  },
  {
    label: "Neighbors",
    href: "/members",
    icon: <UsersIcon className="h-4 w-4" />,
  },
  {
    label: "Steward",
    href: "/steward",
  },
];

/** Developer-only, kept off the member-facing nav but still reachable at /debug. */
export const devMenuLinks: HeaderMenuLink[] = [
  {
    label: "Debug Contracts",
    href: "/debug",
    icon: <BugAntIcon className="h-4 w-4" />,
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = pathname === href;
        return (
          <li key={href} className="h-full">
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "bg-base-300" : ""
              } hover:bg-base-300 focus:!bg-base-300 h-full px-4 text-sm gap-2 flex items-center whitespace-nowrap`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky lg:static top-0 navbar bg-base-100 min-h-16 shrink-0 justify-between z-20 border-b-2 border-base-300 p-0 sm:px-2">
      <div className="navbar-start w-auto min-w-0 self-stretch">
        <details className="dropdown" ref={burgerMenuRef}>
          <summary className="ml-1 btn btn-ghost lg:hidden hover:bg-transparent">
            <Bars3Icon className="h-1/2" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content mt-3 p-2 shadow-lg bg-base-100 w-52"
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
        {/* The brand shrinks rather than pushing the connect button off a 375px screen. */}
        <Link href="/" passHref className="ml-1 mr-2 flex min-w-0 items-center gap-2 lg:ml-4 lg:mr-6">
          <div className="relative flex h-10 w-8 shrink-0 items-center justify-center text-2xl">🪚</div>
          {/* On a phone the saw alone is the brand: the wordmark would collide with the wallet
              controls, which matter more on a small screen than our name does. */}
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="truncate font-black leading-tight tracking-tight">Toolshed</span>
            <span className="hidden text-xs opacity-70 md:block">Neighborhood lending library</span>
          </div>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap h-full m-0 p-0 list-none">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end mr-2 min-w-0 shrink grow sm:mr-4">
        <RainbowKitCustomConnectButton />
        {isLocalNetwork && <FaucetButton />}
      </div>
    </div>
  );
};
