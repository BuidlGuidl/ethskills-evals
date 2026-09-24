"use client";

import { UsdValue } from "@/components/UsdValue";
import { formatToken } from "@/lib/format";
import type { Price } from "@/lib/prices";
import { ETH, USDC } from "@/lib/tokens";

type Props = {
  usdc?: bigint;
  eth?: bigint;
  isError: boolean;
  usdcPrice: Price;
  ethPrice: Price;
};

export function Balances({ usdc, eth, isError, usdcPrice, ethPrice }: Props) {
  return (
    <section aria-label="Your balances" className="grid grid-cols-2 gap-3">
      <BalanceTile label="USDC balance" symbol={USDC.symbol} value={usdc} decimals={USDC.decimals} maxFraction={2} price={usdcPrice} isError={isError} />
      <BalanceTile label="ETH for gas" symbol={ETH.symbol} value={eth} decimals={ETH.decimals} maxFraction={5} price={ethPrice} isError={isError} />
    </section>
  );
}

function BalanceTile(props: {
  label: string;
  symbol: string;
  value?: bigint;
  decimals: number;
  maxFraction: number;
  price: Price;
  isError: boolean;
}) {
  const { label, symbol, value, decimals, maxFraction, price, isError } = props;
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      {value === undefined ? (
        <div className="mt-1 text-lg font-semibold text-muted">{isError ? "Couldn't load" : "…"}</div>
      ) : (
        <>
          <div className="mt-1 truncate text-lg font-semibold tabular-nums" title={`${formatToken(value, decimals, decimals)} ${symbol}`}>
            {formatToken(value, decimals, maxFraction)} {symbol}
          </div>
          <div className="text-xs">
            <UsdValue amount={value} decimals={decimals} price={price} />
          </div>
        </>
      )}
    </div>
  );
}
