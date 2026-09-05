"use client";

import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { JarStats, OwnerPanel, TipFeed, TipForm } from "~~/components/tip-jar";
import { BASE_USDC_ADDRESS } from "~~/contracts/externalContracts";
import { useDeployedContractInfo, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });
  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });

  return (
    <div className="flex flex-col items-center grow w-full px-4 sm:px-8 py-10">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold m-0">🫙 USDC Tip Jar</h1>
          <p className="text-lg opacity-70 mt-2 mb-4">Say thanks in USDC on Base.</p>
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="opacity-60">Jar</span>
              <Address address={tipJar?.address} size="sm" chain={targetNetwork} />
            </span>
            <span className="flex items-center gap-2">
              <span className="opacity-60">Owner</span>
              <Address address={owner} size="sm" chain={targetNetwork} />
            </span>
            <span className="flex items-center gap-2">
              <span className="opacity-60">USDC</span>
              <Address address={BASE_USDC_ADDRESS} size="sm" chain={targetNetwork} />
            </span>
          </div>
          {connectedAddress && (
            <p className="text-sm opacity-60 mt-3 mb-0">
              Connected as <span className="font-mono">{connectedAddress}</span>
            </p>
          )}
        </header>

        <JarStats />
        <OwnerPanel />

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-2/5">
            <TipForm />
          </div>
          <div className="w-full lg:w-3/5">
            <TipFeed />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
