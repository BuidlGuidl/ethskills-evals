"use client";

import { useMembership } from "@/hooks/useToolshed";
import { activeChain, explorerUrl } from "@/lib/chain";
import { toolshedAddress, usdcAddress } from "@/lib/contracts";
import { shortAddress } from "@/lib/format";

/**
 * Where the money actually lives. For an app holding neighbours' deposits, the contract address
 * being visible and clickable is the main trust signal it can offer.
 */
export function Footer() {
  const { steward } = useMembership();

  return (
    <footer className="mt-12 border-t border-shed-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-x-8 gap-y-2 px-4 py-6 text-xs text-shed-600">
        <span>
          Deposits are held by the Toolshed contract on {activeChain.name}. Nobody, including the steward, can move
          them anywhere except between a loan&apos;s borrower and its tool owner.
        </span>
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <div>
            <dt className="font-semibold uppercase tracking-wide">Toolshed</dt>
            <dd>{addressLink(toolshedAddress)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase tracking-wide">USDC</dt>
            <dd>{addressLink(usdcAddress)}</dd>
          </div>
          {steward && (
            <div>
              <dt className="font-semibold uppercase tracking-wide">Steward</dt>
              <dd>{addressLink(steward)}</dd>
            </div>
          )}
        </dl>
      </div>
    </footer>
  );
}

function addressLink(address: string) {
  const href = explorerUrl("address", address);
  const label = <span className="font-mono">{shortAddress(address)}</span>;
  return href ? (
    <a className="underline" href={href} target="_blank" rel="noreferrer" title={address}>
      {label}
    </a>
  ) : (
    <span title={address}>{label}</span>
  );
}
