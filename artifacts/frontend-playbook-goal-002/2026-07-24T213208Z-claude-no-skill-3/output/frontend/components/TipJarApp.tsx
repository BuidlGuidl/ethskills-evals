"use client";

import { useCallback } from "react";
import { useReadContract } from "wagmi";
import { TIP_JAR_ADDRESS, tipJarAbi } from "../contracts";
import { Stats } from "./Stats";
import { TipFeed, type TipItem } from "./TipFeed";
import { TipForm } from "./TipForm";

const REFRESH_MS = 5000;

export function TipJarApp() {
  const tips = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: "getTips",
    query: { refetchInterval: REFRESH_MS },
  });

  const totalTipped = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: "totalTipped",
    query: { refetchInterval: REFRESH_MS },
  });

  const tipCount = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: "tipCount",
    query: { refetchInterval: REFRESH_MS },
  });

  const jarBalance = useReadContract({
    address: TIP_JAR_ADDRESS,
    abi: tipJarAbi,
    functionName: "balance",
    query: { refetchInterval: REFRESH_MS },
  });

  const refreshAll = useCallback(() => {
    tips.refetch();
    totalTipped.refetch();
    tipCount.refetch();
    jarBalance.refetch();
  }, [tips, totalTipped, tipCount, jarBalance]);

  return (
    <>
      <Stats
        totalTipped={totalTipped.data as bigint | undefined}
        tipCount={tipCount.data as bigint | undefined}
        jarBalance={jarBalance.data as bigint | undefined}
      />

      <div className="columns">
        <TipForm onTipped={refreshAll} />
        <TipFeed
          tips={tips.data as readonly TipItem[] | undefined}
          isLoading={tips.isLoading}
        />
      </div>
    </>
  );
}
