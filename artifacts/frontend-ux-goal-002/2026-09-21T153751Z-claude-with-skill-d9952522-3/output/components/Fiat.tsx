import { formatUsd } from "@/lib/format";
import type { Price } from "@/hooks/usePrices";

// USD value of a token amount, with the price state spelled out when it isn't fresh.
export function Fiat({ amount, decimals, price }: { amount: bigint; decimals: number; price: Price }) {
  if (price.status === "loading") return <span className="muted">≈ …</span>;
  if (price.status === "unavailable") return <span className="muted">USD price unavailable</span>;
  const updated = new Date(price.updatedAt * 1000).toLocaleString();
  return (
    <span className="muted" title={`Chainlink price, updated ${updated}`}>
      ≈ {formatUsd(amount, decimals, price.price)}
      {price.stale && <span className="warn"> (stale price, last updated {updated})</span>}
    </span>
  );
}
