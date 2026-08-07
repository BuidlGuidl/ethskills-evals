"use client";

import { TipFeed } from "./_components/TipFeed";
import { TipForm } from "./_components/TipForm";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatUnits } from "viem";
import { useScaffoldContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

const TipJarPage: NextPage = () => {
  const { data: tipJar } = useScaffoldContract({ contractName: "TipJar" });

  const { data: totalTipped } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "totalTipped",
  });

  const { data: tipCount } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "tipCount",
  });

  return (
    <div className="flex flex-col items-center grow w-full px-5 py-10">
      <div className="w-full max-w-5xl flex flex-col gap-8">
        <header className="text-center flex flex-col items-center gap-2">
          <h1 className="text-4xl font-bold m-0">💸 USDC Tip Jar</h1>
          <p className="opacity-80 m-0">Send USDC tips on Base and leave a message.</p>
          {tipJar?.address && (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <span>Jar:</span>
              <Address address={tipJar.address} size="sm" />
            </div>
          )}
        </header>

        <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-100 w-full">
          <div className="stat">
            <div className="stat-title">Total tipped</div>
            <div className="stat-value text-primary">
              {formatUnits(totalTipped ?? 0n, USDC_DECIMALS)} <span className="text-2xl">USDC</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">Tips received</div>
            <div className="stat-value">{tipCount !== undefined ? tipCount.toString() : "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <TipForm />
          <TipFeed />
        </div>
      </div>
    </div>
  );
};

export default TipJarPage;
