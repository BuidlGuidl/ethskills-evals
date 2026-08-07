"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

/** Parse a human USDC amount into 6-decimal base units; returns 0n on invalid input. */
const parseUsdc = (value: string): bigint => {
  if (!value || Number.isNaN(Number(value))) return 0n;
  try {
    return parseUnits(value, USDC_DECIMALS);
  } catch {
    return 0n;
  }
};

/**
 * Form to send a USDC tip. USDC is an ERC-20, so tipping is a two-step flow:
 * first `approve` the jar to pull the amount, then call `tip`. The button shows
 * whichever step is next and each step has its own pending state.
 */
export const TipForm = () => {
  const { address: connectedAddress } = useAccount();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });

  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const parsedAmount = parseUsdc(amount);

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

  const { writeContractAsync: writeUsdc, isPending: isApproving } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: writeTipJar, isPending: isTipping } = useScaffoldWriteContract({ contractName: "TipJar" });

  const hasAmount = parsedAmount > 0n;
  const insufficientBalance = usdcBalance !== undefined && parsedAmount > usdcBalance;
  // Treat an unknown (still-loading) allowance as 0 so we never show "Send tip" before the
  // jar is actually approved — that would just revert.
  const needsApproval = parsedAmount > (allowance ?? 0n);

  const handleApprove = async () => {
    if (!tipJar?.address) return;
    await writeUsdc({ functionName: "approve", args: [tipJar.address, parsedAmount] });
    await refetchAllowance();
  };

  const handleTip = async () => {
    await writeTipJar({ functionName: "tip", args: [parsedAmount, message] });
    setAmount("");
    setMessage("");
    await refetchAllowance();
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Send a tip</h2>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">Amount (USDC)</span>
            <span className="label-text-alt">
              Balance: {usdcBalance === undefined ? "—" : formatUnits(usdcBalance, USDC_DECIMALS)}
            </span>
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="5.00"
            className="input input-bordered w-full"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">Message</span>
          </div>
          <input
            type="text"
            maxLength={140}
            placeholder="gm, thanks for building!"
            className="input input-bordered w-full"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </label>

        {insufficientBalance && <p className="text-error text-sm">Amount exceeds your USDC balance.</p>}

        {!connectedAddress ? (
          <button className="btn btn-primary" disabled>
            Connect a wallet to tip
          </button>
        ) : needsApproval ? (
          <button
            className="btn btn-primary"
            disabled={!hasAmount || insufficientBalance || isApproving}
            onClick={handleApprove}
          >
            {isApproving ? <span className="loading loading-spinner loading-sm" /> : "Approve USDC"}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={!hasAmount || insufficientBalance || isTipping}
            onClick={handleTip}
          >
            {isTipping ? <span className="loading loading-spinner loading-sm" /> : "Send tip"}
          </button>
        )}
      </div>
    </div>
  );
};
