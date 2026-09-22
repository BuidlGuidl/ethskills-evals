"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

/**
 * Every write button that does not move a deposit. It handles the three things each of them would
 * otherwise have to handle separately: no wallet, the wrong chain, and a transaction already in
 * flight. Without the chain check a member on Ethereum mainnet just gets a red toast after
 * clicking, with no way to fix it from the screen they are on.
 *
 * Deposit actions use `DepositAction` instead, which adds the approval step.
 */
export const ActionButton = ({
  label,
  onClick,
  className = "btn btn-primary btn-sm",
  disabled,
  disabledReason,
  children,
}: {
  label?: string;
  onClick: () => Promise<unknown>;
  className?: string;
  disabled?: boolean;
  /** Shown instead of the label, and as a tooltip, when the action cannot be taken. */
  disabledReason?: string;
  children?: React.ReactNode;
}) => {
  const { address, chainId } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [isBusy, setIsBusy] = useState(false);

  if (!address) {
    return (
      <button className={`${className} btn-disabled`} disabled title="Connect your wallet first">
        {label ?? children}
      </button>
    );
  }

  if (chainId !== targetNetwork.id) {
    return (
      <button className={className} disabled={isSwitching} onClick={() => switchChain({ chainId: targetNetwork.id })}>
        {isSwitching ? "Switching…" : `Switch to ${targetNetwork.name}`}
      </button>
    );
  }

  if (disabled) {
    return (
      <button className={`${className} btn-disabled`} disabled title={disabledReason}>
        {disabledReason ?? label ?? children}
      </button>
    );
  }

  return (
    <button
      className={className}
      disabled={isBusy}
      onClick={async () => {
        setIsBusy(true);
        try {
          await onClick();
        } finally {
          setIsBusy(false);
        }
      }}
    >
      {isBusy && <span className="loading loading-spinner loading-xs" />}
      {label ?? children}
    </button>
  );
};
