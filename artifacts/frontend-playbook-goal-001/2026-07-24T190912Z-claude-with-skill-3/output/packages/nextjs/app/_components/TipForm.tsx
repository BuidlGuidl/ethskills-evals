"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { USDC_DECIMALS, formatUsdc } from "~~/utils/usdc";

const MAX_MESSAGE_LENGTH = 140;

export const TipForm = () => {
  const { address: connectedAddress } = useAccount();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const { data: tipJar } = useScaffoldContract({ contractName: "TipJar" });
  const jarAddress = tipJar?.address;

  const { data: allowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress, jarAddress],
  });
  const { data: balance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { writeContractAsync: approveUsdc, isPending: isApproving } = useScaffoldWriteContract({
    contractName: "USDC",
  });
  const { writeContractAsync: sendTip, isPending: isTipping } = useScaffoldWriteContract({ contractName: "TipJar" });

  // Parse the typed amount to USDC base units; invalid input -> 0n.
  let amountUnits = 0n;
  try {
    amountUnits = amount ? parseUnits(amount, USDC_DECIMALS) : 0n;
  } catch {
    amountUnits = 0n;
  }

  const hasAmount = amountUnits > 0n;
  const insufficientBalance = balance !== undefined && amountUnits > balance;
  const needsApproval = allowance !== undefined && amountUnits > allowance;
  const disabled = !connectedAddress || !hasAmount || insufficientBalance || !jarAddress;

  const handleApprove = async () => {
    try {
      await approveUsdc({ functionName: "approve", args: [jarAddress, amountUnits] });
    } catch (e) {
      console.error(e);
    }
  };

  const handleTip = async () => {
    try {
      await sendTip({ functionName: "tip", args: [amountUnits, message] });
      notification.success("Tip sent — thank you!");
      setAmount("");
      setMessage("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="card bg-base-100 shadow-md mb-6">
      <div className="card-body gap-4">
        <h2 className="card-title">Leave a tip</h2>

        <div className="form-control">
          <label className="label" htmlFor="tip-amount">
            <span className="label-text">Amount (USDC)</span>
            {balance !== undefined && <span className="label-text-alt">Balance: {formatUsdc(balance)} USDC</span>}
          </label>
          <input
            id="tip-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="1.00"
            className="input input-bordered w-full"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          {insufficientBalance && <span className="text-error text-sm mt-1">Amount exceeds your USDC balance.</span>}
        </div>

        <div className="form-control">
          <label className="label" htmlFor="tip-message">
            <span className="label-text">Message</span>
            <span className="label-text-alt">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </label>
          <input
            id="tip-message"
            type="text"
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="gm ☕️"
            className="input input-bordered w-full"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        {!connectedAddress ? (
          <p className="text-center text-base-content/60">Connect a wallet to send a tip.</p>
        ) : needsApproval ? (
          <button className="btn btn-primary" disabled={disabled || isApproving} onClick={handleApprove}>
            {isApproving && <span className="loading loading-spinner loading-sm" />}
            Approve {hasAmount ? formatUsdc(amountUnits) : ""} USDC
          </button>
        ) : (
          <button className="btn btn-primary" disabled={disabled || isTipping} onClick={handleTip}>
            {isTipping && <span className="loading loading-spinner loading-sm" />}
            Send tip
          </button>
        )}
      </div>
    </div>
  );
};
