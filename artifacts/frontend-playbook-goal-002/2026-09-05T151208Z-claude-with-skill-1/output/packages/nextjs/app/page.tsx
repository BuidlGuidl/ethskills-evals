"use client";

import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { JarStats, OwnerPanel, TipFeed, TipForm } from "~~/components/tip-jar";
import { USDC_ADDRESS } from "~~/contracts/externalContracts";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="flex flex-col grow items-center w-full px-5 py-10">
      <div className="w-full max-w-5xl flex flex-col gap-8">
        <header className="text-center flex flex-col items-center gap-3">
          <h1 className="text-4xl sm:text-5xl font-bold m-0">USDC Tip Jar</h1>
          <p className="text-lg opacity-70 m-0">
            Drop a tip and leave a message. Every tip is settled in USDC on Base and stored onchain.
          </p>
          <div className="flex items-center gap-2 text-sm opacity-70">
            <span>Tips are paid in USDC at</span>
            <Address address={USDC_ADDRESS} chain={targetNetwork} size="sm" onlyEnsOrAddress />
          </div>
          {isConnected && (
            <div className="flex items-center gap-2 text-sm">
              <span className="opacity-70">Connected as</span>
              <Address address={connectedAddress} chain={targetNetwork} size="sm" />
            </div>
          )}
        </header>

        <JarStats />

        <OwnerPanel />

        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <TipForm />
          <TipFeed />
        </div>
      </div>
    </div>
  );
};

export default Home;
