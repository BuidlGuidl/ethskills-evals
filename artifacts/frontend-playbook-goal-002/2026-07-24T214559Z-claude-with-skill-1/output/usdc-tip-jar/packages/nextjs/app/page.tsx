"use client";

import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { TipFeed } from "~~/components/tipjar/TipFeed";
import { TipForm } from "~~/components/tipjar/TipForm";
import { useDeployedContractInfo, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const usdc = (value: bigint | undefined) =>
  value !== undefined ? `${Number(formatUnits(value, USDC_DECIMALS)).toLocaleString()} USDC` : "—";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  const { data: tipJarInfo } = useDeployedContractInfo({ contractName: "TipJar" });
  const { data: totalTipped } = useScaffoldReadContract({ contractName: "TipJar", functionName: "totalTipped" });
  const { data: jarBalance } = useScaffoldReadContract({ contractName: "TipJar", functionName: "jarBalance" });
  const { data: tipCount } = useScaffoldReadContract({ contractName: "TipJar", functionName: "tipCount" });

  return (
    <div className="flex flex-col grow items-center pt-8 px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-2">USDC Tip Jar</h1>
        <p className="text-lg opacity-80 m-0">
          Drop a USDC tip on Base and leave a message. Every tip is recorded onchain and shows up in the live feed
          below.
        </p>
        <div className="flex justify-center items-center gap-2 mt-4 text-sm">
          <span className="opacity-70">Connected:</span>
          {connectedAddress ? (
            <Address address={connectedAddress} chain={targetNetwork} size="sm" onlyEnsOrAddress />
          ) : (
            <span className="opacity-50">not connected</span>
          )}
        </div>
      </div>

      <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-100 mt-8">
        <div className="stat place-items-center">
          <div className="stat-title">Total tipped</div>
          <div className="stat-value text-primary text-2xl">{usdc(totalTipped)}</div>
        </div>
        <div className="stat place-items-center">
          <div className="stat-title">In the jar</div>
          <div className="stat-value text-2xl">{usdc(jarBalance)}</div>
        </div>
        <div className="stat place-items-center">
          <div className="stat-title">Tips</div>
          <div className="stat-value text-2xl">{tipCount !== undefined ? tipCount.toString() : "—"}</div>
        </div>
      </div>

      {tipJarInfo?.address ? (
        <div className="flex items-center gap-2 mt-3 text-xs opacity-70">
          <span>Jar contract:</span>
          <Address address={tipJarInfo.address} chain={targetNetwork} size="xs" onlyEnsOrAddress />
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-6 mt-8 w-full max-w-4xl justify-center pb-12">
        <TipForm />
        <TipFeed />
      </div>
    </div>
  );
};

export default Home;
