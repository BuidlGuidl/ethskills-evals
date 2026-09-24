"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { encodeFunctionData, parseUnits, zeroAddress, type Address, type Hash } from "viem";
import {
  useAccount,
  useBalance,
  useConfig,
  useEstimateFeesPerGas,
  useEstimateGas,
  useReadContract,
  useReadContracts,
  useSimulateContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { humanizeError } from "@/lib/errors";
import { formatToken } from "@/lib/format";
import { USDC, usdcAbi } from "@/lib/tokens";
import { TARGET_CHAIN } from "@/lib/wagmi";
import { usePrices } from "@/hooks/usePrices";
import { useRecipient, type Recipient } from "@/hooks/useRecipient";
import { Balances } from "./Balances";
import { Fiat } from "./Fiat";

type Amount = { status: "empty" } | { status: "invalid"; reason: string } | { status: "ok"; value: bigint };
type Phase = "wallet" | "mining" | "refreshing";
type Sent = { hash: Hash; amount: bigint; to: Address; name?: string };

const explorer = TARGET_CHAIN.blockExplorers.default.url;
const BALANCE_POLL_MS = 12_000; // ~one block

function parseAmount(input: string, balance: bigint | undefined): Amount {
  const value = input.trim();
  if (!value || value === ".") return { status: "empty" };
  if (!/^\d*\.?\d*$/.test(value)) return { status: "invalid", reason: "Enter a number, like 25 or 10.50." };
  const fraction = value.split(".")[1] ?? "";
  if (fraction.length > USDC.decimals) {
    return { status: "invalid", reason: `USDC supports at most ${USDC.decimals} decimal places.` };
  }
  const parsed = parseUnits(value, USDC.decimals);
  if (parsed === 0n) return { status: "invalid", reason: "Enter an amount greater than 0." };
  if (balance !== undefined && parsed > balance) {
    return { status: "invalid", reason: `That's more than your balance of ${formatToken(balance, USDC.decimals, 6)} USDC.` };
  }
  return { status: "ok", value: parsed };
}

export function PayPanel() {
  const config = useConfig();
  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const switchChain = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const prices = usePrices();
  const onTargetChain = chainId === TARGET_CHAIN.id;

  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [pendingHash, setPendingHash] = useState<Hash | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  const usdcBalance = useReadContract({
    address: USDC.address,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN.id,
    query: { enabled: !!address, refetchInterval: BALANCE_POLL_MS },
  });
  const ethBalance = useBalance({
    address,
    chainId: TARGET_CHAIN.id,
    query: { enabled: !!address, refetchInterval: BALANCE_POLL_MS },
  });

  const recipient = useRecipient(recipientInput);
  const amount = parseAmount(amountInput, usdcBalance.data);
  const to = recipient.status === "resolved" ? recipient.address : undefined;

  // USDC-specific preconditions: Circle can pause the token or blacklist addresses.
  const usdcState = useReadContracts({
    contracts: [
      { address: USDC.address, abi: usdcAbi, functionName: "paused", chainId: TARGET_CHAIN.id },
      { address: USDC.address, abi: usdcAbi, functionName: "isBlacklisted", args: [address ?? zeroAddress], chainId: TARGET_CHAIN.id },
      { address: USDC.address, abi: usdcAbi, functionName: "isBlacklisted", args: [to ?? zeroAddress], chainId: TARGET_CHAIN.id },
    ],
    allowFailure: false,
    query: { enabled: !!address },
  });
  const [paused, senderBlocked, recipientBlocked] = usdcState.data ?? [];

  const recipientBlocker = recipientProblem(recipient, to, address, recipientBlocked);
  const transfer =
    address && onTargetChain && to && !recipientBlocker && amount.status === "ok" ? { to, value: amount.value } : undefined;

  const simulation = useSimulateContract({
    address: USDC.address,
    abi: usdcAbi,
    functionName: "transfer",
    args: transfer ? [transfer.to, transfer.value] : undefined,
    account: address,
    chainId: TARGET_CHAIN.id,
    query: { enabled: !!transfer && !phase },
  });
  const gas = useEstimateGas({
    account: address,
    to: USDC.address,
    data: transfer ? encodeFunctionData({ abi: usdcAbi, functionName: "transfer", args: [transfer.to, transfer.value] }) : undefined,
    chainId: TARGET_CHAIN.id,
    query: { enabled: !!transfer && !phase },
  });
  const fees = useEstimateFeesPerGas({ chainId: TARGET_CHAIN.id, query: { enabled: !!transfer } });
  const maxFee = gas.data && fees.data?.maxFeePerGas ? gas.data * fees.data.maxFeePerGas : undefined;

  // First reason the transfer can't go ahead, shown under the button.
  let blocker: string | null = null;
  if (paused) blocker = "USDC transfers are currently paused by Circle. Try again later.";
  else if (senderBlocked) blocker = "Circle has blocked your address from sending USDC.";
  else if (usdcBalance.data === 0n) blocker = "You don't have any USDC in this wallet.";
  else if (ethBalance.data?.value === 0n) blocker = "You need some ETH in this wallet to pay the network fee.";
  else if (maxFee !== undefined && ethBalance.data && ethBalance.data.value < maxFee) {
    blocker = `Not enough ETH for the network fee (up to ${formatToken(maxFee, 18, 6)} ETH).`;
  } else if (simulation.error) blocker = humanizeError(simulation.error);

  const busy = phase !== null;
  const canSend = !!transfer && !blocker && !!simulation.data && !busy;

  async function send() {
    if (!simulation.data || !transfer) return;
    const recipientName = recipient.status === "resolved" ? recipient.name : undefined;
    setSendError(null);
    setSent(null);
    setPendingHash(null);
    setPhase("wallet");
    let hash: Hash | undefined;
    let outcomeKnown = false;
    try {
      hash = await writeContractAsync(simulation.data.request);
      setPendingHash(hash);
      setPhase("mining");
      let cancelled = false;
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        chainId: TARGET_CHAIN.id,
        onReplaced: (r) => {
          cancelled = r.reason === "cancelled";
          hash = r.transaction.hash;
          setPendingHash(r.transaction.hash);
        },
      });
      outcomeKnown = true;
      if (cancelled) throw new Error("The transaction was cancelled in your wallet. No USDC was sent.");
      if (receipt.status !== "success") throw new Error("The transfer reverted onchain. No USDC was sent.");
      setPhase("refreshing");
      await Promise.all([usdcBalance.refetch(), ethBalance.refetch()]);
      setSent({ hash: receipt.transactionHash, amount: transfer.value, to: transfer.to, name: recipientName });
      setAmountInput("");
      setRecipientInput("");
    } catch (error) {
      const message = humanizeError(error);
      // Once a hash exists the tx may still land; don't claim it failed if we only lost track of it.
      setSendError(hash && !outcomeKnown ? `${message} Check the transaction on Etherscan before retrying.` : message);
    } finally {
      setPhase(null);
    }
  }

  return (
    <div className="card">
      <h1>Send USDC</h1>
      <p className="muted subtitle">Pay anyone on Ethereum with USDC. You'll need a little ETH for the network fee.</p>

      {isConnected && address ? (
        <Balances usdc={usdcBalance} eth={{ ...ethBalance, value: ethBalance.data?.value }} prices={prices} />
      ) : (
        <p className="notice">Connect a wallet to see your USDC and ETH balances.</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) void send();
        }}
        noValidate
      >
        <label className="field">
          <span>Recipient</span>
          <input
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            placeholder="0x… or name.eth"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy}
            aria-invalid={!!recipientBlocker && recipient.status !== "resolving"}
            aria-describedby="recipient-help"
          />
          <RecipientHelp recipient={recipient} problem={recipientBlocker} />
        </label>

        <label className="field">
          <span>Amount</span>
          <div className="amount-row">
            <input
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value.replace(",", "."))}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
              disabled={busy}
              aria-invalid={amount.status === "invalid"}
              aria-describedby="amount-help"
            />
            <span className="unit">USDC</span>
            <button
              type="button"
              className="secondary"
              disabled={busy || !usdcBalance.data}
              onClick={() => usdcBalance.data !== undefined && setAmountInput(formatToken(usdcBalance.data, USDC.decimals, 6, 0).replaceAll(",", ""))}
            >
              Max
            </button>
          </div>
          <span id="amount-help" className="help">
            {amount.status === "invalid" ? (
              <span className="error-text">{amount.reason}</span>
            ) : amount.status === "ok" ? (
              <Fiat amount={amount.value} decimals={USDC.decimals} price={prices.usdcUsd} />
            ) : (
              " "
            )}
          </span>
        </label>

        {transfer && !blocker && (
          <div className="summary" aria-live="polite">
            <div>
              You send <strong>{formatToken(transfer.value, USDC.decimals, 6)} USDC</strong>{" "}
              <Fiat amount={transfer.value} decimals={USDC.decimals} price={prices.usdcUsd} />
            </div>
            <div>
              To {recipient.status === "resolved" && recipient.name && <strong>{recipient.name} </strong>}
              <code className="address">{transfer.to}</code>
            </div>
            <div className="muted">
              Network fee: up to{" "}
              {maxFee !== undefined ? (
                <>
                  {formatToken(maxFee, 18, 6)} ETH <Fiat amount={maxFee} decimals={18} price={prices.ethUsd} />
                </>
              ) : (
                "estimating…"
              )}
            </div>
          </div>
        )}

        <PrimaryAction
          isConnected={isConnected}
          onTargetChain={onTargetChain}
          onConnect={() => openConnectModal?.()}
          onSwitch={() => switchChain.switchChain({ chainId: TARGET_CHAIN.id })}
          switching={switchChain.isPending}
          phase={phase}
          canSend={canSend}
          checking={!!transfer && !blocker && !simulation.data}
          label={amount.status === "ok" ? `Send ${formatToken(amount.value, USDC.decimals, 6)} USDC` : "Send USDC"}
        />

        <div className="action-status" aria-live="polite">
          {switchChain.error && !onTargetChain && <p className="error-text">{humanizeError(switchChain.error)}</p>}
          {isConnected && onTargetChain && !busy && blocker && <p className="error-text">{blocker}</p>}
          {phase === "mining" && pendingHash && (
            <p className="muted">
              Waiting for confirmation…{" "}
              <a href={`${explorer}/tx/${pendingHash}`} target="_blank" rel="noreferrer">
                View on Etherscan
              </a>
            </p>
          )}
          {sendError && (
            <p className="error-text">
              {sendError}
              {pendingHash && (
                <>
                  {" "}
                  <a href={`${explorer}/tx/${pendingHash}`} target="_blank" rel="noreferrer">
                    View on Etherscan
                  </a>
                </>
              )}
            </p>
          )}
          {sent && (
            <p className="success">
              Sent {formatToken(sent.amount, USDC.decimals, 6)} USDC to {sent.name ?? sent.to}.{" "}
              <a href={`${explorer}/tx/${sent.hash}`} target="_blank" rel="noreferrer">
                View on Etherscan
              </a>
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

function recipientProblem(recipient: Recipient, to: Address | undefined, self: Address | undefined, blacklisted: boolean | undefined): string | null {
  if (recipient.status === "invalid") return recipient.reason;
  if (!to) return null;
  if (to === zeroAddress) return "You can't send USDC to the zero address.";
  if (to.toLowerCase() === USDC.address.toLowerCase()) {
    return "That's the USDC token contract itself. Tokens sent there are lost forever.";
  }
  if (self && to.toLowerCase() === self.toLowerCase()) return "That's your own address.";
  if (blacklisted) return "Circle has blocked this address from receiving USDC.";
  return null;
}

function RecipientHelp({ recipient, problem }: { recipient: Recipient; problem: string | null }) {
  let content: React.ReactNode = " ";
  if (recipient.status === "resolving") content = <span className="muted">Looking up…</span>;
  else if (problem) content = <span className="error-text">{problem}</span>;
  else if (recipient.status === "resolved") {
    content = (
      <span className="muted">
        {recipient.name ? `${recipient.name} → ` : "Sending to "}
        <code className="address">{recipient.address}</code>
      </span>
    );
  }
  return (
    <span id="recipient-help" className="help">
      {content}
    </span>
  );
}

function PrimaryAction(props: {
  isConnected: boolean;
  onTargetChain: boolean;
  onConnect: () => void;
  onSwitch: () => void;
  switching: boolean;
  phase: Phase | null;
  canSend: boolean;
  checking: boolean;
  label: string;
}) {
  if (!props.isConnected) {
    return (
      <button type="button" className="primary" onClick={props.onConnect}>
        Connect wallet
      </button>
    );
  }
  if (!props.onTargetChain) {
    return (
      <button type="button" className="primary" onClick={props.onSwitch} disabled={props.switching}>
        {props.switching ? "Switch network in your wallet…" : `Switch to ${TARGET_CHAIN.name}`}
      </button>
    );
  }
  const text =
    props.phase === "wallet"
      ? "Confirm in your wallet…"
      : props.phase === "mining"
        ? "Sending…"
        : props.phase === "refreshing"
          ? "Updating balances…"
          : props.checking
            ? "Checking transfer…"
            : props.label;
  return (
    <button type="submit" className="primary" disabled={!props.canSend} aria-busy={props.phase !== null}>
      {text}
    </button>
  );
}
