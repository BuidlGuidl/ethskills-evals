import { useCallback } from 'react';
import type { Address } from 'viem';
import { useBalance, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';

import { USDC_ADDRESS, usdcAbi } from '@/lib/usdc';

const REFETCH_MS = 12_000; // ~1 block

/** USDC and ETH balances on mainnet, regardless of which chain the wallet is on. */
export function useBalances(address: Address | undefined) {
  const usdc = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: mainnet.id,
    query: { enabled: !!address, refetchInterval: REFETCH_MS },
  });
  const eth = useBalance({
    address,
    chainId: mainnet.id,
    query: { enabled: !!address, refetchInterval: REFETCH_MS },
  });

  const { refetch: refetchUsdc } = usdc;
  const { refetch: refetchEth } = eth;
  const refetch = useCallback(() => Promise.all([refetchUsdc(), refetchEth()]), [refetchUsdc, refetchEth]);

  return {
    usdc: usdc.data,
    eth: eth.data?.value,
    isLoading: usdc.isLoading || eth.isLoading,
    isError: usdc.isError || eth.isError,
    refetch,
  };
}
