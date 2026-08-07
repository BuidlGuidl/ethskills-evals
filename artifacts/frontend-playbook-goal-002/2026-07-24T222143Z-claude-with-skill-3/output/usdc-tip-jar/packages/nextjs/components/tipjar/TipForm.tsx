"use client";

import { useState } from "react";
import { USDC_DECIMALS, formatUSDC } from "./format";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const PRESETS = ["1", "5", "25"];
const MAX_MESSAGE_LENGTH = 280;

/** Form to send a USDC tip: handles the approve -> tip two-step flow. */
export const TipForm = () => {
  const { address: connectedAddress } = useAccount();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });

  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress],
  });
  const { data: allowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress, tipJar?.address],
  });

  const { writeContractAsync: writeUsdc, isMining: isApproving } = useScaffoldWriteContract({
    contractName: "USDC",
  });
  const { writeContractAsync: writeTipJar, isMining: isTipping } = useScaffoldWriteContract({
    contractName: "TipJar",
  });

  // Parse the entered amount into raw USDC units; invalid input -> undefined.
  let parsedAmount: bigint | undefined;
  try {
    parsedAmount = amount ? parseUnits(amount, USDC_DECIMALS) : undefined;
  } catch {
    parsedAmount = undefined;
  }

  const hasValidAmount = parsedAmount !== undefined && parsedAmount > 0n;
  const insufficientBalance = hasValidAmount && usdcBalance !== undefined && parsedAmount! > usdcBalance;
  const needsApproval = hasValidAmount && (allowance === undefined || allowance < parsedAmount!);
  const messageTooLong = message.length > MAX_MESSAGE_LENGTH;

  const handleApprove = async () => {
    if (!parsedAmount || !tipJar) return;
    try {
      await writeUsdc({
        functionName: "approve",
        args: [tipJar.address, parsedAmount],
      });
      await refetchAllowance();
    } catch (e) {
      // notification is already surfaced by the transactor; nothing to do here.
      console.error(e);
    }
  };

  const handleTip = async () => {
    if (!parsedAmount) return;
    try {
      await writeTipJar({
        functionName: "tip",
        args: [parsedAmount, message],
      });
      setAmount("");
      setMessage("");
      await refetchAllowance();
      notification.success("Tip sent — thank you! 🫙");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body gap-4">
        <h2 className="card-title">Send a tip</h2>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Amount (USDC)</span>
            {connectedAddress && <span className="label-text-alt">Balance: ${formatUSDC(usdcBalance)}</span>}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="input input-bordered w-full"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            {PRESETS.map(preset => (
              <button key={preset} type="button" className="btn btn-sm btn-outline" onClick={() => setAmount(preset)}>
                ${preset}
              </button>
            ))}
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Message (optional)</span>
            <span className={`label-text-alt ${messageTooLong ? "text-error" : ""}`}>
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            placeholder="Say something nice…"
            rows={2}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        {!connectedAddress ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-center opacity-70">Connect your wallet to send a tip.</p>
            <RainbowKitCustomConnectButton />
          </div>
        ) : insufficientBalance ? (
          <button className="btn btn-primary" disabled>
            Insufficient USDC balance
          </button>
        ) : needsApproval ? (
          <button
            className="btn btn-primary"
            onClick={handleApprove}
            disabled={!hasValidAmount || messageTooLong || isApproving}
          >
            {isApproving ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Approving…
              </>
            ) : (
              "1. Approve USDC"
            )}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleTip}
            disabled={!hasValidAmount || messageTooLong || isTipping}
          >
            {isTipping ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Sending…
              </>
            ) : (
              "Send tip"
            )}
          </button>
        )}
      </div>
    </div>
  );
};
