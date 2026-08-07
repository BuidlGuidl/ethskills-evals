"use client";

import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { JarSummary } from "~~/app/_components/JarSummary";
import { TipFeed } from "~~/app/_components/TipFeed";
import { TipForm } from "~~/app/_components/TipForm";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  return (
    <div className="flex flex-col grow items-center px-4 py-10 gap-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-2">USDC Tip Jar</h1>
        <p className="text-lg opacity-80">Send USDC tips on Base and watch them land in the live feed.</p>
        <div className="flex justify-center items-center gap-2 mt-3 text-sm">
          <span className="opacity-70">Connected:</span>
          <Address address={connectedAddress} chain={targetNetwork} size="sm" />
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <JarSummary />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-5xl items-start">
        <TipForm />
        <TipFeed />
      </div>
    </div>
  );
};

export default Home;
