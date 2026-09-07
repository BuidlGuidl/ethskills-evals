"use client";

import { useMemo, useState } from "react";
import { BaseInput } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { CheckBadgeIcon, HeartIcon } from "@heroicons/react/24/outline";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { USDC_AMOUNT_PATTERN, formatUsdc, formatUsdcExact, parseUsdc } from "~~/utils/usdc";

const QUICK_AMOUNTS = ["1", "5", "25"];
const FALLBACK_MAX_MESSAGE_LENGTH = 140n;

const byteLength = (value: string) => new TextEncoder().encode(value).length;

/** Amount + message, with the USDC approval that has to happen before the jar can pull the tokens. */
export const TipForm = () => {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const { address: connectedAddress, chain: connectedChain } = useAccount();
  const { targetNetwork } = useTargetNetwork();
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

  const { data: maxMessageLength } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "MAX_MESSAGE_LENGTH",
  });

  // Each button owns its own pending flag, so approving never greys out the wrong control.
  const { writeContractAsync: writeUsdc, isMining: isApproving } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: writeTipJar, isMining: isTipping } = useScaffoldWriteContract({
    contractName: "TipJar",
  });

  const maxMessageBytes = Number(maxMessageLength ?? FALLBACK_MAX_MESSAGE_LENGTH);
  const messageBytes = byteLength(message);

  const parsedAmount = useMemo(() => {
    if (!amount || !USDC_AMOUNT_PATTERN.test(amount)) return undefined;
    try {
      const units = parseUsdc(amount);
      return units > 0n ? units : undefined;
    } catch {
      return undefined;
    }
  }, [amount]);

  const isWrongNetwork = Boolean(connectedChain && connectedChain.id !== targetNetwork.id);
  const hasEnoughBalance = parsedAmount === undefined || usdcBalance === undefined || usdcBalance >= parsedAmount;
  const needsApproval = parsedAmount !== undefined && (allowance ?? 0n) < parsedAmount;
  const isMessageTooLong = messageBytes > maxMessageBytes;

  const blocker = !connectedAddress
    ? "Connect a wallet to send a tip."
    : isWrongNetwork
      ? `Wrong network — switch to ${targetNetwork.name} using the button in the header.`
      : parsedAmount === undefined
        ? amount
          ? "Enter an amount greater than 0, with at most 6 decimals."
          : undefined
        : !hasEnoughBalance
          ? `Not enough USDC — your balance is $${formatUsdc(usdcBalance)}.`
          : isMessageTooLong
            ? `Message is ${messageBytes - maxMessageBytes} bytes too long.`
            : undefined;

  const canSubmit = Boolean(connectedAddress) && !isWrongNetwork && parsedAmount !== undefined && !blocker;

  const handleApprove = async () => {
    if (!parsedAmount || !tipJar?.address) return;
    await writeUsdc({ functionName: "approve", args: [tipJar.address, parsedAmount] });
    await refetchAllowance();
  };

  const handleTip = async () => {
    if (!parsedAmount) return;
    await writeTipJar({ functionName: "tip", args: [parsedAmount, message] });
    setAmount("");
    setMessage("");
    await Promise.all([refetchBalance(), refetchAllowance()]);
  };

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm w-full max-w-xl">
      <div className="card-body gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="card-title text-xl">Leave a tip</h2>
          {connectedAddress && (
            <span
              className="text-sm opacity-70"
              title={usdcBalance ? `${formatUsdcExact(usdcBalance)} USDC` : undefined}
            >
              Balance: ${formatUsdc(usdcBalance)} USDC
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="tip-amount">
            Amount
          </label>
          <BaseInput
            name="tip-amount"
            value={amount}
            onChange={value => {
              if (USDC_AMOUNT_PATTERN.test(value)) setAmount(value);
            }}
            placeholder="0.00"
            prefix={<span className="pl-4 self-center opacity-60">$</span>}
            suffix={<span className="pr-4 self-center opacity-60">USDC</span>}
            error={Boolean(amount) && (parsedAmount === undefined || !hasEnoughBalance)}
            disabled={isApproving || isTipping}
          />
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map(quickAmount => (
              <button
                key={quickAmount}
                type="button"
                className="btn btn-xs btn-ghost border border-base-300"
                onClick={() => setAmount(quickAmount)}
                disabled={isApproving || isTipping}
              >
                ${quickAmount}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label className="text-sm font-medium" htmlFor="tip-message">
              Message <span className="opacity-60 font-normal">(optional)</span>
            </label>
            <span className={`text-xs ${isMessageTooLong ? "text-error" : "opacity-60"}`}>
              {messageBytes}/{maxMessageBytes}
            </span>
          </div>
          <textarea
            id="tip-message"
            className={`textarea textarea-bordered w-full bg-base-200 ${isMessageTooLong ? "textarea-error" : ""}`}
            rows={2}
            placeholder="Say something nice…"
            value={message}
            onChange={event => setMessage(event.target.value)}
            disabled={isApproving || isTipping}
          />
        </div>

        {blocker && <p className="text-sm text-warning m-0">{blocker}</p>}

        {needsApproval ? (
          <button className="btn btn-secondary w-full" onClick={handleApprove} disabled={!canSubmit || isApproving}>
            {isApproving ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Approving…
              </>
            ) : (
              <>
                <CheckBadgeIcon className="h-5 w-5" />
                Approve ${amount || "0"} USDC
              </>
            )}
          </button>
        ) : (
          <button className="btn btn-primary w-full" onClick={handleTip} disabled={!canSubmit || isTipping}>
            {isTipping ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Sending…
              </>
            ) : (
              <>
                <HeartIcon className="h-5 w-5" />
                Send tip
              </>
            )}
          </button>
        )}

        <p className="text-xs opacity-60 m-0">
          Tipping takes two transactions: USDC has to be approved for the jar before the jar can pull it.
        </p>
      </div>
    </div>
  );
};
