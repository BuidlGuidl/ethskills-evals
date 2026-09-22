"use client";

import { ReactNode, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type Props = {
  onClick: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

/**
 * A transaction button for actions that don't move a deposit: connect and network checks,
 * a spinner while the transaction is in flight, and no double submits.
 */
export const TxButton = ({ onClick, children, disabled, className = "btn btn-sm btn-primary" }: Props) => {
  const { address, chain } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [isRunning, setIsRunning] = useState(false);

  if (!address) {
    return <RainbowKitCustomConnectButton />;
  }

  if (chain?.id !== targetNetwork.id) {
    return (
      <button className={className} disabled={isSwitching} onClick={() => switchChain({ chainId: targetNetwork.id })}>
        {isSwitching ? <span className="loading loading-spinner loading-xs" /> : null}
        Switch to {targetNetwork.name}
      </button>
    );
  }

  return (
    <button
      className={className}
      disabled={disabled || isRunning}
      onClick={async () => {
        setIsRunning(true);
        try {
          await onClick();
        } catch (error) {
          console.error(error);
          notification.error("Transaction failed — nothing was sent");
        } finally {
          setIsRunning(false);
        }
      }}
    >
      {isRunning ? <span className="loading loading-spinner loading-xs" /> : null}
      {children}
    </button>
  );
};
