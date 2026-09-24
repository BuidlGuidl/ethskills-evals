import { clsx } from "clsx";
import { CheckCircle2, Copy, ExternalLink, Loader2, LogOut, Send, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Address, BaseError, formatEther, formatUnits, isAddress, parseUnits } from "viem";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useEnsAddress,
  useEnsName,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { rpcHealth } from "../providers";
import { getFriendlyTxError } from "./errors";
import {
  formatEth,
  formatUsdc,
  formatUsd,
  normalizeAmountInput,
  parsedUsdcNumber,
  shortenAddress,
} from "./format";
import styles from "./pay.module.css";
import { erc20Abi, USDC_ADDRESS, USDC_DECIMALS } from "./usdc";
import { useEthUsdPrice } from "./use-eth-price";

const ETHERSCAN_BASE = "https://etherscan.io";

export function PayPanel() {
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { data: ensName } = useEnsName({ address, chainId: mainnet.id });
  const { data: ethPrice } = useEthUsdPrice();

  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [status, setStatus] = useState<"idle" | "submitting" | "confirming" | "confirmed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const trimmedRecipient = recipientInput.trim();
  const recipientIsEns = trimmedRecipient.includes(".") && !isAddress(trimmedRecipient);
  const { data: ensRecipientAddress, isFetching: isResolvingEns } = useEnsAddress({
    name: recipientIsEns ? trimmedRecipient : undefined,
    chainId: mainnet.id,
    query: {
      enabled: recipientIsEns,
    },
  });

  const recipientAddress = useMemo(() => {
    if (isAddress(trimmedRecipient)) return trimmedRecipient as Address;
    return ensRecipientAddress ?? undefined;
  }, [ensRecipientAddress, trimmedRecipient]);

  const amountNumber = parsedUsdcNumber(amountInput);
  const parsedAmount = useMemo(() => {
    if (!amountInput || amountNumber === null || amountNumber <= 0) return null;
    try {
      return parseUnits(amountInput, USDC_DECIMALS);
    } catch {
      return null;
    }
  }, [amountInput, amountNumber]);

  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({
    address,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address),
      refetchInterval: 5_000,
    },
  });

  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address),
      refetchInterval: 5_000,
    },
  });

  const { isSuccess: receiptConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(txHash),
    },
  });

  const isWrongNetwork = isConnected && chainId !== mainnet.id;
  const amountExceedsBalance = parsedAmount !== null && usdcBalance !== undefined && parsedAmount > usdcBalance;
  const canSubmit =
    isConnected &&
    !isWrongNetwork &&
    recipientAddress &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    !amountExceedsBalance &&
    status !== "submitting" &&
    status !== "confirming";

  const amountUsd = amountNumber === null ? null : amountNumber;
  const ethUsd = ethBalance?.value !== undefined && ethPrice ? Number(formatEther(ethBalance.value)) * ethPrice : null;
  const usdcUsd = usdcBalance === undefined ? null : Number(formatUnits(usdcBalance, USDC_DECIMALS));

  async function copyAddress(value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedAddress(value);
    window.setTimeout(() => setCopiedAddress(null), 1500);
  }

  async function refreshBalances() {
    await Promise.all([refetchEthBalance(), refetchUsdcBalance()]);
  }

  async function handleConnect() {
    setError(null);
    try {
      const connector = connectors[0];
      if (!connector) {
        setError("No browser wallet was detected. Install an Ethereum wallet and refresh the page.");
        return;
      }

      await connectAsync({ connector, chainId: mainnet.id });
    } catch (err) {
      setError(getFriendlyTxError(err));
    }
  }

  async function handleSwitchNetwork() {
    setError(null);
    try {
      await switchChainAsync({ chainId: mainnet.id });
    } catch (err) {
      setError(getFriendlyTxError(err));
    }
  }

  async function handleSend() {
    if (!recipientAddress || parsedAmount === null || !address) return;

    setError(null);
    setStatus("submitting");
    setTxHash(undefined);

    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipientAddress, parsedAmount],
        chainId: mainnet.id,
      });

      setTxHash(hash);
      setStatus("confirming");
    } catch (err) {
      const short = err instanceof BaseError ? err.shortMessage : getFriendlyTxError(err);
      setError(short || getFriendlyTxError(err));
      setStatus("idle");
    }
  }

  useEffect(() => {
    if (!receiptConfirmed) return;
    setStatus("confirmed");
    void refreshBalances();
  }, [receiptConfirmed]);

  const recipientError =
    trimmedRecipient.length === 0
      ? null
      : recipientIsEns && !isResolvingEns && !ensRecipientAddress
        ? "ENS name did not resolve on Ethereum mainnet."
        : !recipientIsEns && !isAddress(trimmedRecipient)
          ? "Enter a valid Ethereum address or ENS name."
          : null;

  const amountError =
    amountInput.length === 0
      ? null
      : parsedAmount === null || amountNumber === null || amountNumber <= 0
        ? "Enter a USDC amount greater than 0."
        : amountExceedsBalance
          ? "Amount exceeds your USDC balance."
          : null;

  return (
    <main className={styles.shell}>
      <section className={styles.headerBand}>
        <div className={styles.headerInner}>
          <div>
            <p className={styles.eyebrow}>Ethereum mainnet</p>
            <h1>USDC Pay</h1>
            <p className={styles.subtitle}>
              Send canonical USDC on Ethereum with balance checks, gas visibility, and recipient validation before a
              wallet ever opens.
            </p>
          </div>
          <HeaderWalletButton
            address={address}
            ensName={ensName}
            isConnecting={isConnecting}
            onConnect={handleConnect}
            onDisconnect={() => disconnect()}
          />
        </div>
      </section>

      <section className={styles.contentBand}>
        <div className={styles.grid}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Transfer</p>
                <h2>Send USDC</h2>
              </div>
              <ShieldCheck aria-hidden="true" />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="recipient">Recipient</label>
              <input
                id="recipient"
                value={recipientInput}
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="0x... or name.eth"
                onChange={(event) => {
                  setRecipientInput(event.target.value.trim());
                  setError(null);
                }}
                onPaste={(event) => {
                  event.preventDefault();
                  const text = event.clipboardData.getData("text").trim();
                  setRecipientInput(text);
                }}
              />
              <div className={styles.helperRow}>
                <span className={clsx(recipientError && styles.errorText)}>
                  {recipientError ??
                    (isResolvingEns
                      ? "Resolving ENS on mainnet..."
                      : recipientAddress
                        ? "Recipient is ready."
                        : "ENS names are resolved on Ethereum mainnet.")}
                </span>
                {recipientAddress ? (
                  <AddressTools
                    value={recipientAddress}
                    copied={copiedAddress === recipientAddress}
                    onCopy={() => copyAddress(recipientAddress)}
                  />
                ) : null}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="amount">Amount</label>
              <div className={styles.amountInput}>
                <input
                  id="amount"
                  value={amountInput}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(event) => {
                    setAmountInput(normalizeAmountInput(event.target.value));
                    setError(null);
                  }}
                />
                <span>USDC</span>
              </div>
              <div className={styles.helperRow}>
                <span className={clsx(amountError && styles.errorText)}>
                  {amountError ?? `Value ${formatUsd(amountUsd)}`}
                </span>
                {usdcBalance !== undefined ? <span>Available {formatUsdc(usdcBalance)} USDC</span> : null}
              </div>
            </div>

            <div className={styles.summary}>
              <div>
                <span>Token contract</span>
                <AddressTools
                  value={USDC_ADDRESS}
                  copied={copiedAddress === USDC_ADDRESS}
                  onCopy={() => copyAddress(USDC_ADDRESS)}
                />
              </div>
              <div>
                <span>Network</span>
                <strong>Ethereum mainnet</strong>
              </div>
              <div>
                <span>Transfer value</span>
                <strong>{amountInput ? `${amountInput} USDC (${formatUsd(amountUsd)})` : "Not entered"}</strong>
              </div>
            </div>

            {error ? <div className={styles.errorBox}>{error}</div> : null}

            {txHash ? (
              <a className={styles.txLink} href={`${ETHERSCAN_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                View transaction
              </a>
            ) : null}

            <PrimaryAction
              isConnected={isConnected}
              isWrongNetwork={isWrongNetwork}
              canSubmit={Boolean(canSubmit)}
              isConnecting={isConnecting}
              isSwitching={isSwitchingChain}
              status={status}
              onConnect={handleConnect}
              onSwitch={handleSwitchNetwork}
              onSend={handleSend}
            />
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.balancePanel}>
              <div className={styles.connectedRow}>
                <Wallet aria-hidden="true" />
                <div>
                  <span>Connected wallet</span>
                  <strong>{address ? ensName || shortenAddress(address) : "Not connected"}</strong>
                </div>
              </div>
              {address ? (
                <AddressTools value={address} copied={copiedAddress === address} onCopy={() => copyAddress(address)} />
              ) : null}
            </div>

            <div className={styles.balanceGrid}>
              <BalanceMetric label="USDC balance" value={`${formatUsdc(usdcBalance)} USDC`} usd={formatUsd(usdcUsd)} />
              <BalanceMetric label="ETH for gas" value={`${formatEth(ethBalance?.value)} ETH`} usd={formatUsd(ethUsd)} />
            </div>

            {!rpcHealth.configured ? (
              <div className={styles.notice}>
                <strong>RPC provider</strong>
                <span>Set VITE_ETHEREUM_RPC_URL before shipping. Local preview uses an explicit mainnet RPC.</span>
              </div>
            ) : null}

            <div className={clsx(styles.notice, status === "confirmed" && styles.successNotice)}>
              <strong>{status === "confirmed" ? "Transfer confirmed" : "Confirmation state"}</strong>
              <span>
                {status === "submitting"
                  ? "Waiting for wallet signature."
                  : status === "confirming"
                    ? "Transaction submitted. Waiting for Ethereum confirmation."
                    : status === "confirmed"
                      ? "Balances refreshed after the receipt was confirmed."
                      : "The send button stays locked through wallet submission and onchain confirmation."}
              </span>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function PrimaryAction({
  isConnected,
  isWrongNetwork,
  canSubmit,
  isConnecting,
  isSwitching,
  status,
  onConnect,
  onSwitch,
  onSend,
}: {
  isConnected: boolean;
  isWrongNetwork: boolean;
  canSubmit: boolean;
  isConnecting: boolean;
  isSwitching: boolean;
  status: "idle" | "submitting" | "confirming" | "confirmed";
  onConnect: () => void;
  onSwitch: () => void;
  onSend: () => void;
}) {
  if (!isConnected) {
    return (
      <button className={styles.primaryButton} type="button" disabled={isConnecting} onClick={onConnect}>
        {isConnecting ? <Loader2 className={styles.spin} size={18} aria-hidden="true" /> : <Wallet size={18} />}
        {isConnecting ? "Connecting..." : "Connect wallet"}
      </button>
    );
  }

  if (isWrongNetwork) {
    return (
      <button className={styles.primaryButton} type="button" disabled={isSwitching} onClick={onSwitch}>
        {isSwitching ? <Loader2 className={styles.spin} size={18} aria-hidden="true" /> : <ShieldCheck size={18} />}
        {isSwitching ? "Switching..." : "Switch to Ethereum"}
      </button>
    );
  }

  const busy = status === "submitting" || status === "confirming";

  return (
    <button className={styles.primaryButton} type="button" disabled={!canSubmit || busy} onClick={onSend}>
      {busy ? <Loader2 className={styles.spin} size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
      {status === "submitting" ? "Opening wallet..." : status === "confirming" ? "Confirming..." : "Send USDC"}
    </button>
  );
}

function HeaderWalletButton({
  address,
  ensName,
  isConnecting,
  onConnect,
  onDisconnect,
}: {
  address?: Address;
  ensName?: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!address) {
    return (
      <button className={styles.headerWalletButton} type="button" disabled={isConnecting} onClick={onConnect}>
        {isConnecting ? <Loader2 className={styles.spin} size={17} aria-hidden="true" /> : <Wallet size={17} />}
        {isConnecting ? "Connecting..." : "Connect"}
      </button>
    );
  }

  return (
    <div className={styles.connectedPill}>
      <span>{ensName || shortenAddress(address)}</span>
      <button type="button" title="Disconnect wallet" aria-label="Disconnect wallet" onClick={onDisconnect}>
        <LogOut size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

function BalanceMetric({ label, value, usd }: { label: string; value: string; usd: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{usd}</small>
    </div>
  );
}

function AddressTools({
  value,
  copied,
  onCopy,
}: {
  value: Address | string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <span className={styles.addressTools}>
      <code title={value}>{shortenAddress(value)}</code>
      <button type="button" title="Copy address" aria-label="Copy address" onClick={onCopy}>
        {copied ? <CheckCircle2 size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
      <a href={`${ETHERSCAN_BASE}/address/${value}`} target="_blank" rel="noreferrer" title="Open in Etherscan">
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </span>
  );
}
