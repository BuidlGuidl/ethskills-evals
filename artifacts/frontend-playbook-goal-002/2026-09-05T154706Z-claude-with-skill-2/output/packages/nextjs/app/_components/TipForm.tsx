"use client";

import { useState } from "react";
import { BaseInput } from "@scaffold-ui/components";
import { erc20Abi, parseUnits } from "viem";
import type { Address } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldWriteContract, useTransactor } from "~~/hooks/scaffold-eth";
import { useTipAllowance } from "~~/hooks/tip-jar/useTipAllowance";
import { formatTokenAmount } from "~~/utils/tip-jar/format";

const MAX_MESSAGE_LENGTH = 280;

type TipFormProps = {
  jarAddress?: Address;
  tokenAddress?: Address;
  symbol: string;
  decimals: number;
  balance?: bigint;
  onTipped: () => void;
};

/**
 * Amount + message form for sending a tip.
 *
 * ERC-20 tipping takes two transactions the first time: approve the jar to move
 * `amount`, then call `tip`. The form shows whichever step is next, and tracks the two
 * transactions with separate loading flags so one spinner never blocks the other button.
 */
export const TipForm = ({ jarAddress, tokenAddress, symbol, decimals, balance, onTipped }: TipFormProps) => {
  const { address: connectedAddress } = useAccount();

  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isTipping, setIsTipping] = useState(false);

  const { allowance, refetchAllowance } = useTipAllowance({ tokenAddress, spender: jarAddress });
  const { writeContractAsync: writeTipJar } = useScaffoldWriteContract({ contractName: "TipJar" });
  const { writeContractAsync: writeErc20 } = useWriteContract();
  const transactor = useTransactor();

  // Parse defensively: the input is free text, and parseUnits throws on junk.
  let parsedAmount: bigint | undefined;
  let amountError: string | undefined;
  if (amount.trim() !== "") {
    const trimmed = amount.trim();
    const [, fraction = ""] = trimmed.split(".");
    if (fraction.length > decimals) {
      // parseUnits would silently round these away and charge a different amount
      // than the one on screen, so reject instead.
      amountError = `${symbol} supports at most ${decimals} decimal places`;
    } else {
      try {
        parsedAmount = parseUnits(trimmed, decimals);
        if (parsedAmount <= 0n) {
          parsedAmount = undefined;
          amountError = "Enter an amount greater than zero";
        }
      } catch {
        amountError = "Enter a valid number";
      }
    }
  }

  if (parsedAmount !== undefined && balance !== undefined && parsedAmount > balance) {
    amountError = `You only have ${formatTokenAmount(balance, decimals)} ${symbol}`;
  }

  const messageTooLong = message.length > MAX_MESSAGE_LENGTH;
  const needsApproval = parsedAmount !== undefined && (allowance ?? 0n) < parsedAmount;
  const canSubmit = Boolean(parsedAmount) && !amountError && !messageTooLong;
  const isBusy = isApproving || isTipping;

  const handleApprove = async () => {
    if (!parsedAmount || !tokenAddress || !jarAddress) return;
    setIsApproving(true);
    try {
      await transactor(() =>
        writeErc20({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [jarAddress, parsedAmount],
        }),
      );
      await refetchAllowance();
    } catch (error) {
      // useTransactor already surfaced this to the user; keep it for the console.
      console.error("Approval failed:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleTip = async () => {
    if (!parsedAmount) return;
    setIsTipping(true);
    try {
      await writeTipJar({ functionName: "tip", args: [parsedAmount, message] });
      setAmount("");
      setMessage("");
      await refetchAllowance();
      onTipped();
    } catch (error) {
      console.error("Tip failed:", error);
    } finally {
      setIsTipping(false);
    }
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-6 shadow-md w-full">
      <h2 className="text-xl font-bold mt-0 mb-4">Leave a tip</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="tip-amount" className="text-sm font-medium">
          Amount
        </label>
        <BaseInput
          name="tip-amount"
          value={amount}
          onChange={setAmount}
          placeholder="5.00"
          disabled={isBusy}
          error={Boolean(amountError)}
          suffix={<span className="self-center px-3 text-sm font-medium opacity-70">{symbol}</span>}
        />
        <div className="flex justify-between text-xs min-h-4 mt-1">
          <span className="text-error">{amountError ?? ""}</span>
          {balance !== undefined && (
            <button
              type="button"
              className="link opacity-70 hover:opacity-100"
              onClick={() => setAmount(formatTokenAmount(balance, decimals, decimals))}
              disabled={isBusy}
            >
              Balance: {formatTokenAmount(balance, decimals)} {symbol}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 mt-3">
        <label htmlFor="tip-message" className="text-sm font-medium">
          Message <span className="opacity-60">(optional)</span>
        </label>
        <BaseInput
          name="tip-message"
          value={message}
          onChange={setMessage}
          placeholder="Thanks for the open source work!"
          disabled={isBusy}
          error={messageTooLong}
        />
        <div className={`text-xs text-right mt-1 ${messageTooLong ? "text-error" : "opacity-60"}`}>
          {message.length}/{MAX_MESSAGE_LENGTH}
        </div>
      </div>

      <div className="mt-4">
        {!connectedAddress ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm opacity-70 m-0">Connect a wallet to send a tip.</p>
            <RainbowKitCustomConnectButton />
          </div>
        ) : needsApproval ? (
          <div className="flex flex-col gap-2">
            <button className="btn btn-primary w-full" onClick={handleApprove} disabled={!canSubmit || isBusy}>
              {isApproving ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Approving...
                </>
              ) : (
                `Step 1: Approve ${symbol}`
              )}
            </button>
            <p className="text-xs text-center opacity-60 m-0">
              One-off permission letting the jar move exactly this amount of {symbol}.
            </p>
          </div>
        ) : (
          <button className="btn btn-primary w-full" onClick={handleTip} disabled={!canSubmit || isBusy}>
            {isTipping ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Sending tip...
              </>
            ) : (
              "Send tip"
            )}
          </button>
        )}
      </div>
    </div>
  );
};
