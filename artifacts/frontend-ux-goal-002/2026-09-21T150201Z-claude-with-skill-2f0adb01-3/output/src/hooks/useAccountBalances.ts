import type { Address } from "viem";
import { useBalance, useReadContracts } from "wagmi";
import { CHAIN, USDC_ADDRESS, usdcAbi } from "@/lib/contracts";

const REFRESH_MS = 12_000; // ~1 block

const usdc = { chainId: CHAIN.id, address: USDC_ADDRESS, abi: usdcAbi } as const;

/** USDC + ETH state for the connected account, read from Ethereum mainnet regardless of wallet network. */
export function useAccountBalances(address: Address | undefined) {
  const usdcReads = useReadContracts({
    contracts: [
      { ...usdc, functionName: "balanceOf", args: [address!] },
      { ...usdc, functionName: "decimals" },
      { ...usdc, functionName: "paused" },
      { ...usdc, functionName: "isBlacklisted", args: [address!] },
    ],
    allowFailure: false,
    query: { enabled: !!address, refetchInterval: REFRESH_MS },
  });

  const eth = useBalance({
    address,
    chainId: CHAIN.id,
    query: { enabled: !!address, refetchInterval: REFRESH_MS },
  });

  const [usdcBalance, usdcDecimals, usdcPaused, senderBlacklisted] = usdcReads.data ?? [];

  return {
    usdcBalance,
    usdcDecimals,
    usdcPaused,
    senderBlacklisted,
    ethBalance: eth.data?.value,
    isLoading: usdcReads.isLoading || eth.isLoading,
    isError: usdcReads.isError || eth.isError,
    refetch: () => Promise.all([usdcReads.refetch(), eth.refetch()]),
  };
}
