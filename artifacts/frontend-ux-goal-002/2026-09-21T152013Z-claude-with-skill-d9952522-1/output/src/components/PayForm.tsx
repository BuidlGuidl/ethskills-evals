"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { encodeFunctionData, erc20Abi, parseUnits, type Address, type Hash } from "viem";
import { useAccount, useConfig, useEstimateFeesPerGas, useEstimateGas, useSwitchChain } from "wagmi";
import { simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { Balances } from "@/components/Balances";
import { UsdValue } from "@/components/UsdValue";
import { TARGET_CHAIN } from "@/config/wagmi";
import { toUserMessage } from "@/lib/errors";
import { formatToken, shortAddress } from "@/lib/format";
import { useUsdPrice } from "@/lib/prices";
import { ETH, EXPLORER_URL, USDC } from "@/lib/tokens";
import { useBalances } from "@/lib/useBalances";
import { useRecipient } from "@/lib/useRecipient";

type Phase = "idle" | "wallet" | "mining" | "refreshing";
type Sent = { hash: Hash; amount: bigint; to: Address; ensName?: string };

const AMOUNT_PATTERN = /^\d*\.?\d*$/;

function parseAmount(raw: string, balance?: bigint): { value?: bigint; error?: string } {
  const input = raw.trim();
  if (!input) return {};
  if (!AMOUNT_PATTERN.test(input) || input === ".") return { error: "Enter a number, like 25 or 12.50." };
  const fraction = input.split(".")[1] ?? "";
  if (fraction.length > USDC.decimals) return { error: `USDC supports at most ${USDC.decimals} decimal places.` };
  const value = parseUnits(input, USDC.decimals);
  if (value === 0n) return { error: "Amount must be greater than 0." };
  if (balance !== undefined && value > balance) {
    return { error: `That's more than your balance of ${formatToken(balance, USDC.decimals, USDC.decimals)} USDC.` };
  }
  return { value };
}

export function PayForm() {
  const config = useConfig();
  const { address: account, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [pendingHash, setPendingHash] = useState<Hash>();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<Sent>();

  const balances = useBalances(account);
  const usdcPrice = useUsdPrice("USDC");
  const ethPrice = useUsdPrice("ETH");
  const recipient = useRecipient(recipientInput, account);
  const amount = parseAmount(amountInput, balances.usdc);

  const busy = phase !== "idle";
  const wrongChain = isConnected && chainId !== TARGET_CHAIN.id;
  const to = recipient.status === "ok" ? recipient.address : undefined;
  const readyToEstimate = !!account && !!to && amount.value !== undefined && !amount.error;

  // Network fee estimate so we can warn before the wallet does.
  const gas = useEstimateGas({
    account,
    to: USDC.address,
    data: readyToEstimate
      ? encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to!, amount.value!] })
      : undefined,
    chainId: TARGET_CHAIN.id,
    query: { enabled: readyToEstimate && !busy },
  });
  const fees = useEstimateFeesPerGas({ chainId: TARGET_CHAIN.id, query: { refetchInterval: 12_000 } });
  const maxFee = gas.data && fees.data?.maxFeePerGas ? gas.data * fees.data.maxFeePerGas : undefined;

  const gasProblem =
    balances.eth === undefined
      ? undefined
      : balances.eth === 0n
        ? "You have no ETH. Every Ethereum transaction needs a little ETH to pay the network fee."
        : maxFee !== undefined && balances.eth < maxFee
          ? `Not enough ETH for the network fee (up to ${formatToken(maxFee, ETH.decimals, 6)} ETH).`
          : undefined;

  const blocker: string | undefined = (() => {
    if (recipient.status === "empty") return "Enter a recipient.";
    if (recipient.status === "resolving") return "Checking recipient…";
    if (recipient.status === "invalid") return "Fix the recipient above.";
    if (amount.error) return "Fix the amount above.";
    if (amount.value === undefined) return "Enter an amount.";
    if (balances.usdc === undefined) return "Loading your balance…";
    if (gasProblem) return gasProblem;
    return undefined;
  })();

  async function send() {
    if (!account || !to || amount.value === undefined) return;
    // Snapshot exactly what the user reviewed.
    const transfer = {
      to,
      amount: amount.value,
      ensName: recipient.status === "ok" ? recipient.ensName : undefined,
    };

    setError(undefined);
    setSent(undefined);
    setPhase("wallet");
    try {
      const { request } = await simulateContract(config, {
        account,
        address: USDC.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [transfer.to, transfer.amount],
        chainId: TARGET_CHAIN.id,
      });
      const hash = await writeContract(config, request);
      setPendingHash(hash);
      setPhase("mining");

      let cancelled = false;
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId: TARGET_CHAIN.id,
        onReplaced: (r) => {
          if (r.reason === "cancelled") cancelled = true;
          else setPendingHash(r.transaction.hash);
        },
      });
      if (cancelled) throw new Error("The transaction was cancelled in your wallet. Nothing was sent.");
      if (receipt.status !== "success") throw new Error("The transfer failed onchain. Your USDC was not sent.");

      setPhase("refreshing");
      await balances.refetch();
      setSent({ hash: receipt.transactionHash, ...transfer });
      setRecipientInput("");
      setAmountInput("");
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setPhase("idle");
      setPendingHash(undefined);
    }
  }

  return (
    <div className="space-y-6">
      {isConnected && (
        <Balances
          usdc={balances.usdc}
          eth={balances.eth}
          isError={balances.isError}
          usdcPrice={usdcPrice}
          ethPrice={ethPrice}
        />
      )}

      {sent && (
        <div role="status" className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
          <p className="font-semibold text-success">Sent {formatToken(sent.amount, USDC.decimals, USDC.decimals)} USDC</p>
          <p className="mt-1 break-all text-muted">
            to {sent.ensName ? `${sent.ensName} (${sent.to})` : sent.to}
          </p>
          <a className="mt-2 inline-block font-medium text-accent underline" href={`${EXPLORER_URL}/tx/${sent.hash}`} target="_blank" rel="noreferrer">
            View on Etherscan ↗
          </a>
        </div>
      )}

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocker && !busy && !wrongChain) void send();
        }}
      >
        <fieldset disabled={busy} className="space-y-5">
          <div>
            <label htmlFor="recipient" className="mb-1.5 block text-sm font-medium">
              Recipient
            </label>
            <input
              id="recipient"
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              placeholder="0x… or name.eth"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
              aria-invalid={recipient.status === "invalid"}
              aria-describedby="recipient-help"
            />
            <div id="recipient-help" className="mt-1.5 min-h-5 text-sm">
              {recipient.status === "resolving" && <span className="text-muted">Checking…</span>}
              {recipient.status === "invalid" && <span className="text-danger">{recipient.reason}</span>}
              {recipient.status === "ok" && (
                <div className="space-y-1">
                  <p className="break-all font-mono text-xs text-muted">
                    {recipient.ensName && <span className="mr-1 font-sans font-medium text-fg">{recipient.ensName} →</span>}
                    {recipient.address}
                  </p>
                  {recipient.warnings.map((w) => (
                    <p key={w} className="text-warning">
                      {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="amount" className="text-sm font-medium">
                Amount
              </label>
              {balances.usdc !== undefined && balances.usdc > 0n && (
                <button
                  type="button"
                  className="text-xs font-medium text-accent hover:underline"
                  onClick={() => setAmountInput(formatToken(balances.usdc!, USDC.decimals, USDC.decimals).replaceAll(",", ""))}
                >
                  Max
                </button>
              )}
            </div>
            <div className="flex items-center rounded-xl border border-border bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
              <input
                id="amount"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value.replace(",", "."))}
                placeholder="0.00"
                inputMode="decimal"
                autoComplete="off"
                className="w-full bg-transparent px-4 py-3 text-lg tabular-nums outline-none disabled:opacity-60"
                aria-invalid={!!amount.error}
                aria-describedby="amount-help"
              />
              <span className="pr-4 text-sm font-semibold text-muted">USDC</span>
            </div>
            <div id="amount-help" className="mt-1.5 min-h-5 text-sm">
              {amount.error ? (
                <span className="text-danger">{amount.error}</span>
              ) : amount.value !== undefined ? (
                <UsdValue amount={amount.value} decimals={USDC.decimals} price={usdcPrice} />
              ) : null}
            </div>
          </div>
        </fieldset>

        {isConnected && !wrongChain && to && amount.value !== undefined && !amount.error && (
          <dl className="space-y-2 rounded-xl border border-border bg-surface-2 p-4 text-sm">
            <Row label="You send">
              {formatToken(amount.value, USDC.decimals, USDC.decimals)} USDC{" "}
              <span className="text-xs">
                (<UsdValue amount={amount.value} decimals={USDC.decimals} price={usdcPrice} />)
              </span>
            </Row>
            <Row label="To">{recipient.status === "ok" && recipient.ensName ? recipient.ensName : shortAddress(to)}</Row>
            <Row label="Network fee">
              {maxFee !== undefined ? (
                <>
                  up to {formatToken(maxFee, ETH.decimals, 6)} ETH{" "}
                  <span className="text-xs">
                    (<UsdValue amount={maxFee} decimals={ETH.decimals} price={ethPrice} />)
                  </span>
                </>
              ) : gas.isError ? (
                <span className="text-muted">Couldn&apos;t estimate</span>
              ) : (
                <span className="text-muted">Estimating…</span>
              )}
            </Row>
          </dl>
        )}

        <PrimaryAction
          isConnected={isConnected}
          wrongChain={wrongChain}
          isSwitching={isSwitching}
          phase={phase}
          blocker={blocker}
          onConnect={() => openConnectModal?.()}
          onSwitch={() => switchChain({ chainId: TARGET_CHAIN.id }, { onError: (e) => setError(toUserMessage(e)) })}
        />

        {phase === "mining" && pendingHash && (
          <p className="text-center text-sm text-muted">
            Waiting for confirmation…{" "}
            <a className="text-accent underline" href={`${EXPLORER_URL}/tx/${pendingHash}`} target="_blank" rel="noreferrer">
              Track on Etherscan ↗
            </a>
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  wallet: "Confirm in your wallet…",
  mining: "Sending…",
  refreshing: "Updating balances…",
};

function PrimaryAction(props: {
  isConnected: boolean;
  wrongChain: boolean;
  isSwitching: boolean;
  phase: Phase;
  blocker?: string;
  onConnect: () => void;
  onSwitch: () => void;
}) {
  const { isConnected, wrongChain, isSwitching, phase, blocker, onConnect, onSwitch } = props;
  const base =
    "w-full rounded-xl px-4 py-3.5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const primary = `${base} bg-accent text-accent-fg hover:bg-accent/90`;

  if (!isConnected) {
    return (
      <button type="button" className={primary} onClick={onConnect}>
        Connect wallet
      </button>
    );
  }
  if (wrongChain) {
    return (
      <button type="button" className={primary} onClick={onSwitch} disabled={isSwitching}>
        {isSwitching ? "Switch network in your wallet…" : `Switch to ${TARGET_CHAIN.name}`}
      </button>
    );
  }
  if (phase !== "idle") {
    return (
      <button type="button" className={primary} disabled aria-busy>
        {PHASE_LABEL[phase]}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <button type="submit" className={primary} disabled={!!blocker}>
        Send USDC
      </button>
      {blocker && <p className="text-center text-sm text-muted">{blocker}</p>}
    </div>
  );
}
