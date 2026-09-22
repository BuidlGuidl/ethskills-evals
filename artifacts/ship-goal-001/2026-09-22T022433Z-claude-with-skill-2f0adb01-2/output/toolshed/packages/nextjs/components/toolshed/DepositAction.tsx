"use client";

import { useState } from "react";
import { erc20Abi } from "viem";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { useTargetNetwork, useTransactor } from "~~/hooks/scaffold-eth";
import { useDepositToken } from "~~/hooks/toolshed";
import { formatUsdc } from "~~/utils/toolshed";

/**
 * One button at a time, in the order a deposit actually requires:
 *
 *   1. Connect     — nothing to do until there is a wallet
 *   2. Switch      — wrong chain
 *   3. Approve     — allowance too low, approved for exactly this deposit and no more
 *   4. Execute     — the actual call
 *
 * Approvals are for the exact amount on purpose. An unlimited approval to a lending contract means
 * one undiscovered bug can drain every member's USDC, and nobody in a tool library needs that.
 */
export const DepositAction = ({
  amount,
  label,
  onExecute,
  disabled,
  disabledReason,
  className = "btn btn-primary",
}: {
  /** USDC this action will pull. Pass 0n for actions that move no money. */
  amount: bigint;
  label: string;
  onExecute: () => Promise<unknown>;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) => {
  const { address, chainId } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { token, spender, symbol, balance, allowance, refetchAllowance, refetchBalance } = useDepositToken();
  const isLocal = targetNetwork.id === 31337;
  const { writeContractAsync } = useWriteContract();
  const transactor = useTransactor();
  const [isBusy, setIsBusy] = useState(false);
  // After the approval lands, the same button would otherwise turn into "Ask to borrow" under a
  // finger that is still tapping. Hold it disabled for a beat so nobody borrows by accident.
  const [justApproved, setJustApproved] = useState(false);

  if (!address) {
    return (
      <button className={`${className} btn-disabled`} disabled>
        Connect your wallet
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

  if (amount > 0n && balance < amount) {
    return (
      <div className="flex flex-col gap-1">
        <button className={`${className} btn-disabled`} disabled>
          Need {formatUsdc(amount)} {symbol} — you have {formatUsdc(balance)}
        </button>
        <span className="text-xs opacity-70">
          {isLocal
            ? "On a local chain, mint yourself some with the MockUSDC faucet (see the README)."
            : `Top up ${symbol} on ${targetNetwork.name} — any exchange withdrawal or bridge to this address will do.`}
        </span>
      </div>
    );
  }

  if (disabled) {
    return (
      <button className={`${className} btn-disabled`} disabled title={disabledReason}>
        {disabledReason || label}
      </button>
    );
  }

  const needsApproval = amount > 0n && allowance < amount;

  const approve = async () => {
    if (!token || !spender) return;
    setIsBusy(true);
    try {
      await transactor(() =>
        writeContractAsync({
          address: token,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, amount],
        }),
      );
      await Promise.all([refetchAllowance(), refetchBalance()]);
      setJustApproved(true);
      setTimeout(() => setJustApproved(false), 1500);
    } finally {
      setIsBusy(false);
    }
  };

  const execute = async () => {
    setIsBusy(true);
    try {
      await onExecute();
      await Promise.all([refetchAllowance(), refetchBalance()]);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <button className={className} disabled={isBusy || justApproved} onClick={needsApproval ? approve : execute}>
      {(isBusy || justApproved) && <span className="loading loading-spinner loading-xs" />}
      {needsApproval ? `Approve ${formatUsdc(amount)} ${symbol}` : label}
    </button>
  );
};
