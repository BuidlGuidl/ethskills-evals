"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { type Address, type Hash, encodeFunctionData, formatUnits, isAddressEqual, zeroAddress } from "viem";
import {
  useAccount,
  useBalance,
  useBlockNumber,
  useBytecode,
  useConfig,
  useEstimateFeesPerGas,
  useEstimateGas,
  useReadContracts,
  useSimulateContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { AddressDisplay } from "./AddressDisplay";
import { Spinner } from "./Spinner";
import { parseAmount, sanitizeAmountInput } from "@/lib/amount";
import { CHAIN, PRICE_FEED_DECIMALS, USDC, txUrl, usdcAbi } from "@/lib/contracts";
import { parseTxError } from "@/lib/errors";
import { formatAmount, usdLabel } from "@/lib/format";
import { usePrices, useRecipient } from "@/lib/hooks";

// Upper bound for a USDC transfer, used to show the fee before an exact estimate exists.
const FALLBACK_TRANSFER_GAS = 70_000n;
const RECEIPT_TIMEOUT_MS = 10 * 60 * 1000;
const DEPEG_THRESHOLD = 98n * 10n ** BigInt(PRICE_FEED_DECIMALS - 2); // $0.98

type Phase = "idle" | "wallet" | "confirming";
type Transfer = { to: Address; ensName?: string; amount: bigint; hash?: Hash };

export function PayCard() {
  const config = useConfig();
  const { address, chainId, status: accountStatus } = useAccount();
  const isConnected = accountStatus === "connected" && !!address;
  const wrongNetwork = isConnected && chainId !== CHAIN.id;
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const prices = usePrices();

  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [inFlight, setInFlight] = useState<Transfer | null>(null);
  const [sent, setSent] = useState<Transfer | null>(null);
  const [txError, setTxError] = useState<{ message: string; hash?: Hash } | null>(null);
  const busy = phase !== "idle";

  // ---- Balances (read from mainnet via our RPC, regardless of the wallet's current chain) ----
  const ethBalance = useBalance({ address, chainId: CHAIN.id, query: { enabled: !!address } });
  const usdcState = useReadContracts({
    contracts: [
      { address: USDC.address, abi: usdcAbi, functionName: "balanceOf", args: [address ?? zeroAddress], chainId: CHAIN.id },
      { address: USDC.address, abi: usdcAbi, functionName: "isBlacklisted", args: [address ?? zeroAddress], chainId: CHAIN.id },
      { address: USDC.address, abi: usdcAbi, functionName: "paused", chainId: CHAIN.id },
    ],
    query: { enabled: !!address },
  });
  const usdcBalance = usdcState.data?.[0].result;
  const senderBlacklisted = usdcState.data?.[1].result === true;
  const usdcPaused = usdcState.data?.[2].result === true;

  const { data: blockNumber } = useBlockNumber({ watch: true, chainId: CHAIN.id });
  const { refetch: refetchEth } = ethBalance;
  const { refetch: refetchUsdc } = usdcState;
  useEffect(() => {
    if (!address) return;
    refetchEth();
    refetchUsdc();
  }, [blockNumber, address, refetchEth, refetchUsdc]);

  // ---- Inputs ----
  const recipient = useRecipient(recipientInput);
  const to = recipient.status === "resolved" ? recipient.address : undefined;
  const amount = parseAmount(amountInput, USDC.decimals, USDC.symbol);
  const value = amount.status === "ok" ? amount.value : undefined;

  const recipientChecks = useReadContracts({
    contracts: [{ address: USDC.address, abi: usdcAbi, functionName: "isBlacklisted", args: [to ?? zeroAddress], chainId: CHAIN.id }],
    query: { enabled: !!to },
  });
  const recipientBlacklisted = recipientChecks.data?.[0].result === true;
  const { data: recipientCode } = useBytecode({ address: to, chainId: CHAIN.id, query: { enabled: !!to } });
  // EIP-7702 delegated EOAs carry a 0xef0100 designator; they are still user wallets.
  const recipientIsContract = !!recipientCode && recipientCode !== "0x" && !recipientCode.startsWith("0xef0100");

  const recipientError = (() => {
    if (recipient.status === "invalid") return recipient.error;
    if (!to) return null;
    if (isAddressEqual(to, zeroAddress)) return "You can't send to the zero address.";
    if (isAddressEqual(to, USDC.address)) return "That's the USDC token contract — USDC sent there is lost forever.";
    if (address && isAddressEqual(to, address)) return "That's your own address.";
    if (recipientBlacklisted) return "This address is blacklisted by Circle and can't receive USDC.";
    return null;
  })();

  const amountError = (() => {
    if (amount.status === "invalid") return amount.error;
    if (value !== undefined && usdcBalance !== undefined && value > usdcBalance) return "Amount exceeds your USDC balance.";
    return null;
  })();

  const accountError = senderBlacklisted
    ? "Your address is blacklisted by Circle and can't send USDC."
    : usdcPaused
      ? "USDC transfers are currently paused by Circle. Try again later."
      : null;

  const inputsValid = !!address && !!to && value !== undefined && !recipientError && !amountError && !accountError;

  // ---- Simulation & fee estimate ----
  const simulation = useSimulateContract({
    address: USDC.address,
    abi: usdcAbi,
    functionName: "transfer",
    args: [to ?? zeroAddress, value ?? 0n],
    account: address,
    chainId: CHAIN.id,
    query: { enabled: inputsValid && !busy },
  });

  const gasEstimate = useEstimateGas({
    account: address,
    to: USDC.address,
    data: to && value !== undefined ? encodeFunctionData({ abi: usdcAbi, functionName: "transfer", args: [to, value] }) : undefined,
    chainId: CHAIN.id,
    query: { enabled: inputsValid && !busy },
  });
  const fees = useEstimateFeesPerGas({ chainId: CHAIN.id, query: { refetchInterval: 12_000 } });
  const maxFee =
    fees.data?.maxFeePerGas !== undefined ? (gasEstimate.data ?? FALLBACK_TRANSFER_GAS) * fees.data.maxFeePerGas : undefined;
  const notEnoughGas = maxFee !== undefined && ethBalance.data !== undefined && ethBalance.data.value < maxFee;

  const simulationError = inputsValid && simulation.error ? parseTxError(simulation.error) : null;
  const canSend = inputsValid && !notEnoughGas && !!simulation.data && !simulationError && !wrongNetwork && !busy;

  // ---- Send ----
  async function handleSend() {
    if (!canSend || !simulation.data || !to || value === undefined) return;
    const transfer: Transfer = { to, ensName: recipient.status === "resolved" ? recipient.ensName : undefined, amount: value };
    setTxError(null);
    setSent(null);
    setInFlight(transfer);
    setPhase("wallet");
    let hash: Hash | undefined;
    try {
      hash = await writeContractAsync(simulation.data.request);
      setInFlight({ ...transfer, hash });
      setPhase("confirming");

      let cancelled = false;
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId: CHAIN.id,
        timeout: RECEIPT_TIMEOUT_MS,
        onReplaced: (r) => {
          if (r.reason === "cancelled") cancelled = true;
          hash = r.transaction.hash;
          setInFlight({ ...transfer, hash });
        },
      });

      if (cancelled) {
        setTxError({ message: "The transaction was cancelled in your wallet. No USDC was sent.", hash: receipt.transactionHash });
      } else if (receipt.status !== "success") {
        setTxError({ message: "The transaction failed onchain. No USDC was sent.", hash: receipt.transactionHash });
      } else {
        setSent({ ...transfer, hash: receipt.transactionHash });
        setRecipientInput("");
        setAmountInput("");
      }
    } catch (e) {
      setTxError({ message: parseTxError(e), hash });
    } finally {
      setPhase("idle");
      setInFlight(null);
      refetchEth();
      refetchUsdc();
    }
  }

  // ---- Primary action (one at a time: connect → switch network → send) ----
  const primary = (() => {
    if (accountStatus === "connecting" || accountStatus === "reconnecting") {
      return { label: "Connecting…", disabled: true, spinner: true };
    }
    if (!isConnected) return { label: "Connect wallet", onClick: openConnectModal, disabled: !openConnectModal };
    if (wrongNetwork) {
      return {
        label: isSwitching ? "Switching…" : `Switch to ${CHAIN.name}`,
        onClick: () => switchChain({ chainId: CHAIN.id }),
        disabled: isSwitching,
        spinner: isSwitching,
      };
    }
    if (phase === "wallet") return { label: "Confirm in your wallet…", disabled: true, spinner: true };
    if (phase === "confirming") return { label: "Sending…", disabled: true, spinner: true };
    if (accountError) return { label: "Transfers unavailable", disabled: true };
    if (recipient.status === "empty") return { label: "Enter a recipient", disabled: true };
    if (recipient.status === "resolving") return { label: "Resolving name…", disabled: true, spinner: true };
    if (amount.status === "empty") return { label: "Enter an amount", disabled: true };
    if (recipientError || amountError) return { label: amountError ? "Check amount" : "Check recipient", disabled: true };
    if (notEnoughGas) return { label: "Not enough ETH for gas", disabled: true };
    if (simulationError) return { label: "Transfer would fail", disabled: true };
    if (!simulation.data) return { label: "Checking…", disabled: true, spinner: true };
    return { label: `Send ${formatAmount(value!, USDC.decimals)} USDC`, onClick: handleSend, disabled: !canSend };
  })();

  const usdcPrice = prices.usdc;
  const ethPrice = prices.eth;

  return (
    <div className="space-y-4">
      {usdcPrice !== undefined && usdcPrice < DEPEG_THRESHOLD && (
        <Notice tone="warning">
          USDC is currently trading below $1 (≈{usdLabel(10n ** BigInt(USDC.decimals), USDC.decimals, usdcPrice)}).
        </Notice>
      )}

      {isConnected && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted">Your wallet</h2>
            <AddressDisplay address={address} />
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Balance
              label="USDC"
              value={usdcBalance !== undefined ? formatAmount(usdcBalance, USDC.decimals, 2) : undefined}
              usd={usdcBalance !== undefined ? usdLabel(usdcBalance, USDC.decimals, usdcPrice) : null}
              loading={usdcState.isLoading}
            />
            <Balance
              label="ETH (for gas)"
              value={ethBalance.data ? formatAmount(ethBalance.data.value, 18, 5) : undefined}
              usd={ethBalance.data ? usdLabel(ethBalance.data.value, 18, ethPrice) : null}
              loading={ethBalance.isLoading}
            />
          </dl>
          {ethBalance.data?.value === 0n && (
            <p className="mt-3 text-sm text-warning">You need a little ETH to pay the network fee for sending USDC.</p>
          )}
        </section>
      )}

      <section className="space-y-5 rounded-2xl border border-border bg-surface p-5">
        <div>
          <label htmlFor="recipient" className="mb-1.5 block text-sm font-medium">
            Recipient
          </label>
          <input
            id="recipient"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            onBlur={(e) => setRecipientInput(e.target.value.trim())}
            placeholder="0x… or name.eth"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy}
            aria-invalid={!!recipientError}
            aria-describedby="recipient-help"
            className="w-full rounded-xl border border-border bg-surface-muted px-3.5 py-3 font-mono text-sm outline-none focus:border-accent disabled:opacity-60"
          />
          <div id="recipient-help" className="mt-1.5 min-h-5 text-sm">
            {recipientError ? (
              <span className="text-danger">{recipientError}</span>
            ) : recipient.status === "resolving" ? (
              <span className="text-muted">Checking…</span>
            ) : to ? (
              <div className="space-y-1">
                <AddressDisplay address={to} ensName={recipient.status === "resolved" ? recipient.ensName : undefined} />
                {recipientIsContract && (
                  <p className="text-warning">
                    This address is a smart contract. Only continue if you know it can receive USDC.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount
            </label>
            {usdcBalance !== undefined && (
              <button
                type="button"
                disabled={busy || usdcBalance === 0n}
                onClick={() => setAmountInput(formatUnits(usdcBalance, USDC.decimals))}
                className="text-xs font-medium text-accent disabled:opacity-50"
              >
                Max: {formatAmount(usdcBalance, USDC.decimals)} USDC
              </button>
            )}
          </div>
          <div className="flex items-center rounded-xl border border-border bg-surface-muted pr-3.5 focus-within:border-accent">
            <input
              id="amount"
              value={amountInput}
              onChange={(e) => setAmountInput(sanitizeAmountInput(e.target.value))}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              disabled={busy}
              aria-invalid={!!amountError}
              aria-describedby="amount-help"
              className="w-full bg-transparent px-3.5 py-3 text-lg outline-none disabled:opacity-60"
            />
            <span className="text-sm font-medium text-muted">USDC</span>
          </div>
          <div id="amount-help" className="mt-1.5 min-h-5 text-sm">
            {amountError ? (
              <span className="text-danger">{amountError}</span>
            ) : value !== undefined ? (
              <span className="text-muted">{usdLabel(value, USDC.decimals, usdcPrice) ?? "USD value unavailable"}</span>
            ) : null}
          </div>
        </div>

        {isConnected && !wrongNetwork && (
          <dl className="space-y-1 rounded-xl bg-surface-muted p-3.5 text-sm">
            {to && value !== undefined && !recipientError && !amountError && (
              <Row label="You send">
                {formatAmount(value, USDC.decimals)} USDC{" "}
                <span className="text-muted">({usdLabel(value, USDC.decimals, usdcPrice) ?? "USD n/a"})</span>
              </Row>
            )}
            <Row label="Network fee (max)">
              {maxFee !== undefined ? (
                <>
                  {formatAmount(maxFee, 18, 6)} ETH{" "}
                  <span className="text-muted">({usdLabel(maxFee, 18, ethPrice) ?? "USD n/a"})</span>
                </>
              ) : (
                <span className="text-muted">Estimating…</span>
              )}
            </Row>
          </dl>
        )}

        {accountError && <Notice tone="danger">{accountError}</Notice>}
        {notEnoughGas && !accountError && (
          <Notice tone="danger">
            You need up to {formatAmount(maxFee!, 18, 6)} ETH ({usdLabel(maxFee!, 18, ethPrice) ?? "USD n/a"}) for the network
            fee, but have {formatAmount(ethBalance.data!.value, 18, 6)} ETH. Add ETH to this wallet to continue.
          </Notice>
        )}
        {simulationError && !notEnoughGas && <Notice tone="danger">{simulationError}</Notice>}

        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {primary.spinner && <Spinner />}
          {primary.label}
        </button>

        {inFlight?.hash && (
          <Notice tone="info">
            Transaction submitted. Waiting for confirmation…{" "}
            <ExplorerLink hash={inFlight.hash} />
          </Notice>
        )}

        {txError && (
          <Notice tone="danger" onDismiss={() => setTxError(null)}>
            {txError.message} {txError.hash && <ExplorerLink hash={txError.hash} />}
          </Notice>
        )}

        {sent?.hash && (
          <Notice tone="success" onDismiss={() => setSent(null)}>
            <div className="space-y-1">
              <p className="font-medium">
                Sent {formatAmount(sent.amount, USDC.decimals)} USDC ({usdLabel(sent.amount, USDC.decimals, usdcPrice) ?? "USD n/a"})
              </p>
              <p className="flex flex-wrap items-center gap-1">
                to <AddressDisplay address={sent.to} ensName={sent.ensName} />
              </p>
              <ExplorerLink hash={sent.hash} />
            </div>
          </Notice>
        )}
      </section>
    </div>
  );
}

function Balance({ label, value, usd, loading }: { label: string; value?: string; usd: string | null; loading: boolean }) {
  return (
    <div className="rounded-xl bg-surface-muted p-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{loading ? "…" : (value ?? "—")}</dd>
      <dd className="text-xs text-muted">{loading ? " " : (usd ?? "USD value unavailable")}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

const NOTICE_TONES = {
  info: "border-border bg-surface-muted text-foreground",
  success: "border-success/30 bg-success-surface text-success",
  warning: "border-warning/30 bg-warning-surface text-warning",
  danger: "border-danger/30 bg-danger-surface text-danger",
} as const;

function Notice({
  tone,
  children,
  onDismiss,
}: {
  tone: keyof typeof NOTICE_TONES;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-3 rounded-xl border p-3.5 text-sm ${NOTICE_TONES[tone]}`}>
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="self-start opacity-70 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}

function ExplorerLink({ hash }: { hash: Hash }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
      View on Etherscan ↗
    </a>
  );
}
