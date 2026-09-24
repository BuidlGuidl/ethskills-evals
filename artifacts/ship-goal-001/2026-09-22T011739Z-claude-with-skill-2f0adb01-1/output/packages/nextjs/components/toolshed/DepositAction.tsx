"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { formatUsdc } from "~~/utils/toolshed/format";

type Props = {
  /** Deposit the action needs to be able to pull, in raw USDC units. */
  amount: bigint;
  label: string;
  onExecute: () => Promise<void>;
  disabled?: boolean;
  className?: string;
};

/**
 * The one-button-at-a-time flow for anything that moves a deposit:
 * connect → switch network → approve exactly this deposit → do the thing.
 * Approval is for the exact amount; this app never asks for an unlimited allowance.
 */
export const DepositAction = ({ amount, label, onExecute, disabled, className = "" }: Props) => {
  const { address, chain } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: toolshed } = useDeployedContractInfo({ contractName: "Toolshed" });
  const [isRunning, setIsRunning] = useState(false);

  const { data: allowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [address, toolshed?.address],
  });
  const { data: balance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [address],
  });
  const { writeContractAsync: writeUsdc, isMining: isApproving } = useScaffoldWriteContract({ contractName: "USDC" });

  const buttonClass = `btn btn-primary ${className}`;

  if (!address) {
    return <RainbowKitCustomConnectButton />;
  }

  if (chain?.id !== targetNetwork.id) {
    return (
      <button className={buttonClass} disabled={isSwitching} onClick={() => switchChain({ chainId: targetNetwork.id })}>
        {isSwitching ? <span className="loading loading-spinner loading-xs" /> : null}
        Switch to {targetNetwork.name}
      </button>
    );
  }

  if (balance !== undefined && balance < amount) {
    return (
      <button className={buttonClass} disabled>
        Need {formatUsdc(amount)} — you have {formatUsdc(balance)}
      </button>
    );
  }

  if (allowance === undefined || allowance < amount) {
    return (
      <button
        className={buttonClass}
        disabled={disabled || isApproving || isRunning}
        onClick={async () => {
          // isMining alone isn't enough: it drops before the allowance read catches up, which
          // leaves a window where a second click sends a second approval.
          setIsRunning(true);
          try {
            await writeUsdc({ functionName: "approve", args: [toolshed?.address, amount] });
            await refetchAllowance();
          } catch {
            // useScaffoldWriteContract already surfaced the reason
          } finally {
            setIsRunning(false);
          }
        }}
      >
        {isApproving || isRunning ? <span className="loading loading-spinner loading-xs" /> : null}
        Approve {formatUsdc(amount)}
      </button>
    );
  }

  return (
    <button
      className={buttonClass}
      disabled={disabled || isRunning}
      onClick={async () => {
        setIsRunning(true);
        try {
          await onExecute();
        } catch (error) {
          console.error(error);
          notification.error("Transaction failed — nothing was sent");
        } finally {
          setIsRunning(false);
        }
      }}
    >
      {isRunning ? <span className="loading loading-spinner loading-xs" /> : null}
      {label}
    </button>
  );
};
