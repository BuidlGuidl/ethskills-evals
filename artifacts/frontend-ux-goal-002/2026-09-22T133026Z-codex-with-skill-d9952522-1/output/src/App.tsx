import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Fuel,
  Loader2,
  LogOut,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useEnsAddress,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import {
  type Address,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
  zeroAddress,
} from "viem";
import { useCryptoPrices } from "./hooks/useCryptoPrices";
import { getFriendlyError } from "./lib/errors";
import {
  formatTokenAmount,
  formatUsd,
  shortenAddress,
  trimTokenInput,
} from "./lib/format";
import {
  ERC20_TRANSFER_ABI,
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_SYMBOL,
} from "./lib/usdc";
import { isRpcConfigured } from "./lib/wagmi";

type ParsedAmount =
  | { value?: undefined; error?: string }
  | { value: bigint; error?: undefined };

const GAS_WARNING_THRESHOLD = parseEther("0.002");

function parseUsdcAmount(input: string, balance?: bigint): ParsedAmount {
  const normalized = input.trim().replaceAll(",", "");

  if (!normalized) {
    return {};
  }

  if (!/^(\d+|\d+\.\d*|\.\d+)$/.test(normalized)) {
    return { error: "Enter a valid USDC amount." };
  }

  const [, fraction = ""] = normalized.split(".");
  if (fraction.length > USDC_DECIMALS) {
    return { error: "USDC supports up to 6 decimal places." };
  }

  try {
    const value = parseUnits(
      normalized.startsWith(".") ? `0${normalized}` : normalized,
      USDC_DECIMALS,
    );

    if (value <= 0n) {
      return { error: "Amount must be greater than zero." };
    }

    if (balance !== undefined && value > balance) {
      return { error: "Amount is greater than your USDC balance." };
    }

    return { value };
  } catch {
    return { error: "Enter a valid USDC amount." };
  }
}

function recipientKind(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    return "empty";
  }

  if (isAddress(trimmed)) {
    return "address";
  }

  if (trimmed.startsWith("0x")) {
    return "invalid-address";
  }

  if (trimmed.includes(".")) {
    return "ens";
  }

  return "invalid";
}

function priceLabel(
  price: ReturnType<typeof useCryptoPrices>,
  value: number | undefined,
) {
  if (price.isLoading) {
    return "Loading USD price...";
  }

  if (price.error && value === undefined) {
    return "USD unavailable";
  }

  const suffix = price.isStale ? " stale" : "";
  return `${formatUsd(value)}${suffix}`;
}

export function App() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [actionError, setActionError] = useState<string>();
  const [successHash, setSuccessHash] = useState<`0x${string}`>();
  const [pendingLabel, setPendingLabel] = useState<string>();
  const [copiedContract, setCopiedContract] = useState(false);

  const prices = useCryptoPrices();
  const publicClient = usePublicClient({ chainId: mainnet.id });
  const { address, chainId, isConnected } = useAccount();
  const {
    connectors,
    connectAsync,
    isPending: isConnecting,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    if (window.location.pathname !== "/pay") {
      window.history.replaceState(null, "", "/pay");
    }
  }, []);

  const kind = recipientKind(recipient);
  const directRecipient = useMemo<Address | undefined>(() => {
    const trimmed = recipient.trim();
    return isAddress(trimmed) ? getAddress(trimmed) : undefined;
  }, [recipient]);
  const ensName = kind === "ens" ? recipient.trim().toLowerCase() : undefined;
  const {
    data: ensAddress,
    error: ensError,
    isLoading: ensResolving,
  } = useEnsAddress({
    name: ensName,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(ensName && isRpcConfigured),
      retry: false,
    },
  });
  const resolvedRecipient = directRecipient ?? ensAddress ?? undefined;

  const {
    data: ethBalance,
    isLoading: ethBalanceLoading,
    refetch: refetchEthBalance,
  } = useBalance({
    address,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address && isRpcConfigured),
    },
  });
  const {
    data: usdcBalance,
    isLoading: usdcBalanceLoading,
    refetch: refetchUsdcBalance,
  } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_TRANSFER_ABI,
    functionName: "balanceOf",
    args: [address ?? zeroAddress],
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address && isRpcConfigured),
    },
  });

  const parsedAmount = useMemo(
    () => parseUsdcAmount(amount, usdcBalance),
    [amount, usdcBalance],
  );
  const amountInUsd =
    parsedAmount.value !== undefined && prices.usdcUsd !== undefined
      ? Number(formatUnits(parsedAmount.value, USDC_DECIMALS)) * prices.usdcUsd
      : undefined;
  const ethBalanceUsd =
    ethBalance?.value !== undefined && prices.ethUsd !== undefined
      ? Number(formatEther(ethBalance.value)) * prices.ethUsd
      : undefined;
  const usdcBalanceUsd =
    usdcBalance !== undefined && prices.usdcUsd !== undefined
      ? Number(formatUnits(usdcBalance, USDC_DECIMALS)) * prices.usdcUsd
      : undefined;
  const isMainnet = isConnected && chainId === mainnet.id;
  const hasLowGas =
    ethBalance?.value !== undefined && ethBalance.value < GAS_WARNING_THRESHOLD;

  const recipientMessage = useMemo(() => {
    if (kind === "empty") {
      return "Enter a 0x address or ENS name.";
    }

    if (kind === "address" && resolvedRecipient) {
      return "Ready to send to this address.";
    }

    if (kind === "invalid-address") {
      return "That 0x address is not valid.";
    }

    if (kind === "invalid") {
      return "Use a valid Ethereum address or ENS name.";
    }

    if (!isRpcConfigured) {
      return "ENS resolution needs VITE_ETHEREUM_RPC_URL.";
    }

    if (ensResolving) {
      return "Resolving ENS on Ethereum mainnet...";
    }

    if (ensError || !resolvedRecipient) {
      return "No Ethereum address was found for that ENS name.";
    }

    return "ENS resolved on Ethereum mainnet.";
  }, [ensError, ensResolving, kind, resolvedRecipient]);

  const canSend =
    isConnected &&
    isMainnet &&
    isRpcConfigured &&
    Boolean(publicClient) &&
    Boolean(resolvedRecipient) &&
    parsedAmount.value !== undefined &&
    usdcBalance !== undefined &&
    !pendingLabel;

  async function handleConnect() {
    setActionError(undefined);
    const connector = connectors[0];

    if (!connector) {
      setActionError("No browser wallet was found.");
      return;
    }

    try {
      await connectAsync({ connector, chainId: mainnet.id });
    } catch (error) {
      setActionError(getFriendlyError(error));
    }
  }

  async function handleSwitchNetwork() {
    setActionError(undefined);

    try {
      await switchChainAsync({ chainId: mainnet.id });
    } catch (error) {
      setActionError(getFriendlyError(error));
    }
  }

  async function handleSend() {
    if (!resolvedRecipient || parsedAmount.value === undefined || !publicClient) {
      return;
    }

    setActionError(undefined);
    setSuccessHash(undefined);
    setPendingLabel("Confirm in wallet");

    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [resolvedRecipient, parsedAmount.value],
        chainId: mainnet.id,
      });

      setPendingLabel("Waiting for Ethereum confirmation");
      await publicClient.waitForTransactionReceipt({ hash });
      setPendingLabel("Refreshing balances");
      await Promise.all([refetchUsdcBalance(), refetchEthBalance()]);
      setSuccessHash(hash);
      setAmount("");
    } catch (error) {
      setActionError(getFriendlyError(error));
    } finally {
      setPendingLabel(undefined);
    }
  }

  async function handlePrimaryAction() {
    if (!isConnected) {
      await handleConnect();
      return;
    }

    if (!isMainnet) {
      await handleSwitchNetwork();
      return;
    }

    await handleSend();
  }

  async function copyContract() {
    await navigator.clipboard.writeText(USDC_ADDRESS);
    setCopiedContract(true);
    window.setTimeout(() => setCopiedContract(false), 1400);
  }

  const primaryLabel = !isConnected
    ? "Connect wallet"
    : !isMainnet
      ? "Switch to Ethereum"
      : pendingLabel
        ? pendingLabel
        : "Send USDC";
  const primaryDisabled =
    Boolean(pendingLabel) ||
    isConnecting ||
    isSwitching ||
    (isConnected && isMainnet && !canSend);

  return (
    <main className="app-shell">
      <section className="pay-layout" aria-label="USDC payment page">
        <div className="product-panel">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              $
            </div>
            <div>
              <p className="eyebrow">Ethereum mainnet</p>
              <h1>USDC Pay</h1>
            </div>
          </div>

          <div className="network-pill">
            <span className="status-dot" />
            Real USDC · 6 decimals
          </div>

          <div className="contract-row">
            <span>Token contract</span>
            <button
              className="copy-button"
              type="button"
              onClick={copyContract}
              title="Copy USDC contract address"
            >
              <span>{shortenAddress(USDC_ADDRESS)}</span>
              {copiedContract ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            </button>
          </div>

          {!isRpcConfigured ? (
            <div className="notice danger" role="alert">
              <AlertCircle size={18} />
              <span>
                Configure <code>VITE_ETHEREUM_RPC_URL</code> before using
                mainnet reads or payments.
              </span>
            </div>
          ) : null}

          <div className="balance-grid" aria-label="Wallet balances">
            <div className="balance-card">
              <div className="balance-label">
                <span>{USDC_SYMBOL} balance</span>
                {usdcBalanceLoading ? <Loader2 className="spin" size={15} /> : null}
              </div>
              <strong>
                {formatTokenAmount(usdcBalance, USDC_DECIMALS, 2)} {USDC_SYMBOL}
              </strong>
              <small>{priceLabel(prices, usdcBalanceUsd)}</small>
            </div>

            <div className="balance-card">
              <div className="balance-label">
                <span>ETH for gas</span>
                {ethBalanceLoading ? <Loader2 className="spin" size={15} /> : null}
              </div>
              <strong>
                {ethBalance?.value === undefined
                  ? "--"
                  : formatTokenAmount(ethBalance.value, 18, 5)}{" "}
                ETH
              </strong>
              <small>{priceLabel(prices, ethBalanceUsd)}</small>
            </div>
          </div>

          {hasLowGas ? (
            <div className="notice warning" role="status">
              <Fuel size={18} />
              <span>Your ETH balance may be too low for mainnet gas.</span>
            </div>
          ) : null}
        </div>

        <form
          className="payment-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void handlePrimaryAction();
          }}
        >
          <header className="panel-header">
            <div>
              <p className="eyebrow">Payment</p>
              <h2>Send USDC</h2>
            </div>

            {isConnected && address ? (
              <div className="wallet-chip">
                <Wallet size={16} />
                <span>{shortenAddress(address)}</span>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  title="Disconnect wallet"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="wallet-chip muted">
                <Wallet size={16} />
                <span>Wallet not connected</span>
              </div>
            )}
          </header>

          <label className="field">
            <span>Recipient</span>
            <input
              autoComplete="off"
              inputMode="text"
              placeholder="vitalik.eth or 0x..."
              value={recipient}
              onChange={(event) => {
                setRecipient(event.target.value);
                setActionError(undefined);
                setSuccessHash(undefined);
              }}
            />
          </label>

          <div
            className={
              resolvedRecipient
                ? "input-help success-text"
                : kind === "empty" || ensResolving
                  ? "input-help"
                  : "input-help error-text"
            }
          >
            {ensResolving ? <Loader2 className="spin" size={15} /> : null}
            <span>{recipientMessage}</span>
          </div>

          {resolvedRecipient ? (
            <div className="resolved-row">
              <span>Resolved address</span>
              <strong>{shortenAddress(resolvedRecipient)}</strong>
            </div>
          ) : null}

          <label className="field">
            <span>Amount</span>
            <div className="amount-input">
              <input
                autoComplete="off"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setActionError(undefined);
                  setSuccessHash(undefined);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (usdcBalance !== undefined) {
                    setAmount(
                      trimTokenInput(
                        formatUnits(usdcBalance, USDC_DECIMALS),
                        USDC_DECIMALS,
                      ),
                    );
                  }
                }}
                disabled={usdcBalance === undefined}
              >
                Max
              </button>
            </div>
          </label>

          <div
            className={parsedAmount.error ? "input-help error-text" : "input-help"}
          >
            <span>
              {parsedAmount.error ??
                (amount
                  ? `Estimated value ${priceLabel(prices, amountInUsd)}`
                  : "USDC transfers use 6 decimal places.")}
            </span>
          </div>

          {actionError ? (
            <div className="notice danger" role="alert">
              <AlertCircle size={18} />
              <span>{actionError}</span>
            </div>
          ) : null}

          {successHash ? (
            <a
              className="notice success"
              href={`https://etherscan.io/tx/${successHash}`}
              target="_blank"
              rel="noreferrer"
            >
              <CheckCircle2 size={18} />
              <span>Payment confirmed</span>
              <ExternalLink size={16} />
            </a>
          ) : null}

          <button className="primary-action" type="submit" disabled={primaryDisabled}>
            {pendingLabel || isConnecting || isSwitching ? (
              <Loader2 className="spin" size={18} />
            ) : !isConnected ? (
              <Wallet size={18} />
            ) : !isMainnet ? (
              <RefreshCw size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            <span>{primaryLabel}</span>
          </button>
        </form>
      </section>
    </main>
  );
}

