import { formatToken } from "@/lib/format";
import { USDC } from "@/lib/tokens";
import type { Price } from "@/hooks/usePrices";
import { Fiat } from "./Fiat";

type Balance = { value?: bigint; isLoading: boolean; isError: boolean; refetch: () => void };

function Row({ label, balance, decimals, price, maxFraction }: { label: string; balance: Balance; decimals: number; price: Price; maxFraction: number }) {
  return (
    <div className="balance">
      <span className="balance-label">{label}</span>
      {balance.isError ? (
        <span className="error-text">
          Couldn't load balance.{" "}
          <button type="button" className="link" onClick={() => balance.refetch()}>
            Retry
          </button>
        </span>
      ) : balance.value === undefined ? (
        <span className="muted">Loading…</span>
      ) : (
        <span className="balance-value">
          <strong>{formatToken(balance.value, decimals, maxFraction)}</strong>
          <Fiat amount={balance.value} decimals={decimals} price={price} />
        </span>
      )}
    </div>
  );
}

export function Balances({ usdc, eth, prices }: { usdc: Balance; eth: Balance; prices: { usdcUsd: Price; ethUsd: Price } }) {
  return (
    <section className="balances" aria-label="Your balances">
      <Row label={USDC.symbol} balance={usdc} decimals={USDC.decimals} price={prices.usdcUsd} maxFraction={6} />
      <Row label="ETH (for network fees)" balance={eth} decimals={18} price={prices.ethUsd} maxFraction={6} />
    </section>
  );
}
