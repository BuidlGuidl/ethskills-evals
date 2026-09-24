"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useEnsName } from "wagmi";
import { CHAIN, explorerAddressUrl } from "@/lib/contracts";
import { shortAddress } from "@/lib/format";

type Props = {
  address: Address;
  /** Known name (e.g. what the user typed). Otherwise reverse-resolved via ENS. */
  name?: string;
  /** Show the full address instead of a truncated one (for final confirmation). */
  full?: boolean;
};

export function AddressDisplay({ address, name, full }: Props) {
  const { data: ensName } = useEnsName({ address, chainId: CHAIN.id, query: { enabled: !name } });
  const label = name ?? ensName ?? undefined;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (permissions / insecure context); address stays selectable.
    }
  }

  return (
    <span className="address">
      {label && <span className="address-name">{label}</span>}
      <span className="mono address-hex" title={address}>
        {full ? address : shortAddress(address)}
      </span>
      <button type="button" className="icon-button" onClick={copy} aria-label="Copy address">
        {copied ? "Copied" : "Copy"}
      </button>
      <a className="icon-button" href={explorerAddressUrl(address)} target="_blank" rel="noopener noreferrer">
        Etherscan ↗
      </a>
    </span>
  );
}
