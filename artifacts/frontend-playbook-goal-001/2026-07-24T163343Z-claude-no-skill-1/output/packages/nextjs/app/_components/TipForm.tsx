"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { USDC_DECIMALS, formatUsdc, parseUsdc } from "~~/utils/usdc";

/**
 * Form to send a USDC tip. Handles the ERC20 approve -> tip two-step: if the jar
 * is not yet approved for the entered amount, it approves first, then tips.
 */
export const TipForm = () => {
  const { address: connectedAddress } = useAccount();
  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });

  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: balance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { data: allowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress, tipJar?.address],
  });

  const { writeContractAsync: writeUsdc } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: writeTipJar } = useScaffoldWriteContract({ contractName: "TipJar" });

  const parsedAmount = (() => {
    try {
      return amount ? parseUsdc(amount) : 0n;
    } catch {
      return null; // malformed input (too many decimals, letters, ...)
    }
  })();

  const handleTip = async () => {
    if (parsedAmount === null || parsedAmount <= 0n) {
      notification.error("Enter a valid USDC amount");
      return;
    }
    if (balance !== undefined && parsedAmount > balance) {
      notification.error("Amount exceeds your USDC balance");
      return;
    }

    setBusy(true);
    try {
      // Approve the jar for this tip if the current allowance is not enough.
      if (allowance === undefined || allowance < parsedAmount) {
        await writeUsdc({
          functionName: "approve",
          args: [tipJar?.address, parsedAmount],
        });
      }

      await writeTipJar({
        functionName: "tip",
        args: [parsedAmount, message],
      });

      setAmount("");
      setMessage("");
    } catch (e) {
      // errors are surfaced by the SE-2 transactor; nothing extra to do here
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const disabled = !connectedAddress || busy || !parsedAmount;

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Leave a tip</h2>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">Amount (USDC)</span>
            {balance !== undefined && <span className="label-text-alt">Balance: {formatUsdc(balance)} USDC</span>}
          </div>
          <input
            type="number"
            min="0"
            step={`${1 / 10 ** USDC_DECIMALS}`}
            placeholder="5.00"
            className="input input-bordered w-full"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">Message (optional)</span>
          </div>
          <input
            type="text"
            maxLength={280}
            placeholder="gm, thanks for building!"
            className="input input-bordered w-full"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </label>

        <button className="btn btn-primary" onClick={handleTip} disabled={disabled}>
          {busy && <span className="loading loading-spinner loading-sm" />}
          {connectedAddress ? "Send tip" : "Connect wallet to tip"}
        </button>

        <p className="text-xs opacity-70">
          Tipping approves USDC for the tip jar (if needed) and then sends the tip in a second transaction.
        </p>
      </div>
    </div>
  );
};
