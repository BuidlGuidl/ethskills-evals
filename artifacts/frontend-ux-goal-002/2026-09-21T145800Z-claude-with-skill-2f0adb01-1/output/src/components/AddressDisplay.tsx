"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useEnsName } from "wagmi";
import { CHAIN, addressUrl } from "@/lib/contracts";
import { shortAddress } from "@/lib/format";

/** Address with ENS name, copy button and Etherscan link. */
export function AddressDisplay({ address, ensName }: { address: Address; ensName?: string }) {
  const { data: reverseName } = useEnsName({ address, chainId: CHAIN.id, query: { enabled: !ensName } });
  const name = ensName ?? reverseName ?? undefined;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context); the full address is still in the title tooltip.
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {name && <span className="font-medium">{name}</span>}
      <span className="font-mono text-muted" title={address}>
        {shortAddress(address)}
      </span>
      <button
        type="button"
        onClick={copy}
        className="rounded px-1.5 py-0.5 text-xs text-accent hover:bg-surface-muted"
        aria-label="Copy address"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        href={addressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded px-1.5 py-0.5 text-xs text-accent hover:bg-surface-muted"
      >
        Etherscan ↗
      </a>
    </span>
  );
}
