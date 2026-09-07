"use client";

import { useCallback } from "react";
import { JarStats } from "./_components/JarStats";
import { TipFeed } from "./_components/TipFeed";
import type { TipEntry } from "./_components/TipFeed";
import { TipForm } from "./_components/TipForm";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import {
  useDeployedContractInfo,
  useScaffoldReadContract,
  useScaffoldWatchContractEvent,
  useTargetNetwork,
} from "~~/hooks/scaffold-eth";
import { useTipJarToken } from "~~/hooks/tip-jar/useTipJarToken";
import { formatTokenAmount } from "~~/utils/tip-jar/format";

/** How many tips the feed pulls in one read. */
const FEED_SIZE = 25n;

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });
  const { tokenAddress, symbol, decimals, balance, refetchBalance } = useTipJarToken();

  const { data: owner } = useScaffoldReadContract({ contractName: "TipJar", functionName: "owner" });
  const {
    data: tips,
    isLoading: isLoadingTips,
    refetch: refetchTips,
  } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getRecentTips",
    args: [FEED_SIZE],
  });
  const { data: totalTipped, refetch: refetchTotal } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "totalTipped",
  });
  const { data: tipCount, refetch: refetchCount } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "tipCount",
  });
  const { data: jarBalance, refetch: refetchJarBalance } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "balance",
  });
  const { data: myTotal } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "tippedBy",
    args: [connectedAddress],
  });

  const refreshAll = useCallback(() => {
    void refetchTips();
    void refetchTotal();
    void refetchCount();
    void refetchJarBalance();
    void refetchBalance();
  }, [refetchTips, refetchTotal, refetchCount, refetchJarBalance, refetchBalance]);

  // Anyone's tip should show up here, not just our own.
  useScaffoldWatchContractEvent({
    contractName: "TipJar",
    eventName: "TipReceived",
    onLogs: refreshAll,
  });

  return (
    <div className="flex flex-col grow items-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold m-0">USDC Tip Jar</h1>
          <p className="mt-2 mb-0 opacity-70">
            Send {symbol} tips on {targetNetwork.name}, with a message that lives onchain.
          </p>
        </header>

        <JarStats
          totalTipped={totalTipped}
          tipCount={tipCount}
          jarBalance={jarBalance}
          owner={owner}
          symbol={symbol}
          decimals={decimals}
        />

        <TipForm
          jarAddress={tipJar?.address}
          tokenAddress={tokenAddress}
          symbol={symbol}
          decimals={decimals}
          balance={balance}
          onTipped={refreshAll}
        />

        {connectedAddress && myTotal !== undefined && myTotal > 0n && (
          <p className="text-center text-sm opacity-70 m-0">
            You have tipped {formatTokenAmount(myTotal, decimals)} {symbol} so far. Thank you.
          </p>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold m-0">Recent tips</h2>
            {tipCount !== undefined && tipCount > FEED_SIZE && (
              <span className="text-xs opacity-60">
                showing latest {FEED_SIZE.toString()} of {tipCount.toString()}
              </span>
            )}
          </div>
          <TipFeed
            tips={tips as readonly TipEntry[] | undefined}
            isLoading={isLoadingTips}
            symbol={symbol}
            decimals={decimals}
          />
        </section>

        <footer className="text-center text-xs opacity-60 flex flex-col items-center gap-1 pt-2">
          <div className="flex items-center gap-2">
            <span>Jar contract</span>
            {tipJar?.address && <Address address={tipJar.address} size="xs" chain={targetNetwork} />}
          </div>
          <div className="flex items-center gap-2">
            <span>{symbol}</span>
            {tokenAddress && <Address address={tokenAddress} size="xs" chain={targetNetwork} />}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
