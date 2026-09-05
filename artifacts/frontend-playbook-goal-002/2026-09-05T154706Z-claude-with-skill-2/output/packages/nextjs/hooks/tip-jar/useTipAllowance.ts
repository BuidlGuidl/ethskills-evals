import { erc20Abi } from "viem";
import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";

/**
 * The tipper's current ERC-20 allowance for the jar.
 *
 * ERC-20 tipping is two steps: approve the jar for the amount, then call `tip`.
 * The form uses this to decide which of those two buttons to show.
 */
export const useTipAllowance = ({ tokenAddress, spender }: { tokenAddress?: Address; spender?: Address }) => {
  const { address: connectedAddress } = useAccount();

  const { data: allowance, refetch } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: connectedAddress && spender ? [connectedAddress, spender] : undefined,
    query: { enabled: Boolean(tokenAddress && spender && connectedAddress) },
  });

  return { allowance, refetchAllowance: refetch };
};
