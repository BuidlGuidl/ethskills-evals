"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { USDC_DECIMALS, formatUsdc, parseUsdc } from "~~/utils/usdc";

const QUICK_AMOUNTS = ["1", "5", "25"];
/** Mirrors `TipJar.MAX_MESSAGE_LENGTH`. */
const MAX_MESSAGE_BYTES = 140;

const messageByteLength = (message: string) => new TextEncoder().encode(message).length;

/**
 * The tip form: pick an amount, leave a message, approve USDC once, then tip.
 *
 * Approve and tip are separate transactions with separate pending states, so the spinner
 * always sits on the button that is actually waiting for a wallet.
 */
export const TipForm = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const { data: tipJarInfo } = useDeployedContractInfo({ contractName: "TipJar" });
  const tipJarAddress = tipJarInfo?.address;

  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { data: allowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress, tipJarAddress],
  });

  const { writeContractAsync: writeUsdc, isMining: isApproving } = useScaffoldWriteContract({
    contractName: "USDC",
  });
  const { writeContractAsync: writeTipJar, isMining: isTipping } = useScaffoldWriteContract({
    contractName: "TipJar",
  });

  const parsedAmount = parseUsdc(amount);
  const hasAmount = parsedAmount !== undefined;
  const messageBytes = messageByteLength(message);

  const isAmountMalformed = amount.trim().length > 0 && !hasAmount;
  const isOverBalance = hasAmount && usdcBalance !== undefined && parsedAmount > usdcBalance;
  const isMessageTooLong = messageBytes > MAX_MESSAGE_BYTES;
  const needsApproval = hasAmount && allowance !== undefined && allowance < parsedAmount;

  const canApprove = isConnected && hasAmount && !isOverBalance && !isApproving && !isTipping;
  const canTip =
    isConnected && hasAmount && !isOverBalance && !isMessageTooLong && !needsApproval && !isApproving && !isTipping;

  const handleApprove = async () => {
    if (!parsedAmount || !tipJarAddress) return;

    try {
      await writeUsdc({
        functionName: "approve",
        args: [tipJarAddress, parsedAmount],
      });
    } catch (error) {
      // useTransactor already surfaced this to the user; keep the form state intact so they can retry.
      console.error("USDC approval failed", error);
    }
  };

  const handleTip = async () => {
    if (!parsedAmount) return;

    try {
      await writeTipJar({
        functionName: "tip",
        args: [parsedAmount, message],
      });
      notification.success("Thanks for the tip!");
      setAmount("");
      setMessage("");
    } catch (error) {
      console.error("Tip failed", error);
    }
  };

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="card-title text-xl m-0">Send a tip</h2>
          {isConnected && <span className="text-sm opacity-70">Balance: {formatUsdc(usdcBalance)} USDC</span>}
        </div>

        <div className="form-control">
          <label className="label pt-0" htmlFor="tip-amount">
            <span className="label-text">Amount</span>
          </label>
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="opacity-60">$</span>
            <input
              id="tip-amount"
              className="grow"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
            <span className="badge badge-ghost">USDC</span>
          </label>
          <div className="flex gap-2 mt-2">
            {QUICK_AMOUNTS.map(quickAmount => (
              <button
                key={quickAmount}
                type="button"
                className={`btn btn-xs ${amount === quickAmount ? "btn-primary" : "btn-ghost border-base-300"}`}
                onClick={() => setAmount(quickAmount)}
              >
                ${quickAmount}
              </button>
            ))}
          </div>
        </div>

        <div className="form-control">
          <label className="label" htmlFor="tip-message">
            <span className="label-text">Message (optional)</span>
            <span className={`label-text-alt ${isMessageTooLong ? "text-error" : "opacity-60"}`}>
              {messageBytes}/{MAX_MESSAGE_BYTES}
            </span>
          </label>
          <textarea
            id="tip-message"
            className={`textarea textarea-bordered w-full ${isMessageTooLong ? "textarea-error" : ""}`}
            rows={2}
            placeholder="Say something nice…"
            value={message}
            onChange={event => setMessage(event.target.value)}
          />
        </div>

        {isAmountMalformed && <p className="text-error text-sm m-0">Enter an amount like 2.50.</p>}
        {isOverBalance && (
          <p className="text-error text-sm m-0">That is more than your {formatUsdc(usdcBalance)} USDC balance.</p>
        )}
        {isMessageTooLong && (
          <p className="text-error text-sm m-0">Messages are limited to {MAX_MESSAGE_BYTES} bytes onchain.</p>
        )}

        <div className="card-actions flex-col gap-2">
          {needsApproval && (
            <button className="btn btn-secondary w-full" onClick={handleApprove} disabled={!canApprove}>
              {isApproving ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Approving…
                </>
              ) : (
                `Approve ${amount || "0"} USDC`
              )}
            </button>
          )}

          <button className="btn btn-primary w-full" onClick={handleTip} disabled={!canTip}>
            {isTipping ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Sending tip…
              </>
            ) : (
              "Send tip"
            )}
          </button>

          {!isConnected && <p className="text-sm text-center opacity-70 m-0">Connect a wallet to send a tip.</p>}
          {isConnected && needsApproval && (
            <p className="text-sm text-center opacity-70 m-0">
              USDC needs a one-time approval before the jar can pull your tip.
            </p>
          )}
        </div>

        <p className="text-xs opacity-50 m-0">
          Amounts are in USDC ({USDC_DECIMALS} decimals). Tips and messages are stored onchain and are public.
        </p>
      </div>
    </div>
  );
};
