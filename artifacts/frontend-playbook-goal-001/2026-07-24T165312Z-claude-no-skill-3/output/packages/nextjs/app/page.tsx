"use client";

import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { JarStats } from "~~/components/tipjar/JarStats";
import { TipFeed } from "~~/components/tipjar/TipFeed";
import { TipForm } from "~~/components/tipjar/TipForm";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="flex flex-col items-center grow w-full px-5 py-10">
      <div className="w-full max-w-5xl flex flex-col gap-8">
        <header className="text-center flex flex-col items-center gap-2">
          <h1 className="text-4xl font-bold m-0">USDC Tip Jar</h1>
          <p className="text-base-content/70 m-0">
            Tip in USDC on Base. Every tip and message lands in the feed below.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-base-content/60">Connected:</span>
            <Address address={connectedAddress} chain={targetNetwork} size="sm" />
          </div>
        </header>

        <JarStats />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <TipForm />
          <TipFeed />
        </div>
      </div>
    </div>
  );
};

export default Home;
