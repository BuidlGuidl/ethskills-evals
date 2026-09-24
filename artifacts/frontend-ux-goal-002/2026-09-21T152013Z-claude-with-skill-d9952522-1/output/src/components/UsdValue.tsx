"use client";

import { formatUsd, toUsd } from "@/lib/format";
import type { Price } from "@/lib/prices";

/** Fiat value for a token amount; labels stale or missing prices instead of hiding them. */
export function UsdValue({ amount, decimals, price }: { amount: bigint; decimals: number; price: Price }) {
  if (price.status === "loading") return <span className="text-muted">≈ $…</span>;
  if (price.status === "unavailable") return <span className="text-muted">USD price unavailable</span>;

  const value = formatUsd(toUsd(amount, decimals, price.usd));
  if (price.status === "stale") {
    return (
      <span className="text-warning" title={`Price last updated ${price.updatedAt.toLocaleString()}`}>
        ≈ {value} (stale price)
      </span>
    );
  }
  return <span className="text-muted">≈ {value}</span>;
}
