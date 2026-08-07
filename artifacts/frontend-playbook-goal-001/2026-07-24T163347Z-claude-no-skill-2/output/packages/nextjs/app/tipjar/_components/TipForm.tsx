"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const USDC_DECIMALS = 6;

export const TipForm = () => {
  const { address: connectedAddress } = useAccount();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const { data: tipJar } = useScaffoldContract({ contractName: "TipJar" });
  const { writeContractAsync: writeUsdc } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: writeTipJar, isMining } = useScaffoldWriteContract({ contractName: "TipJar" });

  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { data: allowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress, tipJar?.address],
  });

  // Guard against malformed input before hitting parseUnits.
  const isValidAmount = /^\d*\.?\d+$/.test(amount) && Number(amount) > 0;
  const parsedAmount = isValidAmount ? parseUnits(amount, USDC_DECIMALS) : 0n;
  const needsApproval = allowance !== undefined && parsedAmount > 0n && allowance < parsedAmount;
  const hasBalance = usdcBalance === undefined || parsedAmount <= usdcBalance;

  const handleApprove = async () => {
    if (!tipJar?.address) return;
    try {
      await writeUsdc({ functionName: "approve", args: [tipJar.address, parsedAmount] });
    } catch (e) {
      console.error("Approve failed", e);
    }
  };

  const handleTip = async () => {
    if (!isValidAmount) {
      notification.error("Enter a valid USDC amount");
      return;
    }
    try {
      await writeTipJar({ functionName: "tip", args: [parsedAmount, message] });
      setAmount("");
      setMessage("");
    } catch (e) {
      console.error("Tip failed", e);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Send a tip</h2>

        <label className="form-control w-full">
          <span className="label-text mb-1">Amount (USDC)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="5.00"
            className="input input-bordered w-full"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          {connectedAddress && usdcBalance !== undefined && (
            <span className="label-text-alt mt-1 opacity-70">
              Balance: {formatUnits(usdcBalance, USDC_DECIMALS)} USDC
            </span>
          )}
        </label>

        <label className="form-control w-full">
          <span className="label-text mb-1">Message</span>
          <input
            type="text"
            placeholder="gm, thanks for the great work!"
            className="input input-bordered w-full"
            maxLength={280}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </label>

        {!hasBalance && isValidAmount && <p className="text-error text-sm m-0">Not enough USDC in your wallet.</p>}

        {!connectedAddress ? (
          <button className="btn btn-primary" disabled>
            Connect a wallet to tip
          </button>
        ) : needsApproval ? (
          <button className="btn btn-primary" onClick={handleApprove} disabled={!isValidAmount || !hasBalance}>
            Approve {isValidAmount ? amount : ""} USDC
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleTip} disabled={!isValidAmount || !hasBalance || isMining}>
            {isMining ? "Sending…" : "Send tip"}
          </button>
        )}

        {needsApproval && (
          <p className="text-xs opacity-70 m-0">
            USDC requires a one-time approval per amount before the jar can pull your tip.
          </p>
        )}
      </div>
    </div>
  );
};
