"use client";

import { formatUsd, toUsd } from "@/lib/format";
import type { PriceState } from "@/lib/prices";

type Props = { value: bigint | undefined; decimals: number; price: PriceState; className?: string };

export function UsdValue({ value, decimals, price, className = "" }: Props) {
  if (value === undefined) return null;
  const base = `text-sm text-muted ${className}`;

  if (price.status === "loading") return <span className={base}>Loading USD price…</span>;
  if (price.status === "unavailable") return <span className={base}>USD price unavailable</span>;

  const usd = formatUsd(toUsd(value, decimals, price.price));
  if (price.status === "stale") {
    return (
      <span className={base} title={`Chainlink price last updated ${price.updatedAt.toLocaleString()}`}>
        ≈ {usd} <span className="text-warning">(stale price)</span>
      </span>
    );
  }
  return <span className={base}>≈ {usd}</span>;
}
