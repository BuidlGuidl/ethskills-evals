"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  TIP_JAR_ADDRESS,
  USDC_ADDRESS,
  tipJarAbi,
  usdcAbi,
} from "../contracts";
import { formatUsdc } from "../lib/format";

const MAX_MESSAGE_LENGTH = 280;

export function TipForm({ onTipped }: { onTipped: () => void }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("5");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "allowance",
    args: address ? [address, TIP_JAR_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  async function handleFaucet() {
    setError(null);
    setStatus(null);
    try {
      setBusy(true);
      setStatus("Requesting test USDC from the faucet…");
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: usdcAbi,
        functionName: "faucet",
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      await refetchBalance();
      setStatus("Received 1,000 test USDC 🎉");
    } catch (err) {
      setError(readableError(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);

    let amountBase: bigint;
    try {
      amountBase = parseUnits(amount || "0", 6);
    } catch {
      setError("Enter a valid USDC amount.");
      return;
    }
    if (amountBase <= 0n) {
      setError("Tip amount must be greater than zero.");
      return;
    }
    if (new TextEncoder().encode(message).length > MAX_MESSAGE_LENGTH) {
      setError(`Message must be ${MAX_MESSAGE_LENGTH} bytes or fewer.`);
      return;
    }
    if (balance !== undefined && amountBase > (balance as bigint)) {
      setError("You don't have enough USDC. Try the faucet below.");
      return;
    }

    try {
      setBusy(true);

      // Step 1: approve the tip jar to pull USDC, if the allowance is too low.
      if ((allowance as bigint | undefined ?? 0n) < amountBase) {
        setStatus("Approving USDC… confirm in your wallet.");
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: usdcAbi,
          functionName: "approve",
          args: [TIP_JAR_ADDRESS, amountBase],
        });
        await publicClient?.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
      }

      // Step 2: send the tip.
      setStatus("Sending your tip… confirm in your wallet.");
      const tipHash = await writeContractAsync({
        address: TIP_JAR_ADDRESS,
        abi: tipJarAbi,
        functionName: "tip",
        args: [amountBase, message],
      });
      await publicClient?.waitForTransactionReceipt({ hash: tipHash });

      setStatus("Tip sent! Thank you 💙");
      setMessage("");
      await Promise.all([refetchBalance(), refetchAllowance()]);
      onTipped();
    } catch (err) {
      setError(readableError(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="card">
        <h2>Send a tip</h2>
        <p className="muted">Connect your wallet to send a USDC tip.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Send a tip</h2>
      <p className="muted">
        Your balance:{" "}
        <strong>
          {balance !== undefined ? `${formatUsdc(balance as bigint)} USDC` : "…"}
        </strong>
      </p>

      <form onSubmit={handleSubmit} className="tip-form">
        <label>
          Amount (USDC)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        <label>
          Message
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say something nice (optional)"
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
            disabled={busy}
          />
          <span className="counter">
            {message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </label>

        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Working…" : "Send tip"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleFaucet}
            disabled={busy}
            title="Local dev only: mint yourself 1,000 test USDC"
          >
            Get test USDC
          </button>
        </div>
      </form>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function readableError(err: unknown): string {
  const msg =
    (err as { shortMessage?: string; message?: string })?.shortMessage ??
    (err as { message?: string })?.message ??
    "Something went wrong.";
  if (/User rejected|denied/i.test(msg)) return "Transaction rejected.";
  return msg;
}
