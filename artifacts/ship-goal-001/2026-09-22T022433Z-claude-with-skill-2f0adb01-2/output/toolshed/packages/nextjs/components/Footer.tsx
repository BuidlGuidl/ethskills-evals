"use client";

import React from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { hardhat } from "viem/chains";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useToolshedAddress } from "~~/hooks/toolshed";

/**
 * Site footer. The contract address lives here on purpose: members are being asked to put real
 * money into an escrow, and they should be one click from reading it on a block explorer.
 */
export const Footer = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const toolshed = useToolshedAddress();

  return (
    <div className="min-h-0 px-1 py-5 mb-11 lg:mb-0">
      <div>
        <div className="fixed bottom-0 left-0 z-10 flex w-full items-center justify-between p-4 pointer-events-none">
          <div className="pointer-events-auto flex flex-col gap-2 md:flex-row">
            {isLocalNetwork && (
              <>
                <Faucet />
                <Link href="/blockexplorer" passHref className="btn btn-primary btn-sm gap-1 font-normal">
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <span>Block Explorer</span>
                </Link>
              </>
            )}
          </div>
          <SwitchTheme className={`pointer-events-auto ${isLocalNetwork ? "self-end md:self-auto" : ""}`} />
        </div>
      </div>

      <div className="w-full border-t border-base-300 pt-4">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 text-sm">
          <span className="font-bold">Toolshed</span>
          <span className="opacity-40">·</span>
          <span className="opacity-70">Deposits are held in escrow by</span>
          {toolshed ? (
            <Address address={toolshed} size="sm" />
          ) : (
            <span className="opacity-70">a contract not yet deployed on {targetNetwork.name}</span>
          )}
          <span className="opacity-40">·</span>
          <Link href="/members" className="link">
            Track records
          </Link>
        </div>
      </div>
    </div>
  );
};
