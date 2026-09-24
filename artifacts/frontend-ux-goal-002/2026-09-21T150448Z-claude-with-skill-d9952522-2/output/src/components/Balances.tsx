"use client";

import { formatToken } from "@/lib/format";
import type { PriceState } from "@/lib/prices";
import { USDC } from "@/lib/constants";
import { UsdValue } from "./UsdValue";

type BalanceQuery = { value: bigint | undefined; isLoading: boolean; isError: boolean };

type Props = {
  usdc: BalanceQuery;
  eth: BalanceQuery;
  usdcPrice: PriceState;
  ethPrice: PriceState;
};

export function Balances({ usdc, eth, usdcPrice, ethPrice }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <BalanceCard label="USDC balance" symbol={USDC.symbol} decimals={USDC.decimals} maxFraction={2} query={usdc} price={usdcPrice} />
      <BalanceCard
        label="ETH for network fees"
        symbol="ETH"
        decimals={18}
        maxFraction={5}
        query={eth}
        price={ethPrice}
      />
    </div>
  );
}

function BalanceCard({
  label,
  symbol,
  decimals,
  maxFraction,
  query,
  price,
}: {
  label: string;
  symbol: string;
  decimals: number;
  maxFraction: number;
  query: BalanceQuery;
  price: PriceState;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      {query.isLoading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-border" aria-label="Loading balance" />
      ) : query.isError || query.value === undefined ? (
        <div className="mt-2 text-sm text-danger">Couldn&apos;t load balance</div>
      ) : (
        <>
          <div className="mt-1 text-xl font-semibold tabular-nums" title={`${formatToken(query.value, decimals)} ${symbol}`}>
            {formatToken(query.value, decimals, maxFraction)} <span className="text-base font-normal text-muted">{symbol}</span>
          </div>
          <UsdValue value={query.value} decimals={decimals} price={price} />
        </>
      )}
    </div>
  );
}
