"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUsdc, parseUsdc } from "~~/utils/usdc";

const MAX_MESSAGE_LENGTH = 200;
const QUICK_AMOUNTS = ["1", "5", "25"];

type Step = "idle" | "approving" | "tipping";

/**
 * Form to send a USDC tip.
 *
 * USDC is an ERC20, so tipping is approve-then-transferFrom. We only ask for an
 * approval when the current allowance is too small, and then send the tip in the
 * same click.
 */
export const TipForm = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [amountInput, setAmountInput] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<Step>("idle");

  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });

  const { data: usdcBalance, refetch: refetchBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [connectedAddress],
  });
  const { data: allowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [connectedAddress, tipJar?.address],
  });

  const { writeContractAsync: writeUsdc } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: writeTipJar } = useScaffoldWriteContract({ contractName: "TipJar" });

  const amount = parseUsdc(amountInput);
  const isBusy = step !== "idle";
  const amountIsInvalid = amountInput !== "" && (amount === undefined || amount === 0n);
  const notEnoughUsdc = amount !== undefined && usdcBalance !== undefined && amount > usdcBalance;
  const needsApproval = amount !== undefined && (allowance ?? 0n) < amount;
  const canSubmit = isConnected && !!amount && amount > 0n && !notEnoughUsdc && !isBusy && !!tipJar;

  const sendTip = async () => {
    if (!amount || !tipJar) return;
    try {
      if ((allowance ?? 0n) < amount) {
        setStep("approving");
        await writeUsdc({ functionName: "approve", args: [tipJar.address, amount] });
      }
      setStep("tipping");
      await writeTipJar({ functionName: "tip", args: [amount, message] });
      setAmountInput("");
      setMessage("");
    } catch (error) {
      // useTransactor already surfaced the failure as a toast.
      console.error("Tip failed", error);
    } finally {
      setStep("idle");
      refetchAllowance();
      refetchBalance();
    }
  };

  return (
    <div className="bg-base-100 rounded-2xl shadow-md w-full p-6">
      <h2 className="text-lg font-bold mt-0 mb-4">Send a tip</h2>

      <form
        onSubmit={event => {
          event.preventDefault();
          sendTip();
        }}
      >
        <label className="text-sm font-medium" htmlFor="tip-amount">
          Amount (USDC)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <label className="input input-bordered flex grow items-center gap-2">
            <span className="opacity-60">$</span>
            <input
              id="tip-amount"
              className="grow"
              inputMode="decimal"
              placeholder="0.00"
              value={amountInput}
              onChange={event => setAmountInput(event.target.value)}
              disabled={isBusy}
            />
          </label>
          {QUICK_AMOUNTS.map(quick => (
            <button
              key={quick}
              type="button"
              className="btn btn-sm btn-ghost border border-base-300"
              onClick={() => setAmountInput(quick)}
              disabled={isBusy}
            >
              ${quick}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium" htmlFor="tip-message">
          Message <span className="opacity-50">(optional, shown in the feed)</span>
        </label>
        <textarea
          id="tip-message"
          className="textarea textarea-bordered mt-1 w-full"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="gm, thanks for the open source work"
          value={message}
          onChange={event => setMessage(event.target.value)}
          disabled={isBusy}
        />
        <div className="text-right text-xs opacity-50">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </div>

        <div className="mt-4">
          {!isConnected ? (
            <div className="flex flex-col items-center gap-2">
              <RainbowKitCustomConnectButton />
              <span className="text-xs opacity-60">Connect a wallet to tip</span>
            </div>
          ) : (
            <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit}>
              {step === "approving" && <span className="loading loading-spinner loading-xs" />}
              {step === "tipping" && <span className="loading loading-spinner loading-xs" />}
              {step === "approving"
                ? "Approving USDC…"
                : step === "tipping"
                  ? "Sending tip…"
                  : needsApproval && amount
                    ? "Approve & tip"
                    : "Send tip"}
            </button>
          )}
        </div>
      </form>

      <div className="mt-3 min-h-5 text-xs">
        {amountIsInvalid ? (
          <span className="text-error">Enter a valid amount.</span>
        ) : notEnoughUsdc ? (
          <span className="text-error">
            Not enough USDC — your balance is ${formatUsdc(usdcBalance)}. Fund this account with{" "}
            <code>yarn fund {connectedAddress}</code>.
          </span>
        ) : isConnected ? (
          <span className="opacity-60">Your USDC balance: ${formatUsdc(usdcBalance)}</span>
        ) : null}
      </div>
    </div>
  );
};
