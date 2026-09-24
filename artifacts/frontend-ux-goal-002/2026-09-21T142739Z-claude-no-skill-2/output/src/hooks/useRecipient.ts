import { getAddress, isAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useBytecode, useEnsAddress } from "wagmi";
import { mainnet } from "wagmi/chains";
import { recipientBlocker } from "@/lib/validation";

export type Recipient = {
  address?: Address;
  ensName?: string;
  error?: string;
  isResolving: boolean;
  isContract: boolean;
};

function normalizeEns(name: string): string | undefined {
  try {
    return normalize(name);
  } catch {
    return undefined;
  }
}

/** Resolves a recipient typed as a 0x address or ENS name, and validates it. */
export function useRecipient(input: string, sender?: Address): Recipient {
  const trimmed = input.trim();
  const looksLikeEns = trimmed.includes(".");
  const ensName = looksLikeEns ? normalizeEns(trimmed) : undefined;

  const ens = useEnsAddress({
    name: ensName,
    chainId: mainnet.id,
    query: { enabled: Boolean(ensName) },
  });

  let address: Address | undefined;
  let error: string | undefined;

  if (!trimmed) {
    // nothing entered yet
  } else if (looksLikeEns) {
    if (!ensName) error = "Invalid ENS name";
    else if (ens.error) error = "Couldn't resolve ENS name — try again or paste the address";
    else if (ens.isSuccess && !ens.data) error = `${ensName} doesn't point to an address`;
    else if (ens.data) address = ens.data;
  } else if (!isAddress(trimmed, { strict: false })) {
    error = "Not a valid Ethereum address";
  } else if (!isAddress(trimmed, { strict: true })) {
    error = "Address checksum doesn't match — check for typos";
  } else {
    address = getAddress(trimmed);
  }

  if (address) {
    error = recipientBlocker(address, sender);
    if (error) address = undefined;
  }

  const code = useBytecode({ address, chainId: mainnet.id, query: { enabled: Boolean(address) } });

  return {
    address,
    ensName: looksLikeEns && address ? ensName : undefined,
    error,
    isResolving: Boolean(ensName) && ens.isLoading,
    // EIP-7702 delegated EOAs carry 0xef0100… code but are still regular accounts.
    isContract: Boolean(code.data && code.data !== "0x" && !code.data.startsWith("0xef0100")),
  };
}
