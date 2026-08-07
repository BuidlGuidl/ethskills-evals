"use client";

import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const USDC_DECIMALS = 6;

export const TipForm = () => {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tipJar } = useDeployedContractInfo({ contractName: "TipJar" });
  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "balanceOf",
    args: [address],
  });
  const { data: allowance } = useScaffoldReadContract({
    contractName: "USDC",
    functionName: "allowance",
    args: [address, tipJar?.address],
  });

  const { writeContractAsync: writeUsdc } = useScaffoldWriteContract({ contractName: "USDC" });
  const { writeContractAsync: writeTipJar } = useScaffoldWriteContract({ contractName: "TipJar" });

  const formattedBalance =
    usdcBalance === undefined ? undefined : Number(formatUnits(usdcBalance, USDC_DECIMALS)).toLocaleString();

  const handleTip = async () => {
    if (!address) {
      notification.error("Connect a wallet first");
      return;
    }
    if (!tipJar?.address) {
      notification.error("TipJar contract not found on this network. Deploy it first.");
      return;
    }

    let parsed: bigint;
    try {
      parsed = parseUnits(amount.trim(), USDC_DECIMALS);
    } catch {
      notification.error("Enter a valid USDC amount");
      return;
    }
    if (parsed <= 0n) {
      notification.error("Enter an amount greater than zero");
      return;
    }
    if (usdcBalance !== undefined && parsed > usdcBalance) {
      notification.error("Amount exceeds your USDC balance");
      return;
    }

    try {
      setBusy(true);
      // USDC is an ERC20: approve the jar for the tip amount, then let it pull the tokens.
      if (allowance === undefined || allowance < parsed) {
        await writeUsdc({ functionName: "approve", args: [tipJar.address, parsed] });
      }
      await writeTipJar({ functionName: "tip", args: [parsed, message.trim()] });
      setAmount("");
      setMessage("");
    } catch (e) {
      // useScaffoldWriteContract already surfaces a toast; nothing else to do here.
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full">
      <div className="card-body gap-4">
        <h2 className="card-title">Send a tip</h2>

        <label className="form-control w-full">
          <div className="label">
            <span className="label-text">Amount (USDC)</span>
            {formattedBalance !== undefined && (
              <button
                type="button"
                className="label-text-alt link"
                onClick={() => usdcBalance && setAmount(formatUnits(usdcBalance, USDC_DECIMALS))}
              >
                Balance: {formattedBalance} — Max
              </button>
            )}
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
            <span className="label-text-alt">{message.length}/140</span>
          </div>
          <input
            type="text"
            maxLength={140}
            placeholder="Thanks for building this!"
            className="input input-bordered w-full"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </label>

        <button className="btn btn-primary" onClick={handleTip} disabled={busy || !address}>
          {busy ? <span className="loading loading-spinner loading-sm" /> : null}
          {busy ? "Confirming…" : "Send tip"}
        </button>
        <p className="text-xs text-base-content/60">
          The first tip needs two wallet confirmations: one to approve USDC, one to send the tip.
        </p>
      </div>
    </div>
  );
};
