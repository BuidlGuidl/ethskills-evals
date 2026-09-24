"use client";

import { useEffect, useState } from "react";
import { useBlock } from "wagmi";
import { nowSeconds } from "~~/utils/toolshed/format";

/**
 * "Now" as the contract sees it: the latest block's timestamp, which is what every deadline
 * and late fee is actually measured against. Falls back to the browser clock before the first
 * block arrives, and ticks so the screen stays honest between blocks.
 */
export const useNow = (intervalMs = 30_000) => {
  const [wallClock, setWallClock] = useState(nowSeconds);
  const { data: block } = useBlock({ watch: true });

  useEffect(() => {
    const timer = setInterval(() => setWallClock(nowSeconds()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return block?.timestamp ? Math.max(Number(block.timestamp), 0) : wallClock;
};
