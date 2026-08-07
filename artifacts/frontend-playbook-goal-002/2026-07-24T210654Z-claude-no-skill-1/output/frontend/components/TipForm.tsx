'use client';

import { useEffect, useState } from 'react';
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { erc20Abi, tipJarAbi } from '@/lib/abi';
import {
  TIP_JAR_ADDRESS,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_IS_MOCK,
} from '@/lib/contracts';

function parseAmount(input: string): bigint | null {
  if (!input.trim()) return null;
  try {
    const wei = parseUnits(input, USDC_DECIMALS);
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
}

export function TipForm() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  const amountWei = parseAmount(amount);

  // --- reads: balance + allowance ---
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, TIP_JAR_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const needsApproval =
    amountWei !== null && (allowance === undefined || (allowance as bigint) < amountWei);

  // --- writes ---
  const approve = useWriteContract();
  const sendTip = useWriteContract();
  const faucet = useWriteContract();

  const approveReceipt = useWaitForTransactionReceipt({ hash: approve.data });
  const tipReceipt = useWaitForTransactionReceipt({ hash: sendTip.data });
  const faucetReceipt = useWaitForTransactionReceipt({ hash: faucet.data });

  // Refetch allowance once an approval confirms.
  useEffect(() => {
    if (approveReceipt.isSuccess) refetchAllowance();
  }, [approveReceipt.isSuccess, refetchAllowance]);

  // Clear the form once a tip confirms.
  useEffect(() => {
    if (tipReceipt.isSuccess) {
      setAmount('');
      setMessage('');
      refetchAllowance();
      refetchBalance();
    }
  }, [tipReceipt.isSuccess, refetchAllowance, refetchBalance]);

  // Refresh balance after minting from the faucet.
  useEffect(() => {
    if (faucetReceipt.isSuccess) refetchBalance();
  }, [faucetReceipt.isSuccess, refetchBalance]);

  const busy =
    approve.isPending ||
    approveReceipt.isLoading ||
    sendTip.isPending ||
    tipReceipt.isLoading;

  function onApprove() {
    if (!amountWei) return;
    approve.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [TIP_JAR_ADDRESS, amountWei],
    });
  }

  function onSendTip() {
    if (!amountWei) return;
    sendTip.writeContract({
      address: TIP_JAR_ADDRESS,
      abi: tipJarAbi,
      functionName: 'tip',
      args: [amountWei, message],
    });
  }

  function onMint() {
    if (!address) return;
    faucet.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'mint',
      args: [address, parseUnits('100', USDC_DECIMALS)],
    });
  }

  const insufficientBalance =
    amountWei !== null && balance !== undefined && (balance as bigint) < amountWei;

  const writeError = approve.error || sendTip.error;

  if (!isConnected) {
    return (
      <div className="card">
        <h2>Send a tip</h2>
        <p className="muted">
          Connect your wallet to send a USDC tip and see your balance.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Send a tip</h2>

      <div className="row" style={{ marginBottom: 16 }}>
        <span className="muted">Your USDC balance</span>
        <strong>
          {balance !== undefined
            ? `${formatUnits(balance as bigint, USDC_DECIMALS)} USDC`
            : '—'}
        </strong>
      </div>

      <label className="field">
        <span className="cap">Amount (USDC)</span>
        <input
          inputMode="decimal"
          placeholder="5.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>

      <label className="field">
        <span className="cap">Message (optional)</span>
        <textarea
          placeholder="gm ☕ thanks for the great work!"
          maxLength={280}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>

      {needsApproval ? (
        <button
          className="primary"
          onClick={onApprove}
          disabled={!amountWei || busy || insufficientBalance}
        >
          {approve.isPending || approveReceipt.isLoading
            ? 'Approving…'
            : 'Approve USDC'}
        </button>
      ) : (
        <button
          className="primary"
          onClick={onSendTip}
          disabled={!amountWei || busy || insufficientBalance}
        >
          {sendTip.isPending || tipReceipt.isLoading ? 'Sending…' : 'Send tip'}
        </button>
      )}

      {insufficientBalance && (
        <div className="notice error">
          Not enough USDC.{' '}
          {USDC_IS_MOCK ? 'Use the faucet below to mint test USDC.' : ''}
        </div>
      )}

      {needsApproval && amountWei !== null && !insufficientBalance && (
        <div className="notice info">
          USDC uses a two-step flow: first approve the tip jar to spend your
          USDC, then send the tip.
        </div>
      )}

      {tipReceipt.isSuccess && (
        <div className="notice info">Tip sent — thank you! 🎉</div>
      )}

      {writeError && (
        <div className="notice error">
          {(writeError as { shortMessage?: string }).shortMessage ||
            writeError.message}
        </div>
      )}

      {USDC_IS_MOCK && (
        <div className="faucet-row" style={{ marginTop: 18 }}>
          <span className="muted">Local dev: need test USDC?</span>
          <button
            className="ghost"
            onClick={onMint}
            disabled={faucet.isPending || faucetReceipt.isLoading}
          >
            {faucet.isPending || faucetReceipt.isLoading
              ? 'Minting…'
              : 'Mint 100 test USDC'}
          </button>
        </div>
      )}
    </div>
  );
}
