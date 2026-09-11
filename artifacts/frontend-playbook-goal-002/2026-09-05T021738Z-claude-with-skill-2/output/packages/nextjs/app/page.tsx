"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { BugAntIcon } from "@heroicons/react/24/outline";
import { JarStats, TipFeed, TipForm } from "~~/components/tipjar";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useUsdc } from "~~/hooks/useUsdc";

const Home: NextPage = () => {
  const { isConnected } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { tokenAddress, tipJarAddress } = useUsdc();

  return (
    <div className="flex flex-col grow items-center pt-10 pb-16 px-5">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">🫙 USDC Tip Jar</h1>
        <p className="opacity-80 max-w-xl">
          Send a tip in USDC on Base and leave a note. Every tip is stored onchain, so the feed below comes straight
          from the contract.
        </p>
        {!isConnected && <p className="text-sm opacity-60 mt-2">Connect a wallet in the header to get started.</p>}
      </div>

      <JarStats />

      <div className="flex flex-col lg:flex-row gap-8 mt-10 w-full justify-center items-start">
        <div className="flex justify-center w-full lg:w-auto">
          <TipForm />
        </div>
        <div className="flex justify-center w-full lg:w-auto">
          <TipFeed />
        </div>
      </div>

      <div className="mt-12 text-xs opacity-60 text-center space-y-1">
        <p>
          Network: <span className="font-mono">{targetNetwork.name}</span> (chain id {targetNetwork.id})
        </p>
        <p>
          TipJar: <span className="font-mono break-all">{tipJarAddress ?? "not deployed"}</span>
        </p>
        <p>
          USDC: <span className="font-mono break-all">{tokenAddress ?? "—"}</span>
        </p>
        <p className="flex items-center justify-center gap-1 pt-2">
          <BugAntIcon className="h-4 w-4" />
          Poke at the contract directly in the{" "}
          <Link href="/debug" className="link">
            Debug Contracts
          </Link>{" "}
          tab.
        </p>
      </div>
    </div>
  );
};

export default Home;
