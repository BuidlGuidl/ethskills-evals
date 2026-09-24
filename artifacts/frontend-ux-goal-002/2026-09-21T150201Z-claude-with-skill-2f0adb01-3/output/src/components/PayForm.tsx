"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRef, useState } from "react";
import { type Address, type Hash, encodeFunctionData, formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useEstimateFeesPerGas,
  useEstimateGas,
  usePublicClient,
  useSimulateContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useAccountBalances } from "@/hooks/useAccountBalances";
import { useDebounced } from "@/hooks/useDebounced";
import { usePrices } from "@/hooks/usePrices";
import { useRecipient } from "@/hooks/useRecipient";
import { CHAIN, USDC_ADDRESS, explorerTxUrl, usdcAbi } from "@/lib/contracts";
import { parseTxError } from "@/lib/errors";
import { formatToken, formatUsd } from "@/lib/format";
import { AddressDisplay } from "./AddressDisplay";
import { Balances } from "./Balances";

type Phase = "idle" | "wallet" | "confirming";

type SentTransfer = { hash: Hash; to: Address; ensName?: string; amount: bigint };

function parseAmount(input: string, decimals: number | undefined): { value?: bigint; error?: string } {
  if (!input || input === ".") return {};
  if (decimals === undefined) return {};
  const fraction = input.split(".")[1];
  if (fraction && fraction.length > decimals) {
    return { error: `USDC supports up to ${decimals} decimal places.` };
  }
  return { value: parseUnits(input.startsWith(".") ? `0${input}` : input, decimals) };
}

export function PayForm() {
  const { address, chainId, status } = useAccount();
  const isConnected = status === "connected";
  const wrongNetwork = isConnected && chainId !== CHAIN.id;

  const balances = useAccountBalances(address);
  const { ethUsd, usdcUsd } = usePrices();
  const decimals = balances.usdcDecimals;

  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const recipient = useRecipient(recipientInput, address);
  const amount = parseAmount(amountInput, decimals);
  const debouncedAmount = useDebounced(amount.value);

  const [phase, setPhase] = useState<Phase>("idle");
  const sendingRef = useRef(false); // guards double clicks before React re-renders
  const [txError, setTxError] = useState<string>();
  const [sent, setSent] = useState<SentTransfer>();
  const [pendingHash, setPendingHash] = useState<Hash>();

  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN.id });

  const hasEnoughUsdc =
    amount.value !== undefined && balances.usdcBalance !== undefined && amount.value <= balances.usdcBalance;
  const canCheck =
    isConnected &&
    phase === "idle" &&
    !!recipient.address &&
    !recipient.error &&
    !!amount.value &&
    hasEnoughUsdc &&
    debouncedAmount === amount.value;

  // Preflight on mainnet: catches reverts (paused, blacklisted, balance) before the wallet opens.
  const simulation = useSimulateContract({
    chainId: CHAIN.id,
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "transfer",
    args: [recipient.address!, amount.value!],
    account: address,
    query: { enabled: canCheck },
  });

  const gas = useEstimateGas({
    chainId: CHAIN.id,
    account: address,
    to: USDC_ADDRESS,
    data: canCheck
      ? encodeFunctionData({ abi: usdcAbi, functionName: "transfer", args: [recipient.address!, amount.value!] })
      : undefined,
    query: { enabled: canCheck },
  });
  const fees = useEstimateFeesPerGas({ chainId: CHAIN.id, query: { enabled: canCheck, refetchInterval: 12_000 } });
  const maxFee = gas.data && fees.data?.maxFeePerGas ? gas.data * fees.data.maxFeePerGas : undefined;
  const hasEnoughEth = balances.ethBalance !== undefined && (maxFee === undefined || balances.ethBalance >= maxFee);

  function blockReason(): string | null {
    if (balances.isLoading || decimals === undefined) return "Loading balances…";
    if (balances.usdcPaused) return "USDC transfers are paused";
    if (balances.senderBlacklisted) return "Your address can't send USDC";
    if (!recipientInput.trim()) return "Enter a recipient";
    if (recipient.error) return "Check the recipient";
    if (recipient.isResolving) return "Checking recipient…";
    if (!amountInput || amount.error) return amount.error ? "Check the amount" : "Enter an amount";
    if (!amount.value) return "Enter an amount";
    if (!hasEnoughUsdc) return "Not enough USDC";
    if (balances.ethBalance === 0n) return "You need ETH for the network fee";
    if (simulation.error) return "This transfer would fail";
    if (gas.error || fees.error) return "Couldn't estimate the network fee";
    if (!simulation.data || !maxFee) return "Checking…";
    if (!hasEnoughEth) return "Not enough ETH for the network fee";
    return null;
  }

  async function send() {
    if (sendingRef.current || !simulation.data || !publicClient || !recipient.address || !amount.value) return;
    sendingRef.current = true;
    setPhase("wallet");
    setTxError(undefined);
    setSent(undefined);
    const transfer = { to: recipient.address, ensName: recipient.ensName, amount: amount.value };

    try {
      const hash = await writeContractAsync(simulation.data.request);
      setPendingHash(hash);
      setPhase("confirming");

      let cancelled = false;
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        onReplaced: (r) => {
          cancelled = r.reason === "cancelled";
        },
      });

      if (cancelled) {
        setTxError("The transfer was cancelled in your wallet. No USDC was sent.");
      } else if (receipt.status === "reverted") {
        setTxError("The transfer failed onchain. No USDC was sent, but the network fee was charged.");
      } else {
        setSent({ ...transfer, hash: receipt.transactionHash });
        setRecipientInput("");
        setAmountInput("");
      }
    } catch (e) {
      setTxError(parseTxError(e));
    } finally {
      sendingRef.current = false;
      setPendingHash(undefined);
      setPhase("idle");
      balances.refetch();
    }
  }

  const busy = phase !== "idle";
  const reason = blockReason();

  function primaryAction() {
    if (status === "reconnecting" || status === "connecting") {
      return (
        <button type="button" className="button button-primary" disabled>
          <Spinner /> Connecting…
        </button>
      );
    }
    if (!isConnected) {
      return (
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button type="button" className="button button-primary" onClick={openConnectModal}>
              Connect wallet
            </button>
          )}
        </ConnectButton.Custom>
      );
    }
    if (wrongNetwork) {
      return (
        <button
          type="button"
          className="button button-primary"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: CHAIN.id })}
        >
          {isSwitching ? (
            <>
              <Spinner /> Switching…
            </>
          ) : (
            "Switch to Ethereum"
          )}
        </button>
      );
    }
    return (
      <button type="submit" className="button button-primary" disabled={busy || reason !== null}>
        {phase === "wallet" ? (
          <>
            <Spinner /> Confirm in your wallet…
          </>
        ) : phase === "confirming" ? (
          <>
            <Spinner /> Sending…
          </>
        ) : (
          (reason ?? `Send ${formatToken(amount.value!, decimals!)} USDC`)
        )}
      </button>
    );
  }

  return (
    <div className="stack">
      <Balances
        isConnected={isConnected}
        isLoading={balances.isLoading}
        isError={balances.isError}
        usdcBalance={balances.usdcBalance}
        usdcDecimals={decimals}
        ethBalance={balances.ethBalance}
        ethUsd={ethUsd}
        usdcUsd={usdcUsd}
      />

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && reason === null) send();
        }}
      >
        <h2>Send USDC</h2>

        <label className="field">
          <span className="field-label">Recipient</span>
          <input
            className="input mono"
            placeholder="0x… or name.eth"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value.trim())}
            disabled={busy}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={!!recipient.error}
          />
          {recipient.error ? (
            <span className="field-hint error">{recipient.error}</span>
          ) : recipient.isResolving ? (
            <span className="field-hint muted">Checking…</span>
          ) : recipient.address ? (
            <span className="field-hint">
              <AddressDisplay address={recipient.address} name={recipient.ensName} />
            </span>
          ) : null}
          {recipient.warning && <span className="field-hint warning">{recipient.warning}</span>}
        </label>

        <label className="field">
          <span className="field-label">
            Amount
            {isConnected && balances.usdcBalance !== undefined && decimals !== undefined && (
              <button
                type="button"
                className="link-button"
                disabled={busy || balances.usdcBalance === 0n}
                onClick={() => setAmountInput(formatUnits(balances.usdcBalance!, decimals))}
              >
                Max
              </button>
            )}
          </span>
          <div className="input-with-suffix">
            <input
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => {
                const next = e.target.value.replace(",", ".").trim();
                if (/^\d*\.?\d*$/.test(next)) setAmountInput(next);
              }}
              disabled={busy}
              autoComplete="off"
              aria-invalid={!!amount.error || (amount.value !== undefined && !hasEnoughUsdc)}
            />
            <span className="suffix">USDC</span>
          </div>
          {amount.error ? (
            <span className="field-hint error">{amount.error}</span>
          ) : amount.value !== undefined && decimals !== undefined ? (
            <span className="field-hint muted">
              {formatUsd(amount.value, decimals, usdcUsd)}
              {!hasEnoughUsdc && balances.usdcBalance !== undefined && (
                <span className="error"> · exceeds your balance of {formatToken(balances.usdcBalance, decimals)} USDC</span>
              )}
            </span>
          ) : null}
        </label>

        {(reason === null || busy) && recipient.address && amount.value && decimals !== undefined && maxFee && (
          <div className="summary">
            <div>
              <span className="muted">You send</span>
              <span>
                {formatToken(amount.value, decimals)} USDC{" "}
                <span className="muted">{formatUsd(amount.value, decimals, usdcUsd)}</span>
              </span>
            </div>
            <div>
              <span className="muted">To</span>
              <AddressDisplay address={recipient.address} name={recipient.ensName} full />
            </div>
            <div>
              <span className="muted">Network fee (max)</span>
              <span>
                {formatToken(maxFee, 18, 6)} ETH <span className="muted">{formatUsd(maxFee, 18, ethUsd)}</span>
              </span>
            </div>
            <p className="small muted">Onchain transfers are final. Double-check the recipient address.</p>
          </div>
        )}

        {primaryAction()}

        {pendingHash && (
          <p className="small muted" role="status">
            Waiting for confirmation.{" "}
            <a href={explorerTxUrl(pendingHash)} target="_blank" rel="noopener noreferrer">
              View on Etherscan ↗
            </a>
          </p>
        )}

        {switchError && !isSwitching && wrongNetwork && (
          <p className="notice notice-error" role="alert">
            {parseTxError(switchError)}
          </p>
        )}
        {simulation.error && !busy && (
          <p className="notice notice-error" role="alert">
            {parseTxError(simulation.error)}
          </p>
        )}
        {!simulation.error && (gas.error || fees.error) && !busy && (
          <p className="notice notice-error" role="alert">
            {parseTxError(gas.error ?? fees.error)} Try again in a moment.
          </p>
        )}
        {balances.ethBalance !== undefined && maxFee !== undefined && !hasEnoughEth && (
          <p className="notice notice-warning" role="alert">
            This transfer needs up to {formatToken(maxFee, 18, 6)} ETH ({formatUsd(maxFee, 18, ethUsd)}) for the
            network fee. Add ETH to your wallet and try again.
          </p>
        )}
        {txError && (
          <p className="notice notice-error" role="alert">
            {txError}
          </p>
        )}
        {sent && decimals !== undefined && (
          <div className="notice notice-success" role="status">
            <p>
              Sent {formatToken(sent.amount, decimals)} USDC ({formatUsd(sent.amount, decimals, usdcUsd)}) to{" "}
              <AddressDisplay address={sent.to} name={sent.ensName} />
            </p>
            <a href={explorerTxUrl(sent.hash)} target="_blank" rel="noopener noreferrer">
              View transaction on Etherscan ↗
            </a>
          </div>
        )}
      </form>
    </div>
  );
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}
