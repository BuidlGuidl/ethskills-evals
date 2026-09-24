"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { encodeFunctionData, formatUnits, parseUnits, type Address, type Hash } from "viem";
import {
  useAccount,
  useBalance,
  useConfig,
  useEstimateFeesPerGas,
  useEstimateGas,
  useReadContract,
  useSimulateContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { AddressDisplay } from "./AddressDisplay";
import { Spinner } from "./Spinner";
import { CHAIN, EXPLORER_URL, USDC } from "@/lib/constants";
import { parseTxError } from "@/lib/errors";
import { formatToken, formatUsd } from "@/lib/format";
import { usePrices } from "@/lib/usePrices";
import { useRecipient } from "@/lib/useRecipient";

const BALANCE_REFRESH_MS = 12_000; // ~1 mainnet block

type Phase = "idle" | "wallet" | "confirming";
type Sent = { hash: Hash; amount: bigint; to: Address; name?: string };

function parseAmount(input: string): { value?: bigint; error?: string } {
  if (!input) return {};
  if (!/^\d*\.?\d*$/.test(input) || input === ".") return { error: "Enter a valid number." };
  const frac = input.split(".")[1] ?? "";
  if (frac.length > USDC.decimals) return { error: `USDC supports up to ${USDC.decimals} decimal places.` };
  const value = parseUnits(input, USDC.decimals);
  if (value === 0n) return { error: "Amount must be greater than 0." };
  return { value };
}

export function PayForm() {
  const config = useConfig();
  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { ethUsd, usdcUsd } = usePrices();

  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<Hash>();
  const [txError, setTxError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  const busy = phase !== "idle";
  const wrongNetwork = isConnected && chainId !== CHAIN.id;

  // Balances are always read from mainnet, even if the wallet is on another chain.
  const eth = useBalance({
    address,
    chainId: CHAIN.id,
    query: { enabled: !!address, refetchInterval: BALANCE_REFRESH_MS },
  });
  const usdc = useReadContract({
    address: USDC.address,
    abi: USDC.abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN.id,
    query: { enabled: !!address, refetchInterval: BALANCE_REFRESH_MS },
  });

  const recipient = useRecipient(recipientInput, address);
  const amount = parseAmount(amountInput);
  const to = recipient.status === "ok" ? recipient.address : undefined;
  const exceedsBalance = amount.value !== undefined && usdc.data !== undefined && amount.value > usdc.data;
  const transferArgs = to && amount.value && !exceedsBalance ? ([to, amount.value] as const) : undefined;
  const canCheck = !!address && !wrongNetwork && !!transferArgs;

  // Dry-run the transfer so reverts (blacklist, paused...) surface before the wallet opens.
  const simulate = useSimulateContract({
    address: USDC.address,
    abi: USDC.abi,
    functionName: "transfer",
    args: transferArgs,
    account: address,
    chainId: CHAIN.id,
    query: { enabled: canCheck && !busy },
  });
  const gas = useEstimateGas({
    account: address,
    to: USDC.address,
    data: transferArgs ? encodeFunctionData({ abi: USDC.abi, functionName: "transfer", args: transferArgs }) : undefined,
    chainId: CHAIN.id,
    query: { enabled: canCheck && !busy },
  });
  const fees = useEstimateFeesPerGas({ chainId: CHAIN.id, query: { refetchInterval: BALANCE_REFRESH_MS } });

  // Wallets require balance >= gasLimit * maxFeePerGas, so check against the max, not the expected fee.
  const maxFeeWei = gas.data && fees.data?.maxFeePerGas ? gas.data * fees.data.maxFeePerGas : undefined;
  const notEnoughGas = maxFeeWei !== undefined && eth.data !== undefined && eth.data.value < maxFeeWei;

  async function send() {
    if (!simulate.data || !transferArgs) return;
    const [sendTo, sendAmount] = transferArgs;
    const sendName = recipient.status === "ok" ? recipient.name : undefined;

    setPhase("wallet");
    setTxError(null);
    setSent(null);
    setTxHash(undefined);
    try {
      const hash = await writeContractAsync(simulate.data.request);
      setTxHash(hash);
      setPhase("confirming");
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: CHAIN.id });
      if (receipt.status !== "success") {
        setTxError("Transaction reverted onchain. No USDC was sent; the network fee was still charged.");
        return;
      }
      await Promise.all([usdc.refetch(), eth.refetch()]);
      setSent({ hash, amount: sendAmount, to: sendTo, name: sendName });
      setRecipientInput("");
      setAmountInput("");
      setTxHash(undefined);
    } catch (e) {
      setTxError(parseTxError(e));
    } finally {
      setPhase("idle"); // always release, including on wallet rejection
    }
  }

  const amountUsd = amount.value !== undefined ? formatUsd(amount.value, USDC.decimals, usdcUsd) : null;
  const feeUsd = maxFeeWei !== undefined ? formatUsd(maxFeeWei, 18, ethUsd) : null;

  // --- Single primary action (connect -> switch network -> send) ---
  let action: { label: string; onClick?: () => void; disabled: boolean; spinner?: boolean };
  if (!isConnected) {
    action = { label: "Connect wallet", onClick: openConnectModal, disabled: !openConnectModal };
  } else if (wrongNetwork) {
    action = {
      label: isSwitching ? "Switching…" : `Switch to ${CHAIN.name}`,
      onClick: () => switchChain({ chainId: CHAIN.id }),
      disabled: isSwitching,
      spinner: isSwitching,
    };
  } else if (phase === "wallet") {
    action = { label: "Confirm in your wallet…", disabled: true, spinner: true };
  } else if (phase === "confirming") {
    action = { label: "Sending…", disabled: true, spinner: true };
  } else if (recipient.status === "empty") {
    action = { label: "Enter a recipient", disabled: true };
  } else if (recipient.status === "resolving") {
    action = { label: "Resolving name…", disabled: true, spinner: true };
  } else if (recipient.status === "invalid") {
    action = { label: "Invalid recipient", disabled: true };
  } else if (amount.value === undefined) {
    action = { label: amount.error ? "Invalid amount" : "Enter an amount", disabled: true };
  } else if (usdc.data === undefined) {
    action = { label: "Loading balance…", disabled: true, spinner: true };
  } else if (exceedsBalance) {
    action = { label: "Insufficient USDC balance", disabled: true };
  } else if (notEnoughGas) {
    action = { label: "Not enough ETH for gas", disabled: true };
  } else if (simulate.isError) {
    action = { label: "Transfer would fail", disabled: true };
  } else if (!simulate.data) {
    action = { label: "Checking…", disabled: true, spinner: true };
  } else {
    action = { label: `Send ${formatToken(amount.value, USDC.decimals)} USDC`, onClick: send, disabled: false };
  }

  return (
    <div className="space-y-6">
      {/* Balances */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-medium text-muted">Your balances</h2>
        {!address ? (
          <p className="text-sm text-muted">Connect a wallet to see your balances.</p>
        ) : (
          <dl className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted">From</dt>
              <dd>
                <AddressDisplay address={address} />
              </dd>
            </div>
            <BalanceRow
              label="USDC"
              value={usdc.data}
              decimals={USDC.decimals}
              price={usdcUsd}
              loading={usdc.isLoading}
              error={usdc.isError}
            />
            <BalanceRow
              label="ETH"
              value={eth.data?.value}
              decimals={18}
              price={ethUsd}
              loading={eth.isLoading}
              error={eth.isError}
              maxFraction={5}
            />
            {eth.data?.value === 0n && (
              <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
                You have no ETH. Sending USDC requires a small amount of ETH on Ethereum to pay the network fee.
              </p>
            )}
          </dl>
        )}
      </section>

      {/* Form */}
      <form
        className="space-y-5 rounded-2xl border border-border bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!action.disabled) action.onClick?.();
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="recipient" className="block text-sm font-medium">
            Recipient
          </label>
          <input
            id="recipient"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value.trim())}
            placeholder="0x… or name.eth"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy}
            aria-invalid={recipient.status === "invalid"}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 font-mono text-sm outline-none focus:border-accent disabled:opacity-60"
          />
          {recipient.status === "invalid" && <p className="text-sm text-danger">{recipient.message}</p>}
          {recipient.status === "resolving" && <p className="text-sm text-muted">Resolving {recipient.name}…</p>}
          {recipient.status === "ok" && (
            <div className="space-y-1">
              <AddressDisplay address={recipient.address} name={recipient.name} />
              {recipient.isContract && (
                <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
                  This address is a smart contract. Only continue if you know it can receive and handle USDC.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="amount" className="block text-sm font-medium">
              Amount
            </label>
            {usdc.data !== undefined && usdc.data > 0n && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAmountInput(formatUnits(usdc.data!, USDC.decimals))}
                className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
              >
                Max
              </button>
            )}
          </div>
          <div className="flex items-center rounded-xl border border-border bg-bg focus-within:border-accent">
            <input
              id="amount"
              value={amountInput}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".").replace(/\s/g, "");
                if (/^\d*\.?\d*$/.test(v)) setAmountInput(v);
              }}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              disabled={busy}
              aria-invalid={!!amount.error || exceedsBalance}
              className="w-full bg-transparent px-3 py-2.5 text-lg outline-none disabled:opacity-60"
            />
            <span className="px-3 text-sm font-medium text-muted">USDC</span>
          </div>
          {amount.error && <p className="text-sm text-danger">{amount.error}</p>}
          {!amount.error && exceedsBalance && <p className="text-sm text-danger">Amount exceeds your USDC balance.</p>}
          {!amount.error && !exceedsBalance && amountUsd && <p className="text-sm text-muted">≈ {amountUsd}</p>}
        </div>

        {/* Review summary, only when everything is valid */}
        {recipient.status === "ok" && amount.value !== undefined && !exceedsBalance && (
          <div className="space-y-1 rounded-xl bg-bg p-3 text-sm">
            <p>
              You send <strong>{formatToken(amount.value, USDC.decimals)} USDC</strong>
              {amountUsd && <span className="text-muted"> (≈ {amountUsd})</span>} to{" "}
              <strong>{recipient.name ?? recipient.address}</strong> on {CHAIN.name}.
            </p>
            {maxFeeWei !== undefined && (
              <p className="text-muted">
                Network fee: up to {formatToken(maxFeeWei, 18, 6)} ETH{feeUsd && ` (≈ ${feeUsd})`}
              </p>
            )}
            <p className="text-muted">Transfers are final and cannot be reversed.</p>
          </div>
        )}

        {/* Inline, persistent errors next to the action */}
        {notEnoughGas && maxFeeWei !== undefined && (
          <p className="text-sm text-danger">
            You need up to {formatToken(maxFeeWei, 18, 6)} ETH for the network fee but have{" "}
            {formatToken(eth.data!.value, 18, 6)} ETH.
          </p>
        )}
        {simulate.isError && !busy && !notEnoughGas && (
          <p className="text-sm text-danger">{parseTxError(simulate.error)}</p>
        )}

        <button
          type="submit"
          disabled={action.disabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {action.spinner && <Spinner />}
          {action.label}
        </button>

        {txHash && (
          <p className="text-sm text-muted">
            Transaction submitted.{" "}
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              View on Etherscan ↗
            </a>
          </p>
        )}

        {txError && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            <span>{txError}</span>
            <button type="button" onClick={() => setTxError(null)} className="shrink-0 underline">
              Dismiss
            </button>
          </div>
        )}

        {sent && (
          <div role="status" className="space-y-1 rounded-lg bg-success-bg px-3 py-2 text-sm text-success">
            <p>
              Sent {formatToken(sent.amount, USDC.decimals)} USDC to {sent.name ?? sent.to}.
            </p>
            <a
              href={`${EXPLORER_URL}/tx/${sent.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on Etherscan ↗
            </a>
          </div>
        )}
      </form>
    </div>
  );
}

function BalanceRow(props: {
  label: string;
  value: bigint | undefined;
  decimals: number;
  price: bigint | undefined;
  loading: boolean;
  error: boolean;
  maxFraction?: number;
}) {
  const { label, value, decimals, price, loading, error, maxFraction } = props;
  let content: React.ReactNode;
  if (value !== undefined) {
    const usd = formatUsd(value, decimals, price);
    content = (
      <>
        <span className="font-medium">
          {formatToken(value, decimals, maxFraction)} {label}
        </span>
        {usd && <span className="ml-2 text-sm text-muted">≈ {usd}</span>}
      </>
    );
  } else if (loading) {
    content = <span className="text-muted">Loading…</span>;
  } else if (error) {
    content = <span className="text-danger">Couldn’t load</span>;
  } else {
    content = <span className="text-muted">—</span>;
  }

  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd>{content}</dd>
    </div>
  );
}
