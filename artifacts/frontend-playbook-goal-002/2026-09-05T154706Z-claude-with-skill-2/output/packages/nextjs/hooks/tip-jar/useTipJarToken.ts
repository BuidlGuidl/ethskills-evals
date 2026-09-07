import { erc20Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

/**
 * Everything the UI needs to know about the token the jar accepts.
 *
 * The address comes from the deployed TipJar itself rather than a constant, so the
 * page can never disagree with the contract about which token it takes. On Base (and
 * a Base fork) that resolves to canonical USDC, 0x8335...2913.
 */
export const useTipJarToken = () => {
  const { address: connectedAddress } = useAccount();

  const { data: tokenAddress } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "token",
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(tokenAddress) },
  });

  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddress) },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    query: { enabled: Boolean(tokenAddress && connectedAddress) },
  });

  return {
    tokenAddress,
    // USDC is 6 decimals; fall back to that only until the onchain read lands.
    decimals: decimals ?? 6,
    symbol: symbol ?? "USDC",
    balance,
    refetchBalance,
  };
};
