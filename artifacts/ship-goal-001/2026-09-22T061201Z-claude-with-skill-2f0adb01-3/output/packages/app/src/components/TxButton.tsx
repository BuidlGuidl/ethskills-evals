"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useAccount,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { toolshed } from "@/lib/contracts";
import { activeChain, explorerUrl } from "@/lib/chain";
import { humanError, isRevert } from "@/lib/errors";
import { useRefreshAll } from "@/hooks/useToolshed";
import { ConnectButton } from "./ConnectButton";

type Props = {
  /** Defaults to the Toolshed contract; pass `usdc` for the deposit approval. */
  contract?: { address: `0x${string}`; abi: readonly unknown[] };
  functionName: string;
  args: readonly unknown[];
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Shown while the wallet is open and while the tx is being mined. */
  pendingLabel?: string;
  onDone?: () => void;
};

/**
 * One contract write, with the states a chain actually has: not connected, wrong network,
 * would-revert, signing, mining, done, failed.
 *
 * Every call is simulated first, so a write that the contract would reject is disabled with the
 * reason shown instead of costing the member a signature — worth it here, because two neighbours
 * racing for the same drill is an ordinary Tuesday.
 */
export function TxButton({
  contract = toolshed,
  functionName,
  args,
  children,
  className = "btn-primary",
  disabled,
  pendingLabel,
  onDone,
}: Props) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const refresh = useRefreshAll();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const handled = useRef<string | undefined>(undefined);

  const wrongChain = isConnected && chainId !== activeChain.id;

  const simulation = useSimulateContract({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- abi is resolved at runtime
    ...(contract as any),
    functionName,
    args,
    query: { enabled: isConnected && !wrongChain && !disabled && !hash },
  });

  useEffect(() => {
    if (receipt.isSuccess && hash && handled.current !== hash) {
      handled.current = hash;
      setSubmitting(false);
      setSucceeded(true);
      refresh();
      onDone?.();
    }
  }, [receipt.isSuccess, hash, refresh, onDone]);

  useEffect(() => {
    if (error || receipt.isError) setSubmitting(false);
  }, [error, receipt.isError]);

  if (!isConnected) return <ConnectButton />;

  if (wrongChain) {
    return (
      <button className={className} disabled={switching} onClick={() => switchChain({ chainId: activeChain.id })}>
        {switching ? "Switching…" : `Switch to ${activeChain.name}`}
      </button>
    );
  }

  const busy = submitting || isPending || receipt.isLoading;
  // A simulation that reverted means the contract would reject this; anything else (an RPC
  // hiccup) is not the member's problem and must not disable their button.
  const wouldRevert = !hash && isRevert(simulation.error);
  const failure = error ?? receipt.error ?? (wouldRevert ? simulation.error : null);
  const link = hash ? explorerUrl("tx", hash) : undefined;

  return (
    <div className="flex flex-col gap-1">
      <button
        className={className}
        disabled={disabled || busy || wouldRevert}
        onClick={() => {
          if (busy) return;
          setSubmitting(true);
          setSucceeded(false);
          reset();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- abi is resolved at runtime
          writeContract({ ...(contract as any), functionName, args });
        }}
      >
        {busy ? (pendingLabel ?? (isPending || submitting ? "Confirm in wallet…" : "Confirming onchain…")) : children}
      </button>

      <div aria-live="polite" className="flex flex-col gap-0.5">
        {busy && <p className="text-xs text-shed-600">This takes a few seconds onchain.</p>}
        {succeeded && <p className="text-xs text-emerald-800">Done.</p>}
        {link && (
          <a className="text-xs text-shed-600 underline" href={link} target="_blank" rel="noreferrer">
            View transaction
          </a>
        )}
        {failure && <p className="text-xs text-red-700">{humanError(failure)}</p>}
      </div>
    </div>
  );
}

export { humanError };
