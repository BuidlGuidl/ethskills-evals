"use client";

import { FEED_DECIMALS } from "@/lib/contracts";
import { formatToken, formatUsd } from "@/lib/format";

type Props = {
  isConnected: boolean;
  isLoading: boolean;
  isError: boolean;
  usdcBalance?: bigint;
  usdcDecimals?: number;
  ethBalance?: bigint;
  ethUsd?: bigint;
  usdcUsd?: bigint;
};

// Warn if USDC trades more than 1% off its peg.
const DEPEG_THRESHOLD = 99n * 10n ** BigInt(FEED_DECIMALS - 2);

export function Balances(props: Props) {
  const { isConnected, isLoading, isError, usdcBalance, usdcDecimals, ethBalance, ethUsd, usdcUsd } = props;

  if (!isConnected) {
    return (
      <section className="card">
        <h2>Your balances</h2>
        <p className="muted">Connect a wallet to see your USDC and ETH balances.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Your balances</h2>
      {isError && <p className="notice notice-error">Couldn't load balances. Retrying…</p>}
      <dl className="balances">
        <div>
          <dt>USDC</dt>
          <dd>
            {isLoading || usdcBalance === undefined || usdcDecimals === undefined ? (
              <span className="skeleton" />
            ) : (
              <>
                <span className="amount">{formatToken(usdcBalance, usdcDecimals)} USDC</span>
                <span className="muted">{formatUsd(usdcBalance, usdcDecimals, usdcUsd)}</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>
            ETH <span className="muted small">(pays network fees)</span>
          </dt>
          <dd>
            {isLoading || ethBalance === undefined ? (
              <span className="skeleton" />
            ) : (
              <>
                <span className="amount">{formatToken(ethBalance, 18, 5)} ETH</span>
                <span className="muted">{formatUsd(ethBalance, 18, ethUsd)}</span>
              </>
            )}
          </dd>
        </div>
      </dl>
      {ethBalance === 0n && (
        <p className="notice notice-warning">
          You have no ETH. Sending USDC needs a small amount of ETH to pay the network fee.
        </p>
      )}
      {usdcUsd !== undefined && usdcUsd < DEPEG_THRESHOLD && (
        <p className="notice notice-warning">
          USDC is currently priced at ${(Number(usdcUsd) / 10 ** FEED_DECIMALS).toFixed(4)}, below its $1.00
          peg.
        </p>
      )}
    </section>
  );
}
