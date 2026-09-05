"use client";

import { useState } from "react";
import { erc20Abi } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useTransactor } from "~~/hooks/scaffold-eth";
import { useUsdc } from "~~/hooks/useUsdc";
import { notification } from "~~/utils/scaffold-eth";
import { MAX_MESSAGE_BYTES, QUICK_AMOUNTS, formatUsdc, messageByteLength, parseUsdc } from "~~/utils/tipJar";

/**
 * Tip form: amount + message, with the ERC20 two-step (approve, then tip) surfaced explicitly
 * so it is obvious which transaction the wallet is being asked to sign.
 */
export const TipForm = () => {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const { isConnected } = useAccount();
  const { tokenAddress, tipJarAddress, symbol, balance, allowance, refetch } = useUsdc();
  const { writeContractAsync: tipAsync, isMining } = useScaffoldWriteContract({ contractName: "TipJar" });
  const { writeContractAsync: writeErc20 } = useWriteContract();
  const transactor = useTransactor();

  const parsedAmount = parseUsdc(amount);
  const messageBytes = messageByteLength(message);

  const insufficientBalance = balance !== undefined && parsedAmount > balance;
  const messageTooLong = messageBytes > MAX_MESSAGE_BYTES;
  const needsApproval = allowance !== undefined && parsedAmount > allowance;

  const amountError = amount !== "" && parsedAmount === 0n ? "Enter an amount greater than 0" : null;
  const error = amountError ?? (insufficientBalance ? `Not enough ${symbol} in your wallet` : null);
  const canSubmit = parsedAmount > 0n && !insufficientBalance && !messageTooLong && !isMining && !isApproving;

  const handleApprove = async () => {
    if (!tokenAddress || !tipJarAddress) return;
    try {
      setIsApproving(true);
      await transactor(() =>
        writeErc20({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [tipJarAddress, parsedAmount],
        }),
      );
      await refetch();
    } catch (e) {
      console.error("Approval failed", e);
    } finally {
      setIsApproving(false);
    }
  };

  const handleTip = async () => {
    try {
      await tipAsync({ functionName: "tip", args: [parsedAmount, message] });
      notification.success("Thanks for the tip! 🫙");
      setAmount("");
      setMessage("");
      await refetch();
    } catch (e) {
      console.error("Tip failed", e);
    }
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-6 w-full max-w-md shadow-md">
      <h2 className="text-xl font-bold mb-1">Leave a tip</h2>
      <p className="text-sm opacity-70 mb-4">
        Tips are paid in {symbol} and land in the jar together with your message.
      </p>

      <label className="block text-sm font-medium mb-1" htmlFor="tip-amount">
        Amount ({symbol})
      </label>
      <div className="flex items-center gap-2 mb-2">
        <input
          id="tip-amount"
          className="input input-bordered w-full"
          placeholder="0.00"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </div>
      <div className="flex gap-2 mb-1">
        {QUICK_AMOUNTS.map(quick => (
          <button key={quick} type="button" className="btn btn-xs btn-outline" onClick={() => setAmount(quick)}>
            {quick} {symbol}
          </button>
        ))}
      </div>
      <p className="text-xs opacity-70 mb-4 h-4">
        {isConnected ? `Wallet balance: ${formatUsdc(balance)} ${symbol}` : ""}
      </p>

      <label className="block text-sm font-medium mb-1" htmlFor="tip-message">
        Message <span className="opacity-60 font-normal">(optional)</span>
      </label>
      <textarea
        id="tip-message"
        className="textarea textarea-bordered w-full"
        rows={2}
        placeholder="Say something nice…"
        value={message}
        onChange={e => setMessage(e.target.value)}
      />
      <p className={`text-xs mt-1 mb-4 ${messageTooLong ? "text-error" : "opacity-70"}`}>
        {messageBytes}/{MAX_MESSAGE_BYTES} bytes
      </p>

      {error && <p className="text-error text-sm mb-3">{error}</p>}

      {!isConnected ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm opacity-70">Connect a wallet to tip.</p>
          <RainbowKitCustomConnectButton />
        </div>
      ) : needsApproval ? (
        <div className="space-y-2">
          <button className="btn btn-primary w-full" disabled={!canSubmit} onClick={handleApprove}>
            {isApproving ? <span className="loading loading-spinner loading-sm" /> : null}
            Step 1: Approve {amount || "0"} {symbol}
          </button>
          <p className="text-xs opacity-70 text-center">
            {symbol} needs an allowance before the jar can pull your tip.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <button className="btn btn-primary w-full" disabled={!canSubmit} onClick={handleTip}>
            {isMining ? <span className="loading loading-spinner loading-sm" /> : null}
            Send tip
          </button>
          {parsedAmount > 0n && allowance !== undefined && (
            <p className="text-xs opacity-70 flex items-center justify-center gap-1">
              <CheckCircleIcon className="h-4 w-4" />
              Approved: {formatUsdc(allowance)} {symbol}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
