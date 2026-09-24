"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState, type FormEvent } from "react";
import { encodeFunctionData, type Address } from "viem";
import {
  useAccount,
  useBalance,
  useEstimateFeesPerGas,
  useEstimateGas,
  useReadContract,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { useDebounced } from "@/hooks/useDebounced";
import { useRecipient } from "@/hooks/useRecipient";
import { describeError } from "@/lib/errors";
import { formatAmount, shortAddress } from "@/lib/format";
import { ETH_DECIMALS, USDC, etherscanAddress, etherscanTx } from "@/lib/usdc";
import { parseUsdcAmount } from "@/lib/validation";

const BALANCE_REFRESH_MS = 12_000; // ~1 mainnet block

type SentTransfer = { to: Address; label: string; amount: bigint };

export function PayForm() {
  const { address: account, status, chainId } = useAccount();
  const isConnected = status === "connected";
  const isWrongChain = isConnected && chainId !== mainnet.id;
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [sent, setSent] = useState<SentTransfer>();

  // Balances — always read from mainnet, regardless of the wallet's current chain.
  const ethBalance = useBalance({
    address: account,
    chainId: mainnet.id,
    query: { enabled: Boolean(account), refetchInterval: BALANCE_REFRESH_MS },
  });
  const usdcBalance = useReadContract({
    address: USDC.address,
    abi: USDC.abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    chainId: mainnet.id,
    query: { enabled: Boolean(account), refetchInterval: BALANCE_REFRESH_MS },
  });

  // Inputs are debounced before they hit the RPC; the send button waits for them to settle.
  const debouncedRecipient = useDebounced(recipientInput);
  const debouncedAmount = useDebounced(amountInput);
  const isSettling = debouncedRecipient !== recipientInput || debouncedAmount !== amountInput;

  const recipient = useRecipient(debouncedRecipient, account);
  const amount = parseUsdcAmount(debouncedAmount);
  const amountError =
    amount.error ??
    (amount.value !== undefined && usdcBalance.data !== undefined && amount.value > usdcBalance.data
      ? "Amount exceeds your USDC balance"
      : undefined);

  const transferArgs =
    recipient.address && amount.value !== undefined && !amountError
      ? ([recipient.address, amount.value] as const)
      : undefined;
  const canPrepare = isConnected && !isWrongChain && Boolean(account && transferArgs);

  // Dry-run the transfer so USDC-level failures (blacklist, pause, balance) surface before signing.
  const simulation = useSimulateContract({
    address: USDC.address,
    abi: USDC.abi,
    functionName: "transfer",
    args: transferArgs,
    account,
    chainId: mainnet.id,
    query: { enabled: canPrepare },
  });

  // Network fee estimate, so we can warn before the wallet does.
  const gas = useEstimateGas({
    account,
    to: USDC.address,
    data: transferArgs
      ? encodeFunctionData({ abi: USDC.abi, functionName: "transfer", args: transferArgs })
      : undefined,
    chainId: mainnet.id,
    query: { enabled: canPrepare },
  });
  const fees = useEstimateFeesPerGas({ chainId: mainnet.id, query: { enabled: canPrepare } });
  const maxFee = gas.data !== undefined && fees.data?.maxFeePerGas ? gas.data * fees.data.maxFeePerGas : undefined;
  const lacksGas = maxFee !== undefined && ethBalance.data !== undefined && ethBalance.data.value < maxFee;

  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data, chainId: mainnet.id });
  const isAwaitingWallet = write.isPending;
  const isConfirming = Boolean(write.data) && receipt.isLoading;
  const isBusy = isAwaitingWallet || isConfirming;

  // Once a tx is mined, refresh balances right away instead of waiting for the next poll.
  const { refetch: refetchEth } = ethBalance;
  const { refetch: refetchUsdc } = usdcBalance;
  useEffect(() => {
    if (!receipt.data) return;
    refetchEth();
    refetchUsdc();
    if (receipt.data.status === "success") setAmountInput("");
  }, [receipt.data, refetchEth, refetchUsdc]);

  const canSend =
    canPrepare && !isSettling && !isBusy && !lacksGas && Boolean(simulation.data) && !simulation.isFetching;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSend || !simulation.data || !transferArgs) return;
    setSent({ to: transferArgs[0], label: recipient.ensName ?? transferArgs[0], amount: transferArgs[1] });
    write.writeContract(simulation.data.request);
  }

  function onAmountChange(value: string) {
    const normalized = value.replace(",", ".");
    if (/^\d*\.?\d*$/.test(normalized)) setAmountInput(normalized);
  }

  function fillMax() {
    if (usdcBalance.data === undefined) return;
    setAmountInput(formatAmount(usdcBalance.data, USDC.decimals, USDC.decimals).replace(/,/g, ""));
  }

  function startOver() {
    write.reset();
    setSent(undefined);
  }

  if (status === "reconnecting" || status === "connecting") {
    return <div className="card muted">Connecting wallet…</div>;
  }

  if (!isConnected || !account) {
    return (
      <div className="card center">
        <p>Connect a wallet to send USDC on Ethereum.</p>
        <ConnectButton />
      </div>
    );
  }

  const formattedAmount = amount.value !== undefined ? formatAmount(amount.value, USDC.decimals, USDC.decimals) : "";
  const hasNoEth = ethBalance.data?.value === 0n;

  return (
    <div className="card">
      <section className="balances" aria-label="Your balances">
        <Balance
          label="USDC"
          value={usdcBalance.data}
          decimals={USDC.decimals}
          digits={2}
          isLoading={usdcBalance.isLoading}
          isError={usdcBalance.isError}
        />
        <Balance
          label="ETH"
          value={ethBalance.data?.value}
          decimals={ETH_DECIMALS}
          digits={5}
          isLoading={ethBalance.isLoading}
          isError={ethBalance.isError}
        />
      </section>

      {hasNoEth && (
        <p className="notice warn">You have no ETH. Sending USDC requires a small amount of ETH for the network fee.</p>
      )}

      {isWrongChain && (
        <div className="notice warn">
          <span>Your wallet is on another network. USDC Pay works on Ethereum mainnet only.</span>
          <button type="button" onClick={() => switchChain({ chainId: mainnet.id })} disabled={isSwitching}>
            {isSwitching ? "Switching…" : "Switch to Ethereum"}
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="recipient">Recipient</label>
        <input
          id="recipient"
          type="text"
          placeholder="0x… or name.eth"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={recipientInput}
          onChange={(e) => setRecipientInput(e.target.value)}
          disabled={isBusy}
          aria-invalid={Boolean(recipient.error)}
          aria-describedby="recipient-hint"
        />
        <p id="recipient-hint" className={recipient.error ? "hint error" : "hint"}>
          {recipient.isResolving
            ? "Resolving ENS name…"
            : recipient.error ??
              (recipient.address && recipient.ensName ? <code>{recipient.address}</code> : null)}
        </p>
        {recipient.isContract && (
          <p className="notice warn">
            This recipient is a smart contract. Only continue if you know it can receive USDC — tokens sent to
            the wrong contract can&apos;t be recovered.
          </p>
        )}

        <div className="label-row">
          <label htmlFor="amount">Amount</label>
          <button type="button" className="link" onClick={fillMax} disabled={isBusy || !usdcBalance.data}>
            Max
          </button>
        </div>
        <div className="amount-input">
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={amountInput}
            onChange={(e) => onAmountChange(e.target.value)}
            disabled={isBusy}
            aria-invalid={Boolean(amountError)}
            aria-describedby="amount-hint"
          />
          <span className="suffix">USDC</span>
        </div>
        <p id="amount-hint" className={amountError ? "hint error" : "hint"}>
          {amountError}
        </p>

        {canPrepare && !isSettling && (
          <div className="summary">
            {lacksGas && maxFee !== undefined ? (
              <p className="error">
                Not enough ETH for the network fee (up to {formatAmount(maxFee, ETH_DECIMALS, 6)} ETH).
              </p>
            ) : maxFee !== undefined ? (
              <p className="muted">Network fee: up to {formatAmount(maxFee, ETH_DECIMALS, 6)} ETH</p>
            ) : null}
            {simulation.error && <p className="error">{describeError(simulation.error)}</p>}
          </div>
        )}

        <button type="submit" className="primary" disabled={!canSend}>
          {isAwaitingWallet
            ? "Confirm in your wallet…"
            : isConfirming
              ? "Sending…"
              : canPrepare && (simulation.isFetching || isSettling)
                ? "Checking…"
                : formattedAmount && recipient.address
                  ? `Send ${formattedAmount} USDC to ${recipient.ensName ?? shortAddress(recipient.address)}`
                  : "Send USDC"}
        </button>
      </form>

      <TxStatus
        sent={sent}
        hash={write.data}
        writeError={write.error}
        receiptStatus={receipt.data?.status}
        receiptError={receipt.error}
        onDismiss={startOver}
      />
    </div>
  );
}

function Balance(props: {
  label: string;
  value: bigint | undefined;
  decimals: number;
  digits: number;
  isLoading: boolean;
  isError: boolean;
}) {
  const { label, value, decimals, digits, isLoading, isError } = props;
  return (
    <div className="balance">
      <span className="muted">{label} balance</span>
      <strong title={value !== undefined ? formatAmount(value, decimals, decimals) : undefined}>
        {isError ? "Unavailable" : isLoading || value === undefined ? "…" : formatAmount(value, decimals, digits)}
      </strong>
    </div>
  );
}

function TxStatus(props: {
  sent?: SentTransfer;
  hash?: `0x${string}`;
  writeError: Error | null;
  receiptStatus?: "success" | "reverted";
  receiptError: Error | null;
  onDismiss: () => void;
}) {
  const { sent, hash, writeError, receiptStatus, receiptError, onDismiss } = props;
  if (!sent) return null;

  const amount = `${formatAmount(sent.amount, USDC.decimals, USDC.decimals)} USDC`;
  const txLink = hash && (
    <a href={etherscanTx(hash)} target="_blank" rel="noreferrer">
      View on Etherscan
    </a>
  );

  if (writeError) {
    return (
      <div className="notice error" role="alert">
        <span>{describeError(writeError)}</span>
        <button type="button" className="link" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }
  if (!hash) return null;

  if (receiptStatus === "success") {
    return (
      <div className="notice success" role="status">
        <span>
          Sent {amount} to{" "}
          <a href={etherscanAddress(sent.to)} target="_blank" rel="noreferrer">
            {sent.label === sent.to ? shortAddress(sent.to) : sent.label}
          </a>
          . {txLink}
        </span>
        <button type="button" className="link" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }
  if (receiptStatus === "reverted") {
    return (
      <div className="notice error" role="alert">
        <span>Transaction failed on-chain; no USDC was sent. {txLink}</span>
        <button type="button" className="link" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }
  if (receiptError) {
    // We lost track of the tx (e.g. RPC issue) — it may still confirm. Never imply it failed.
    return (
      <div className="notice warn" role="status">
        <span>Couldn&apos;t confirm the transaction status. Check it before retrying: {txLink}</span>
        <button type="button" className="link" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }
  return (
    <div className="notice" role="status">
      <span>
        Sending {amount}… waiting for confirmation. {txLink}
      </span>
    </div>
  );
}
