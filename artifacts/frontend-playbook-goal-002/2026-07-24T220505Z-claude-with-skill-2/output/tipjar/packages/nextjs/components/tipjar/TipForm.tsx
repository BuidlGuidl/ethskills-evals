"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;
const MAX_MESSAGE = 280;

/**
 * Form to send a USDC tip. Handles the two-step ERC20 flow: approve, then tip.
 */
export const TipForm = () => {
  const { address, isConnected } = useAccount();

  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });
  const tipJarAddress = tipJar?.address;

  const { data: balance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [address],
  });
  const { data: allowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [address, tipJarAddress],
  });

  const { writeContractAsync: approveAsync, isMining: isApproving } = useScaffoldWriteContract({
    contractName: "USDC",
  });
  const { writeContractAsync: tipAsync, isMining: isTipping } = useScaffoldWriteContract({
    contractName: "TipJar",
  });

  // Parse the amount, tolerating empty / malformed input.
  let parsedAmount = 0n;
  try {
    parsedAmount = amount ? parseUnits(amount, USDC_DECIMALS) : 0n;
  } catch {
    parsedAmount = 0n;
  }

  const hasAmount = parsedAmount > 0n;
  const insufficientBalance = balance !== undefined && parsedAmount > balance;
  const needsApproval = hasAmount && allowance !== undefined && allowance < parsedAmount;
  const messageTooLong = message.length > MAX_MESSAGE;

  const handleApprove = async () => {
    if (!tipJarAddress) return;
    await approveAsync({
      functionName: "approve",
      args: [tipJarAddress, parsedAmount],
    });
  };

  const handleTip = async () => {
    await tipAsync({
      functionName: "tip",
      args: [parsedAmount, message],
    });
    setAmount("");
    setMessage("");
  };

  return (
    <div className="card bg-base-100 shadow w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Leave a tip</h2>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Amount (USDC)</span>
            {balance !== undefined && (
              <span className="label-text-alt">
                Balance: {Number(formatUnits(balance, USDC_DECIMALS)).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                USDC
              </span>
            )}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="5.00"
            className="input input-bordered w-full"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Message (optional)</span>
            <span className={`label-text-alt ${messageTooLong ? "text-error" : ""}`}>
              {message.length}/{MAX_MESSAGE}
            </span>
          </label>
          <textarea
            placeholder="Thanks for the great work!"
            className="textarea textarea-bordered w-full"
            rows={2}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>

        {insufficientBalance && <p className="text-error text-sm m-0">Not enough USDC in your wallet.</p>}

        {!isConnected ? (
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        ) : needsApproval ? (
          <button
            className="btn btn-primary"
            disabled={!hasAmount || insufficientBalance || messageTooLong || isApproving}
            onClick={handleApprove}
          >
            {isApproving && <span className="loading loading-spinner loading-sm"></span>}
            Approve USDC
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={!hasAmount || insufficientBalance || messageTooLong || isTipping}
            onClick={handleTip}
          >
            {isTipping && <span className="loading loading-spinner loading-sm"></span>}
            Send tip
          </button>
        )}
      </div>
    </div>
  );
};
