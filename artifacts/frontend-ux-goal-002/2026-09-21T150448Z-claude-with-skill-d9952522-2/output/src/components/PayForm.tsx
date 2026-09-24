"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { encodeFunctionData, formatUnits, parseUnits, type Address, type Hash } from "viem";
import {
  useAccount,
  useConfig,
  useEstimateFeesPerGas,
  useEstimateGas,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { usdcAbi } from "@/lib/abis";
import { EXPLORER_URL, TARGET_CHAIN, USDC } from "@/lib/constants";
import { humanizeError } from "@/lib/errors";
import { formatToken, shortAddress } from "@/lib/format";
import { useUsdPrice } from "@/lib/prices";
import { useRecipient } from "@/lib/useRecipient";
import { useWalletState } from "@/lib/useUsdc";
import { Balances } from "./Balances";
import { UsdValue } from "./UsdValue";

type Phase = "idle" | "wallet" | "mining" | "refreshing";
type Sent = { hash: Hash; amount: bigint; to: Address; ensName?: string };

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  wallet: "Confirm in your wallet…",
  mining: "Sending…",
  refreshing: "Updating balances…",
};

function parseAmount(input: string): { value?: bigint; error?: string } {
  const s = input.trim();
  if (!s) return {};
  if (!/^\d*\.?\d*$/.test(s) || s === ".") return { error: "Enter a number, like 25 or 10.50." };
  const fraction = s.split(".")[1] ?? "";
  if (fraction.length > USDC.decimals) {
    return { error: `USDC supports at most ${USDC.decimals} decimal places.` };
  }
  const value = parseUnits(s, USDC.decimals);
  if (value === 0n) return { error: "Enter an amount greater than 0." };
  return { value };
}

export function PayForm() {
  const config = useConfig();
  const { address: account, chainId, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const wallet = useWalletState(account);
  const usdcPrice = useUsdPrice("USDC");
  const ethPrice = useUsdPrice("ETH");

  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<Hash>();
  const [sendError, setSendError] = useState<string>();
  const [sent, setSent] = useState<Sent>();

  const busy = phase !== "idle";
  const wrongChain = isConnected && chainId !== TARGET_CHAIN.id;
  const recipient = useRecipient(recipientInput, account);
  const amount = parseAmount(amountInput);
  const usdcBalance = wallet.usdc.data;
  const ethBalance = wallet.eth.data?.value;

  const amountError =
    amount.error ??
    (amount.value !== undefined && usdcBalance !== undefined && amount.value > usdcBalance
      ? `That's more than your balance of ${formatToken(usdcBalance, USDC.decimals)} USDC.`
      : undefined);

  const canEstimate =
    !!account && recipient.status === "ok" && amount.value !== undefined && !amountError && !busy;

  const gas = useEstimateGas({
    account,
    to: USDC.address,
    data: canEstimate
      ? encodeFunctionData({ abi: usdcAbi, functionName: "transfer", args: [recipient.address, amount.value!] })
      : undefined,
    chainId: TARGET_CHAIN.id,
    query: { enabled: canEstimate },
  });
  const fees = useEstimateFeesPerGas({ chainId: TARGET_CHAIN.id, query: { enabled: canEstimate } });
  const maxFeePerGas = fees.data?.maxFeePerGas ?? fees.data?.gasPrice;
  // Upper bound the wallet may charge; actual fee is usually lower.
  const networkFee = gas.data !== undefined && maxFeePerGas !== undefined ? gas.data * maxFeePerGas : undefined;

  // First reason the send button is disabled, shown right under it.
  const blocker: string | undefined = (() => {
    if (wallet.paused) return "USDC transfers are currently paused by Circle.";
    if (wallet.senderBlacklisted) return "Circle has frozen your address. It can't send USDC.";
    if (usdcBalance === 0n) return "You don't have any USDC to send.";
    if (recipient.status === "empty") return "Enter a recipient.";
    if (recipient.status === "resolving") return "Checking recipient…";
    if (recipient.status === "invalid") return "Fix the recipient above.";
    if (!amountInput.trim()) return "Enter an amount.";
    if (amountError) return "Fix the amount above.";
    if (ethBalance === 0n) return "You need some ETH in this wallet to pay the network fee.";
    if (gas.isError) return humanizeError(gas.error);
    if (networkFee !== undefined && ethBalance !== undefined && ethBalance < networkFee) {
      return `Not enough ETH for the network fee: need up to ${formatToken(networkFee, 18, 6)} ETH, you have ${formatToken(ethBalance, 18, 6)} ETH.`;
    }
    if (gas.isLoading || fees.isLoading) return "Estimating network fee…";
    return undefined;
  })();

  async function send() {
    if (recipient.status !== "ok" || amount.value === undefined || blocker) return;
    const to = recipient.address;
    const value = amount.value;
    setSendError(undefined);
    setSent(undefined);
    setTxHash(undefined);
    try {
      setPhase("wallet");
      const hash = await writeContractAsync({
        address: USDC.address,
        abi: usdcAbi,
        functionName: "transfer",
        args: [to, value],
        chainId: TARGET_CHAIN.id,
      });
      setTxHash(hash);
      setPhase("mining");

      let cancelled = false;
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId: TARGET_CHAIN.id,
        onReplaced: (r) => {
          if (r.reason === "cancelled") cancelled = true;
          else setTxHash(r.transaction.hash);
        },
      });
      if (cancelled) throw new Error("cancelled");
      if (receipt.status !== "success") {
        setSendError("The transfer failed onchain and no USDC was moved. The network fee was still charged.");
        return;
      }

      setPhase("refreshing");
      await wallet.refetchBalances();
      setSent({ hash: receipt.transactionHash, amount: value, to, ensName: recipient.ensName });
      setAmountInput("");
    } catch (e) {
      setSendError(
        e instanceof Error && e.message === "cancelled"
          ? "The transfer was cancelled from your wallet. No USDC was sent."
          : humanizeError(e),
      );
    } finally {
      setPhase("idle");
    }
  }

  function setMax() {
    if (usdcBalance !== undefined) setAmountInput(formatUnits(usdcBalance, USDC.decimals));
  }

  const recipientId = "recipient";
  const amountId = "amount";

  return (
    <div className="space-y-6">
      {isConnected && (
        <Balances
          usdc={{ value: usdcBalance, isLoading: wallet.usdc.isLoading, isError: wallet.usdc.isError }}
          eth={{ value: ethBalance, isLoading: wallet.eth.isLoading, isError: wallet.eth.isError }}
          usdcPrice={usdcPrice}
          ethPrice={ethPrice}
        />
      )}

      <form
        className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="space-y-2">
          <label htmlFor={recipientId} className="block text-sm font-medium">
            Recipient
          </label>
          <input
            id={recipientId}
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            placeholder="0x… or name.eth"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            aria-invalid={recipient.status === "invalid"}
            aria-describedby={`${recipientId}-hint`}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
          />
          <div id={`${recipientId}-hint`} className="min-h-5 text-sm" aria-live="polite">
            {recipient.status === "resolving" && <span className="text-muted">Checking…</span>}
            {recipient.status === "invalid" && <span className="text-danger">{recipient.reason}</span>}
            {recipient.status === "ok" && (
              <div className="space-y-1">
                <div className="text-muted">
                  Sending to{" "}
                  {recipient.ensName && <span className="font-medium text-foreground">{recipient.ensName} · </span>}
                  <a
                    href={`${EXPLORER_URL}/address/${recipient.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all font-mono text-foreground underline decoration-border underline-offset-2 hover:decoration-accent"
                  >
                    {recipient.address}
                  </a>
                </div>
                {recipient.warning && <div className="text-warning">{recipient.warning}</div>}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor={amountId} className="block text-sm font-medium">
              Amount
            </label>
            {usdcBalance !== undefined && usdcBalance > 0n && (
              <button
                type="button"
                onClick={setMax}
                disabled={busy}
                className="text-xs font-medium text-accent hover:underline disabled:opacity-60"
              >
                Max {formatToken(usdcBalance, USDC.decimals)}
              </button>
            )}
          </div>
          <div className="flex items-center rounded-lg border border-border bg-background focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
            <input
              id={amountId}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value.replace(",", "."))}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              disabled={busy}
              aria-invalid={!!amountError}
              aria-describedby={`${amountId}-hint`}
              className="w-full bg-transparent px-3 py-2.5 text-lg tabular-nums outline-none disabled:opacity-60"
            />
            <span className="pr-3 text-sm font-medium text-muted">USDC</span>
          </div>
          <div id={`${amountId}-hint`} className="min-h-5 text-sm" aria-live="polite">
            {amountError ? (
              <span className="text-danger">{amountError}</span>
            ) : (
              <UsdValue value={amount.value} decimals={USDC.decimals} price={usdcPrice} />
            )}
          </div>
        </div>

        {recipient.status === "ok" && amount.value !== undefined && !amountError && (
          <dl className="space-y-1.5 rounded-lg bg-background p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">You send</dt>
              <dd className="text-right">
                <span className="font-medium tabular-nums">{formatToken(amount.value, USDC.decimals)} USDC</span>{" "}
                <UsdValue value={amount.value} decimals={USDC.decimals} price={usdcPrice} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">To</dt>
              <dd className="font-mono" title={recipient.address}>
                {recipient.ensName ?? shortAddress(recipient.address)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Network fee (max)</dt>
              <dd className="text-right">
                {networkFee === undefined ? (
                  <span className="text-muted">{gas.isError ? "—" : "Estimating…"}</span>
                ) : (
                  <>
                    <span className="tabular-nums">{formatToken(networkFee, 18, 6)} ETH</span>{" "}
                    <UsdValue value={networkFee} decimals={18} price={ethPrice} />
                  </>
                )}
              </dd>
            </div>
          </dl>
        )}

        <div className="space-y-2">
          {!isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button
                  type="button"
                  onClick={openConnectModal}
                  disabled={!mounted}
                  className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
                >
                  Connect wallet
                </button>
              )}
            </ConnectButton.Custom>
          ) : wrongChain ? (
            <button
              type="button"
              onClick={() => switchChain({ chainId: TARGET_CHAIN.id })}
              disabled={isSwitching}
              className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              {isSwitching ? "Switching…" : `Switch to ${TARGET_CHAIN.name}`}
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy || !!blocker}
              aria-busy={busy}
              className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? PHASE_LABEL[phase as Exclude<Phase, "idle">]
                : amount.value !== undefined && !amountError
                  ? `Send ${formatToken(amount.value, USDC.decimals)} USDC`
                  : "Send USDC"}
            </button>
          )}

          <div className="min-h-5 text-sm" aria-live="polite">
            {wrongChain && (
              <p className="text-muted">
                Your wallet is on another network. USDC here is sent on {TARGET_CHAIN.name}.
                {switchError && <span className="block text-danger">{humanizeError(switchError)}</span>}
              </p>
            )}
            {isConnected && !wrongChain && !busy && blocker && !sendError && <p className="text-muted">{blocker}</p>}
            {busy && txHash && (
              <p className="text-muted">
                Waiting for confirmation.{" "}
                <a href={`${EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noreferrer" className="text-accent underline">
                  View on Etherscan
                </a>
              </p>
            )}
            {sendError && (
              <p role="alert" className="text-danger">
                {sendError}
                {txHash && (
                  <>
                    {" "}
                    <a href={`${EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">
                      View transaction
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </form>

      {sent && (
        <div role="status" className="rounded-2xl border border-success/40 bg-success/10 p-4 text-sm">
          <p className="font-medium">
            Sent {formatToken(sent.amount, USDC.decimals)} USDC to {sent.ensName ?? shortAddress(sent.to)}.
          </p>
          <a
            href={`${EXPLORER_URL}/tx/${sent.hash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-accent underline"
          >
            View on Etherscan
          </a>
        </div>
      )}
    </div>
  );
}
