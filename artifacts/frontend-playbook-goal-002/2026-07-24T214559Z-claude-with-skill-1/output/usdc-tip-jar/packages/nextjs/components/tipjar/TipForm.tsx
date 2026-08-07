"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const USDC_DECIMALS = 6;
const MAX_MESSAGE_LENGTH = 280;
const PRESETS = ["1", "5", "10", "25"];

/**
 * Form to send a USDC tip. USDC is an ERC-20, so tipping is two steps:
 * approve the TipJar to spend USDC, then call `tip`. The button adapts to
 * whichever step is needed next.
 */
export const TipForm = () => {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const { data: tipJarInfo } = useDeployedContractInfo({ contractName: "TipJar" });
  const tipJarAddress = tipJarInfo?.address;

  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [address],
  });
  const { data: allowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [address, tipJarAddress],
  });

  const { writeContractAsync: writeUsdc, isMining: isApproving } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: writeTipJar, isMining: isTipping } = useScaffoldWriteContract({ contractName: "TipJar" });

  let amountWei: bigint | undefined;
  try {
    amountWei = amount ? parseUnits(amount, USDC_DECIMALS) : undefined;
  } catch {
    amountWei = undefined;
  }

  const hasValidAmount = amountWei !== undefined && amountWei > 0n;
  const insufficientBalance =
    amountWei !== undefined && amountWei > 0n && usdcBalance !== undefined && amountWei > usdcBalance;
  const needsApproval = amountWei !== undefined && amountWei > 0n && (allowance === undefined || allowance < amountWei);
  const messageTooLong = message.length > MAX_MESSAGE_LENGTH;

  const handleApprove = async () => {
    if (!amountWei || !tipJarAddress) return;
    try {
      await writeUsdc({ functionName: "approve", args: [tipJarAddress, amountWei] });
    } catch (e) {
      // errors are surfaced by the scaffold write hook's notification
      console.error(e);
    }
  };

  const handleTip = async () => {
    if (!amountWei) return;
    try {
      await writeTipJar({ functionName: "tip", args: [amountWei, message] });
      notification.success("Tip sent! Thank you 🙏");
      setAmount("");
      setMessage("");
    } catch (e) {
      console.error(e);
    }
  };

  const balanceLabel =
    usdcBalance !== undefined ? `${Number(formatUnits(usdcBalance, USDC_DECIMALS)).toLocaleString()} USDC` : "—";

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-md">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h2 className="card-title m-0">Send a tip</h2>
          <span className="text-sm opacity-70">Balance: {balanceLabel}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Amount (USDC)</label>
          <div className="join">
            <input
              className="input input-bordered join-item w-full"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <span className="btn btn-ghost join-item no-animation pointer-events-none">USDC</span>
          </div>
          <div className="flex gap-2 mt-1">
            {PRESETS.map(p => (
              <button key={p} type="button" className="btn btn-xs btn-outline" onClick={() => setAmount(p)}>
                ${p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Message (optional)</label>
          <textarea
            className="textarea textarea-bordered w-full"
            placeholder="Say something nice…"
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <span className={`text-xs self-end ${messageTooLong ? "text-error" : "opacity-60"}`}>
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>

        {!isConnected ? (
          <div className="alert text-sm">Connect your wallet to send a tip.</div>
        ) : insufficientBalance ? (
          <div className="alert alert-warning text-sm">
            Not enough USDC. On the local fork, run{" "}
            <code className="whitespace-nowrap">yarn fund-usdc &lt;your-address&gt;</code> to get some.
          </div>
        ) : null}

        {needsApproval ? (
          <button
            className="btn btn-primary"
            disabled={!isConnected || !hasValidAmount || insufficientBalance || isApproving}
            onClick={handleApprove}
          >
            {isApproving ? <span className="loading loading-spinner loading-sm" /> : null}
            Approve USDC
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={!isConnected || !hasValidAmount || insufficientBalance || messageTooLong || isTipping}
            onClick={handleTip}
          >
            {isTipping ? <span className="loading loading-spinner loading-sm" /> : null}
            Send tip
          </button>
        )}

        {hasValidAmount && needsApproval && !insufficientBalance ? (
          <p className="text-xs opacity-60 -mt-2">
            Step 1 of 2: approve the tip jar to move your USDC, then the button becomes “Send tip”.
          </p>
        ) : null}
      </div>
    </div>
  );
};
