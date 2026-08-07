"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const USDC_DECIMALS = 6;

/**
 * Tip form with the USDC approve → tip flow. Reads the caller's USDC balance and the jar's
 * current allowance to decide whether to show "Approve" or "Send tip".
 */
export const TipForm = () => {
  const { address: connectedAddress } = useAccount();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });
  const tipJarAddress = tipJar?.address;

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
    args: [connectedAddress, tipJarAddress],
  });

  const { writeContractAsync: approveAsync, isMining: isApproving } = useScaffoldWriteContract({
    contractName: "USDC",
  });
  const { writeContractAsync: tipAsync, isMining: isTipping } = useScaffoldWriteContract({
    contractName: "TipJar",
  });

  let amountWei: bigint | undefined;
  try {
    amountWei = amount ? parseUnits(amount, USDC_DECIMALS) : undefined;
  } catch {
    amountWei = undefined;
  }

  const hasValidAmount = amountWei !== undefined && amountWei > 0n;
  const insufficientBalance = hasValidAmount && usdcBalance !== undefined && amountWei! > usdcBalance;
  const needsApproval = !hasValidAmount || allowance === undefined || allowance < amountWei!;

  const handleApprove = async () => {
    if (!tipJarAddress || !hasValidAmount) return;
    await approveAsync({ functionName: "approve", args: [tipJarAddress, amountWei] });
    await refetchAllowance();
  };

  const handleTip = async () => {
    if (!hasValidAmount) return;
    await tipAsync({ functionName: "tip", args: [amountWei, message] });
    notification.success("Tip sent!");
    setAmount("");
    setMessage("");
    await refetchAllowance();
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-md">
      <div className="card-body gap-4">
        <h2 className="card-title">Send a tip</h2>

        <div className="flex justify-between text-sm opacity-70">
          <span>Your USDC balance</span>
          <span>{usdcBalance !== undefined ? `${formatUnits(usdcBalance, USDC_DECIMALS)} USDC` : "—"}</span>
        </div>

        <label className="form-control w-full">
          <span className="label-text mb-1">Amount (USDC)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="1.00"
            className="input input-bordered w-full"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">Message (optional)</span>
          <textarea
            placeholder="gm ☕"
            className="textarea textarea-bordered w-full"
            maxLength={280}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </label>

        {insufficientBalance && <p className="text-error text-sm m-0">Amount exceeds your USDC balance.</p>}

        {needsApproval ? (
          <button
            className="btn btn-secondary"
            disabled={!connectedAddress || !hasValidAmount || insufficientBalance || isApproving}
            onClick={handleApprove}
          >
            {isApproving ? <span className="loading loading-spinner loading-sm" /> : "Approve USDC"}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={!connectedAddress || !hasValidAmount || insufficientBalance || isTipping}
            onClick={handleTip}
          >
            {isTipping ? <span className="loading loading-spinner loading-sm" /> : "Send tip"}
          </button>
        )}

        {!connectedAddress && <p className="text-center text-sm opacity-70 m-0">Connect your wallet to tip.</p>}
      </div>
    </div>
  );
};
