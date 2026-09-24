import { getAddress, isAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useEnsAddress, useEnsName } from "wagmi";
import { TARGET_CHAIN } from "@/lib/wagmi";
import { useDebounced } from "./useDebounced";

export type Recipient =
  | { status: "empty" }
  | { status: "invalid"; reason: string }
  | { status: "resolving" }
  | { status: "resolved"; address: Address; name?: string };

type Parsed = { kind: "empty" } | { kind: "invalid"; reason: string } | { kind: "address"; address: Address } | { kind: "name"; name: string };

function parse(input: string): Parsed {
  const value = input.trim();
  if (!value) return { kind: "empty" };
  if (/^0x/i.test(value)) {
    if (!isAddress(value, { strict: false })) {
      return { kind: "invalid", reason: "Not a valid address: expected 0x followed by 40 hex characters." };
    }
    if (!isAddress(value)) {
      return { kind: "invalid", reason: "Address checksum doesn't match. Check for a typo and paste it again." };
    }
    return { kind: "address", address: getAddress(value) };
  }
  if (!value.includes(".")) {
    return { kind: "invalid", reason: "Enter a 0x address or an ENS name like vitalik.eth." };
  }
  try {
    return { kind: "name", name: normalize(value) };
  } catch {
    return { kind: "invalid", reason: "That name contains characters ENS doesn't allow." };
  }
}

// Accepts a 0x address or an ENS name; resolves names on mainnet.
export function useRecipient(input: string): Recipient {
  const debouncedInput = useDebounced(input);
  const settled = debouncedInput === input;
  const parsed = parse(debouncedInput);
  const name = parsed.kind === "name" ? parsed.name : undefined;

  const ens = useEnsAddress({ name, chainId: TARGET_CHAIN.id, query: { enabled: !!name } });
  const reverse = useEnsName({
    address: parsed.kind === "address" ? parsed.address : undefined,
    chainId: TARGET_CHAIN.id,
    query: { enabled: parsed.kind === "address" },
  });

  if (!settled) return input.trim() ? { status: "resolving" } : { status: "empty" };

  switch (parsed.kind) {
    case "empty":
      return { status: "empty" };
    case "invalid":
      return { status: "invalid", reason: parsed.reason };
    case "address":
      return { status: "resolved", address: parsed.address, name: reverse.data ?? undefined };
    case "name":
      if (ens.isLoading) return { status: "resolving" };
      if (ens.isError) return { status: "invalid", reason: `Couldn't look up ${parsed.name}. Check your connection and try again.` };
      if (!ens.data) return { status: "invalid", reason: `${parsed.name} doesn't point to an address.` };
      return { status: "resolved", address: ens.data, name: parsed.name };
  }
}
