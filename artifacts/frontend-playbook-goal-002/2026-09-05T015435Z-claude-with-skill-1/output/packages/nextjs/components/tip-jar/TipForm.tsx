"use client";

import { useState } from "react";
import { BaseInput } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { ArrowPathIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { MAX_MESSAGE_LENGTH, QUICK_AMOUNTS, formatUsdc, parseUsdc } from "~~/utils/tip-jar";

/**
 * Send a tip: approve the jar for the USDC amount (only when the current
 * allowance is not enough), then call `tip`.
 */
export const TipForm = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });
  const { writeContractAsync: writeUsdc, isMining: isApproving } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: writeTipJar, isMining: isTipping } = useScaffoldWriteContract({ contractName: "TipJar" });

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

  const parsedAmount = parseUsdc(amount);
  const amountIsInvalid = amount.trim() !== "" && parsedAmount === undefined;
  const messageBytes = new TextEncoder().encode(message).length;
  const messageIsTooLong = messageBytes > MAX_MESSAGE_LENGTH;
  const hasEnoughBalance = parsedAmount === undefined || usdcBalance === undefined || parsedAmount <= usdcBalance;
  const needsApproval = parsedAmount !== undefined && (allowance === undefined || allowance < parsedAmount);
  const canSubmit = parsedAmount !== undefined && !messageIsTooLong && hasEnoughBalance && !isApproving && !isTipping;

  const handleApprove = async () => {
    if (parsedAmount === undefined || !tipJar) return;

    await writeUsdc({ functionName: "approve", args: [tipJar.address, parsedAmount] });
    await refetchAllowance();
  };

  const handleTip = async () => {
    if (parsedAmount === undefined) return;

    await writeTipJar({ functionName: "tip", args: [parsedAmount, message] });
    setAmount("");
    setMessage("");
    await refetchAllowance();
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-6 shadow-md w-full">
      <h2 className="text-xl font-bold m-0">Leave a tip</h2>
      <p className="text-sm opacity-70 mt-1 mb-5">
        Tips are paid in USDC on Base. Approving lets the jar pull the amount from your wallet.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="text-sm font-medium">Amount</label>
            <span className="text-xs opacity-70">
              {isConnected ? `Wallet: ${formatUsdc(usdcBalance)} USDC` : "Wallet not connected"}
            </span>
          </div>
          <BaseInput
            name="amount"
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
            error={amountIsInvalid || !hasEnoughBalance}
            disabled={!isConnected}
            suffix={<span className="self-center pr-4 font-medium opacity-70">USDC</span>}
          />
          <div className="flex gap-2 mt-2">
            {QUICK_AMOUNTS.map(quickAmount => (
              <button
                key={quickAmount}
                type="button"
                className="btn btn-xs btn-outline"
                disabled={!isConnected}
                onClick={() => setAmount(quickAmount)}
              >
                {quickAmount} USDC
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="text-sm font-medium">Message</label>
            <span className={`text-xs ${messageIsTooLong ? "text-error" : "opacity-70"}`}>
              {messageBytes}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
          <BaseInput
            name="message"
            value={message}
            onChange={setMessage}
            placeholder="Say something nice (optional)"
            error={messageIsTooLong}
            disabled={!isConnected}
          />
        </div>

        {!hasEnoughBalance && (
          <p className="text-sm text-error m-0">
            Not enough USDC. Run <code className="bg-base-300 px-1">yarn fund {connectedAddress}</code> to top up on the
            local fork.
          </p>
        )}

        {!isConnected ? (
          <div className="flex justify-center pt-1">
            <RainbowKitCustomConnectButton />
          </div>
        ) : needsApproval ? (
          <button className="btn btn-primary" disabled={!canSubmit} onClick={handleApprove}>
            {isApproving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
            Approve {parsedAmount !== undefined ? formatUsdc(parsedAmount) : ""} USDC
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!canSubmit} onClick={handleTip}>
            {isTipping ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
            Send tip
          </button>
        )}

        {isConnected && !needsApproval && parsedAmount !== undefined && (
          <p className="text-xs opacity-70 flex items-center gap-1 m-0">
            <CheckCircleIcon className="h-4 w-4" />
            Approved for {formatUsdc(allowance)} USDC
          </p>
        )}
      </div>
    </div>
  );
};
