import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";

import {
  TIP_JAR_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  tipJarAbi,
  usdcAbi,
} from "../contracts";

export function TipForm() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("1");
  const [message, setMessage] = useState("");

  // Parse the human amount ("2.50") into USDC's 6-decimal base units.
  const parsedAmount = useMemo(() => {
    try {
      if (!amount) return 0n;
      const v = parseUnits(amount, USDC_DECIMALS);
      return v > 0n ? v : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "allowance",
    args: address ? [address, TIP_JAR_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const needsApproval =
    allowance === undefined || allowance < parsedAmount;
  const insufficientBalance =
    balance !== undefined && parsedAmount > balance;

  // --- write flows -----------------------------------------------------------
  const approve = useWriteContract();
  const tip = useWriteContract();
  const faucet = useWriteContract();

  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const tipReceipt = useWaitForTransactionReceipt({ hash: tip.data });
  const faucetReceipt = useWaitForTransactionReceipt({ hash: faucet.data });

  // Refresh reads whenever a tx confirms.
  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);

  useEffect(() => {
    if (faucetReceipt.isSuccess) refetchBalance();
  }, [faucetReceipt.isSuccess, refetchBalance]);

  useEffect(() => {
    if (tipReceipt.isSuccess) {
      refetchBalance();
      refetchAllowance();
      setMessage("");
    }
  }, [tipReceipt.isSuccess, refetchBalance, refetchAllowance]);

  const onApprove = () =>
    approve.writeContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: "approve",
      args: [TIP_JAR_ADDRESS, parsedAmount],
    });

  const onTip = () =>
    tip.writeContract({
      address: TIP_JAR_ADDRESS,
      abi: tipJarAbi,
      functionName: "tip",
      args: [parsedAmount, message],
    });

  const onFaucet = () =>
    faucet.writeContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: "faucet",
    });

  const approving = approve.isPending || approveReceipt.isLoading;
  const tipping = tip.isPending || tipReceipt.isLoading;
  const fauceting = faucet.isPending || faucetReceipt.isLoading;

  const txError =
    approve.error || tip.error || faucet.error;

  return (
    <div className="card">
      <h2>Send a tip</h2>

      {!isConnected ? (
        <p className="muted">Connect your wallet to send a tip.</p>
      ) : (
        <>
          <div className="balance-row">
            <span className="muted">Your USDC balance</span>
            <span className="mono">
              {balance !== undefined
                ? `$${formatUnits(balance, USDC_DECIMALS)}`
                : "—"}
            </span>
          </div>

          <label className="field">
            <span>Amount (USDC)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1.00"
            />
          </label>

          <label className="field">
            <span>Message (optional)</span>
            <input
              type="text"
              maxLength={140}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="gm! keep building"
            />
          </label>

          {insufficientBalance && (
            <p className="warn">Not enough USDC for this amount.</p>
          )}

          <div className="actions">
            {needsApproval ? (
              <button
                className="btn primary"
                disabled={
                  approving || parsedAmount === 0n || insufficientBalance
                }
                onClick={onApprove}
              >
                {approving ? "Approving…" : "1. Approve USDC"}
              </button>
            ) : (
              <button
                className="btn primary"
                disabled={
                  tipping || parsedAmount === 0n || insufficientBalance
                }
                onClick={onTip}
              >
                {tipping ? "Sending…" : "Send tip"}
              </button>
            )}

            <button
              className="btn ghost"
              disabled={fauceting}
              onClick={onFaucet}
              title="Local MockUSDC only — mints 1,000 test USDC"
            >
              {fauceting ? "Minting…" : "Get test USDC"}
            </button>
          </div>

          {tipReceipt.isSuccess && (
            <p className="success">Tip sent — thank you! 🎉</p>
          )}
          {txError && (
            <p className="warn">
              {(txError as { shortMessage?: string }).shortMessage ??
                "Transaction failed."}
            </p>
          )}

          <p className="hint">
            Tips need two transactions the first time: an ERC-20{" "}
            <em>approve</em>, then the tip itself.
          </p>
        </>
      )}
    </div>
  );
}
