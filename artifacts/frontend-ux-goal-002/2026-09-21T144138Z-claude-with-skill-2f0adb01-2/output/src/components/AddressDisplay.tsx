"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useEnsName } from "wagmi";
import { CHAIN, EXPLORER_URL } from "@/lib/constants";
import { shortAddress } from "@/lib/format";

/** Address with ENS name, copy button and Etherscan link. */
export function AddressDisplay({ address, name }: { address: Address; name?: string }) {
  const { data: ensName } = useEnsName({ address, chainId: CHAIN.id, query: { enabled: !name } });
  const [copied, setCopied] = useState(false);
  const label = name ?? ensName;

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context) — address is still visible via title */
    }
  }

  return (
    <span className="inline-flex items-center gap-2 font-mono text-sm" title={address}>
      {label && <span className="font-sans font-medium">{label}</span>}
      <span className={label ? "text-muted" : ""}>{shortAddress(address)}</span>
      <button type="button" onClick={copy} className="text-xs text-accent hover:underline" aria-label="Copy address">
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        href={`${EXPLORER_URL}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-accent hover:underline"
      >
        Etherscan ↗
      </a>
    </span>
  );
}
