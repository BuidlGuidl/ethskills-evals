import { useMemo } from "react";
import { type Address, getAddress, isAddress, isAddressEqual, zeroAddress } from "viem";
import { normalize } from "viem/ens";
import { useBytecode, useEnsAddress, useReadContract } from "wagmi";
import { CHAIN, USDC_ADDRESS, usdcAbi } from "@/lib/contracts";
import { useDebounced } from "./useDebounced";

export type Recipient = {
  address?: Address;
  ensName?: string;
  isResolving: boolean;
  error?: string;
  warning?: string;
};

type Parsed = { address?: Address; ensName?: string; error?: string };

function parse(input: string): Parsed {
  const value = input.trim();
  if (!value) return {};
  if (/^0x/i.test(value)) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return { error: "Not a valid Ethereum address." };
    if (!isAddress(value)) return { error: "Address checksum doesn't match. Check it for typos." };
    return { address: getAddress(value) };
  }
  if (value.includes(".")) {
    try {
      return { ensName: normalize(value) };
    } catch {
      return { error: "Not a valid ENS name." };
    }
  }
  return { error: "Enter a 0x address or an ENS name (e.g. name.eth)." };
}

// EIP-7702 delegated EOAs carry a 0xef0100 code prefix but are still user accounts.
const isContractCode = (code: string | undefined) =>
  !!code && code !== "0x" && !code.toLowerCase().startsWith("0xef0100");

export function useRecipient(input: string, sender: Address | undefined): Recipient {
  const parsed = useMemo(() => parse(input), [input]);
  const debouncedName = useDebounced(parsed.ensName);

  const ens = useEnsAddress({
    name: debouncedName,
    chainId: CHAIN.id,
    query: { enabled: !!debouncedName },
  });

  const ensPending = !!parsed.ensName && (parsed.ensName !== debouncedName || ens.isLoading);
  const address =
    parsed.address ?? (parsed.ensName && !ensPending && ens.data ? getAddress(ens.data) : undefined);

  const blacklisted = useReadContract({
    chainId: CHAIN.id,
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "isBlacklisted",
    args: [address!],
    query: { enabled: !!address },
  });
  const bytecode = useBytecode({ address, chainId: CHAIN.id, query: { enabled: !!address } });

  const base = { ensName: parsed.ensName, isResolving: false };
  if (parsed.error) return { ...base, error: parsed.error };
  if (ensPending) return { ...base, isResolving: true };
  if (parsed.ensName && ens.isError) return { ...base, error: "Couldn't look up this ENS name. Try again." };
  if (!address) return parsed.ensName ? { ...base, error: `${parsed.ensName} doesn't point to an address.` } : base;

  if (isAddressEqual(address, zeroAddress)) return { ...base, error: "You can't send to the zero address." };
  if (isAddressEqual(address, USDC_ADDRESS)) {
    return { ...base, error: "That's the USDC token contract. Funds sent there are lost." };
  }
  if (sender && isAddressEqual(address, sender)) return { ...base, error: "That's your own address." };
  if (blacklisted.data) {
    return { ...base, address, error: "This address is blocked by Circle and can't receive USDC." };
  }

  return {
    ...base,
    address,
    isResolving: blacklisted.isLoading || bytecode.isLoading,
    warning: isContractCode(bytecode.data)
      ? "This is a smart contract. Only send if you know it can handle USDC (e.g. a Safe or an exchange deposit address)."
      : undefined,
  };
}
