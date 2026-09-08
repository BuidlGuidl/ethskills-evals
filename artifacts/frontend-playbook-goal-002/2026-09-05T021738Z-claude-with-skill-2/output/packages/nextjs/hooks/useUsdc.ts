"use client";

import { erc20Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";

/**
 * Everything the UI needs about the tip token: which token the jar accepts (read from the jar
 * itself, so there is a single source of truth), plus the connected account's balance and the
 * allowance it has granted to the jar.
 */
export const useUsdc = () => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });
  const { data: tokenAddress } = useScaffoldReadContract({ contractName: "TipJar", functionName: "token" });

  const commonQuery = { enabled: Boolean(tokenAddress && connectedAddress), refetchInterval: 5_000 } as const;

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: targetNetwork.id,
    query: commonQuery,
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: connectedAddress && tipJar?.address ? [connectedAddress, tipJar.address] : undefined,
    chainId: targetNetwork.id,
    query: { ...commonQuery, enabled: commonQuery.enabled && Boolean(tipJar?.address) },
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    chainId: targetNetwork.id,
    query: { enabled: Boolean(tokenAddress) },
  });

  const refetch = async () => {
    await Promise.all([refetchBalance(), refetchAllowance()]);
  };

  return {
    tokenAddress,
    tipJarAddress: tipJar?.address,
    symbol: symbol ?? "USDC",
    balance,
    allowance,
    refetch,
  };
};
