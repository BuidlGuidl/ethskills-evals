import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Address,
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  createPublicClient,
  custom,
  fallback,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  namehash,
  parseAbi,
  parseUnits,
  zeroAddress,
} from "viem";
import { mainnet } from "viem/chains";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type Balances = {
  usdc: bigint;
  eth: bigint;
  ethUsdPrice: number | null;
};

type RecipientState =
  | { status: "idle"; address: null; label: "" }
  | { status: "validating"; address: null; label: string }
  | { status: "valid"; address: Address; label: string }
  | { status: "invalid"; address: null; label: string; message: string };

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as const;
const USDC_DECIMALS = 6;
const MAINNET_CHAIN_ID = 1;
const MAINNET_CHAIN_ID_HEX = "0x1";
const POLL_INTERVAL_MS = 4_000;

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
]);

const chainlinkAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

const ensResolverAbi = parseAbi(["function addr(bytes32 node) view returns (address)"]);

const rpcTransports = [
  import.meta.env.VITE_MAINNET_RPC_URL ? http(import.meta.env.VITE_MAINNET_RPC_URL) : null,
  http("https://ethereum-rpc.publicnode.com"),
].filter(Boolean) as ReturnType<typeof http>[];

const publicClient = createPublicClient({
  chain: mainnet,
  transport: fallback(rpcTransports, { rank: false }),
  pollingInterval: POLL_INTERVAL_MS,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const tokenFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

function App() {
  const isPayRoute = window.location.pathname === "/pay";

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState(null, "", "/pay");
    }
  }, []);

  return (
    <main className="app-shell">
      {isPayRoute || window.location.pathname === "/" ? <PayPage /> : <NotFound />}
    </main>
  );
}

function PayPage() {
  const [account, setAccount] = useState<Address | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [connectPending, setConnectPending] = useState(false);
  const [switchPending, setSwitchPending] = useState(false);
  const [sendPending, setSendPending] = useState(false);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balancesPending, setBalancesPending] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");
  const [recipient, setRecipient] = useState<RecipientState>({
    status: "idle",
    address: null,
    label: "",
  });
  const [amountInput, setAmountInput] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isWrongNetwork = Boolean(account && walletChainId !== MAINNET_CHAIN_ID);
  const parsedAmount = useMemo(() => parseUsdcAmount(amountInput), [amountInput]);
  const amountUsd = parsedAmount.valid ? Number(formatUnits(parsedAmount.value, USDC_DECIMALS)) : 0;
  const hasEnoughUsdc = balances && parsedAmount.valid ? balances.usdc >= parsedAmount.value : false;
  const ethValueUsd =
    balances?.ethUsdPrice == null
      ? null
      : Number(formatEther(balances.eth)) * balances.ethUsdPrice;
  const canSend =
    Boolean(account) &&
    !isWrongNetwork &&
    recipient.status === "valid" &&
    parsedAmount.valid &&
    parsedAmount.value > 0n &&
    Boolean(hasEnoughUsdc) &&
    !sendPending;

  const loadBalances = useCallback(async (address: Address) => {
    setBalancesPending(true);
    try {
      const [ethBalance, usdcBalance, priceData, priceDecimals] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
        publicClient.readContract({
          address: ETH_USD_FEED,
          abi: chainlinkAbi,
          functionName: "latestRoundData",
        }),
        publicClient.readContract({
          address: ETH_USD_FEED,
          abi: chainlinkAbi,
          functionName: "decimals",
        }),
      ]);

      const priceAnswer = priceData[1];
      const nextPrice =
        priceAnswer > 0n ? Number(formatUnits(priceAnswer, priceDecimals)) : null;

      setBalances({
        eth: ethBalance,
        usdc: usdcBalance,
        ethUsdPrice: nextPrice,
      });
    } catch (nextError) {
      setError(toUserError(nextError));
    } finally {
      setBalancesPending(false);
    }
  }, []);

  const refreshWalletState = useCallback(async () => {
    if (!window.ethereum) return;
    const [accountsResult, chainIdResult] = await Promise.all([
      window.ethereum.request({ method: "eth_accounts" }),
      window.ethereum.request({ method: "eth_chainId" }),
    ]);
    const nextAccounts = accountsResult as string[];
    const nextAccount = nextAccounts[0] && isAddress(nextAccounts[0]) ? getAddress(nextAccounts[0]) : null;
    setAccount(nextAccount);
    setWalletChainId(Number.parseInt(chainIdResult as string, 16));
    if (nextAccount) {
      await loadBalances(nextAccount);
    } else {
      setBalances(null);
    }
  }, [loadBalances]);

  useEffect(() => {
    void refreshWalletState();
  }, [refreshWalletState]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => void refreshWalletState();
    const handleChainChanged = () => void refreshWalletState();

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshWalletState]);

  useEffect(() => {
    if (!account) return;
    const interval = window.setInterval(() => {
      void loadBalances(account);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [account, loadBalances]);

  useEffect(() => {
    const rawValue = recipientInput.trim();
    setError(null);
    setTxHash(null);

    if (!rawValue) {
      setRecipient({ status: "idle", address: null, label: "" });
      return;
    }

    if (isAddress(rawValue)) {
      setRecipient({ status: "valid", address: getAddress(rawValue), label: getAddress(rawValue) });
      return;
    }

    if (!rawValue.toLowerCase().endsWith(".eth")) {
      setRecipient({
        status: "invalid",
        address: null,
        label: rawValue,
        message: "Enter a valid Ethereum address or ENS name.",
      });
      return;
    }

    let cancelled = false;
    setRecipient({ status: "validating", address: null, label: rawValue });

    const resolveEns = async () => {
      try {
        const resolver = await publicClient.getEnsResolver({ name: rawValue });
        if (!resolver) {
          throw new Error("ENS name has no resolver.");
        }

        const resolvedAddress = await publicClient.readContract({
          address: resolver,
          abi: ensResolverAbi,
          functionName: "addr",
          args: [namehash(rawValue)],
        });

        if (cancelled) return;

        if (!resolvedAddress || resolvedAddress === zeroAddress) {
          setRecipient({
            status: "invalid",
            address: null,
            label: rawValue,
            message: "That ENS name does not resolve to an Ethereum address.",
          });
          return;
        }

        setRecipient({
          status: "valid",
          address: getAddress(resolvedAddress),
          label: rawValue,
        });
      } catch {
        if (!cancelled) {
          setRecipient({
            status: "invalid",
            address: null,
            label: rawValue,
            message: "Unable to resolve that ENS name right now.",
          });
        }
      }
    };

    void resolveEns();

    return () => {
      cancelled = true;
    };
  }, [recipientInput]);

  async function connectWallet() {
    if (!window.ethereum) {
      setError("No Ethereum wallet was detected. Install a wallet extension to continue.");
      return;
    }

    setConnectPending(true);
    setError(null);
    setNotice(null);

    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const nextAccount = accounts[0] && isAddress(accounts[0]) ? getAddress(accounts[0]) : null;
      if (!nextAccount) {
        throw new Error("No wallet account was returned.");
      }
      const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      setAccount(nextAccount);
      setWalletChainId(Number.parseInt(chainId, 16));
      await loadBalances(nextAccount);
    } catch (nextError) {
      setError(toUserError(nextError));
    } finally {
      setConnectPending(false);
    }
  }

  async function switchToMainnet() {
    if (!window.ethereum) return;

    setSwitchPending(true);
    setError(null);
    setNotice(null);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MAINNET_CHAIN_ID_HEX }],
      });
      await refreshWalletState();
    } catch (nextError) {
      setError(toUserError(nextError));
    } finally {
      setSwitchPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!account) {
      await connectWallet();
      return;
    }

    if (isWrongNetwork) {
      await switchToMainnet();
      return;
    }

    if (!canSend || recipient.status !== "valid" || !parsedAmount.valid || !window.ethereum) {
      setError(formErrorMessage(recipient, parsedAmount, balances));
      return;
    }

    setSendPending(true);
    setError(null);
    setNotice("Confirm the USDC transfer in your wallet.");
    setTxHash(null);

    try {
      const walletClient = createWalletClient(account, window.ethereum);
      const hash = await walletClient.writeContract({
        account,
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient.address, parsedAmount.value],
        chain: mainnet,
      });

      setTxHash(hash);
      setNotice("Transaction submitted. Waiting for Ethereum confirmation...");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        pollingInterval: POLL_INTERVAL_MS,
      });

      if (receipt.status !== "success") {
        throw new Error("The transaction was included but did not succeed.");
      }

      setNotice("USDC transfer confirmed.");
      setAmountInput("");
      await loadBalances(account);
    } catch (nextError) {
      setError(toUserError(nextError));
      setNotice(null);
    } finally {
      setSendPending(false);
    }
  }

  function disconnect() {
    setAccount(null);
    setBalances(null);
    setWalletChainId(null);
    setNotice(null);
    setError(null);
    setTxHash(null);
  }

  const primaryAction = getPrimaryAction({
    account,
    isWrongNetwork,
    canSend,
    connectPending,
    switchPending,
    sendPending,
  });

  return (
    <section className="pay-layout" aria-labelledby="pay-title">
      <div className="intro-panel">
        <div className="product-mark">
          <span className="mark-dot" aria-hidden="true">
            $
          </span>
          <span>USDC Pay</span>
        </div>
        <div>
          <p className="eyebrow">Ethereum mainnet</p>
          <h1 id="pay-title">Send real USDC with gas clarity.</h1>
          <p className="lead">
            Connect your wallet, review your available USDC and ETH for gas, then send USDC
            directly from your wallet to any Ethereum address or ENS name.
          </p>
        </div>
        <div className="trust-strip" aria-label="Payment safeguards">
          <div>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>USDC mainnet</span>
          </div>
          <div>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>6 decimals</span>
          </div>
          <div>
            <ArrowUpRight size={18} aria-hidden="true" />
            <span>Explorer links</span>
          </div>
        </div>
      </div>

      <div className="payment-surface">
        <header className="wallet-bar">
          <div>
            <p className="section-label">Wallet</p>
            {account ? (
              <AddressPill address={account} label="Connected account" />
            ) : (
              <p className="muted">No wallet connected</p>
            )}
          </div>
          {account ? (
            <button className="icon-button" type="button" onClick={disconnect} title="Disconnect wallet">
              <LogOut size={18} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <div className="balance-grid" aria-label="Balances">
          <BalanceTile
            label="USDC balance"
            value={balances ? tokenFormatter.format(Number(formatUnits(balances.usdc, USDC_DECIMALS))) : "-"}
            unit="USDC"
            usdValue={balances ? usdFormatter.format(Number(formatUnits(balances.usdc, USDC_DECIMALS))) : null}
            pending={balancesPending}
          />
          <BalanceTile
            label="ETH for gas"
            value={balances ? compactFormatter.format(Number(formatEther(balances.eth))) : "-"}
            unit="ETH"
            usdValue={ethValueUsd == null ? null : usdFormatter.format(ethValueUsd)}
            pending={balancesPending}
          />
        </div>

        {account ? (
          <div className={isWrongNetwork ? "network-banner warning" : "network-banner"}>
            <span>{isWrongNetwork ? "Wrong network" : "Ready on Ethereum mainnet"}</span>
            <span>
              {isWrongNetwork
                ? "Switch before sending USDC."
                : "Payments use the official mainnet USDC contract."}
            </span>
          </div>
        ) : null}

        <form className="pay-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Recipient</span>
            <input
              value={recipientInput}
              onChange={(event) => setRecipientInput(event.target.value.trim())}
              placeholder="vitalik.eth or 0x..."
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <RecipientHint recipient={recipient} />

          <label className="field amount-field">
            <span>Amount</span>
            <div>
              <input
                value={amountInput}
                onChange={(event) => setAmountInput(normalizeAmountInput(event.target.value))}
                placeholder="0.00"
                inputMode="decimal"
              />
              <strong>USDC</strong>
            </div>
          </label>
          <div className="amount-context">
            <span>{parsedAmount.valid ? `~${usdFormatter.format(amountUsd)}` : "Enter up to 6 decimals"}</span>
            {balances && parsedAmount.valid && parsedAmount.value > balances.usdc ? (
              <span className="danger">Amount exceeds your USDC balance.</span>
            ) : null}
          </div>

          <button
            className="primary-action"
            type="submit"
            disabled={primaryAction.disabled}
            aria-busy={connectPending || switchPending || sendPending}
          >
            {primaryAction.pending ? (
              <Loader2 className="spinner" size={18} aria-hidden="true" />
            ) : primaryAction.icon === "wallet" ? (
              <Wallet size={18} aria-hidden="true" />
            ) : (
              <Send size={18} aria-hidden="true" />
            )}
            <span>{primaryAction.label}</span>
          </button>
        </form>

        <StatusPanel notice={notice} error={error} txHash={txHash} />

        <footer className="contract-footer">
          <span>USDC contract</span>
          <AddressLink address={USDC_ADDRESS} />
          {account ? (
            <button
              className="text-button"
              type="button"
              onClick={() => void loadBalances(account)}
              disabled={balancesPending}
            >
              <RefreshCw size={15} className={balancesPending ? "spinner" : ""} aria-hidden="true" />
              Refresh
            </button>
          ) : null}
        </footer>
      </div>
    </section>
  );
}

function createWalletClient(account: Address, provider: Eip1193Provider) {
  return {
    writeContract: async (args: {
      account: Address;
      address: Address;
      abi: typeof erc20Abi;
      functionName: "transfer";
      args: [Address, bigint];
      chain: typeof mainnet;
    }) => {
      const walletClient = await import("viem").then(({ createWalletClient }) =>
        createWalletClient({
          account,
          chain: mainnet,
          transport: custom(provider),
        }),
      );
      return walletClient.writeContract(args);
    },
  };
}

function BalanceTile({
  label,
  value,
  unit,
  usdValue,
  pending,
}: {
  label: string;
  value: string;
  unit: string;
  usdValue: string | null;
  pending: boolean;
}) {
  return (
    <article className="balance-tile">
      <div>
        <span>{label}</span>
        {pending ? <Loader2 size={15} className="spinner" aria-hidden="true" /> : null}
      </div>
      <strong>
        {value} <small>{unit}</small>
      </strong>
      <p>{usdValue ?? "USD price unavailable"}</p>
    </article>
  );
}

function RecipientHint({ recipient }: { recipient: RecipientState }) {
  if (recipient.status === "idle") {
    return <p className="field-hint">Paste an address or enter an ENS name.</p>;
  }

  if (recipient.status === "validating") {
    return (
      <p className="field-hint">
        <Loader2 size={14} className="spinner" aria-hidden="true" />
        Resolving ENS...
      </p>
    );
  }

  if (recipient.status === "invalid") {
    return <p className="field-hint danger">{recipient.message}</p>;
  }

  return (
    <p className="field-hint success">
      <CheckCircle2 size={14} aria-hidden="true" />
      Sending to <AddressLink address={recipient.address} label={recipient.label} />
    </p>
  );
}

function StatusPanel({
  notice,
  error,
  txHash,
}: {
  notice: string | null;
  error: string | null;
  txHash: `0x${string}` | null;
}) {
  if (!notice && !error && !txHash) return null;

  return (
    <div className={error ? "status-panel error" : "status-panel"}>
      {error ? <AlertCircle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
      <div>
        <p>{error ?? notice}</p>
        {txHash ? (
          <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
            View transaction
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function AddressPill({ address, label }: { address: Address; label: string }) {
  return (
    <div className="address-pill" aria-label={label}>
      <span className="address-identicon" aria-hidden="true" style={{ background: addressGradient(address) }} />
      <AddressLink address={address} />
      <CopyButton value={address} />
    </div>
  );
}

function AddressLink({ address, label }: { address: Address; label?: string }) {
  return (
    <a className="address-link" href={`https://etherscan.io/address/${address}`} target="_blank" rel="noreferrer">
      {label && label !== address ? label : truncateAddress(address)}
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="copy-button"
      type="button"
      title={copied ? "Copied" : "Copy address"}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1_500);
      }}
    >
      {copied ? <CheckCircle2 size={15} aria-hidden="true" /> : <Clipboard size={15} aria-hidden="true" />}
    </button>
  );
}

function NotFound() {
  return (
    <section className="not-found">
      <h1>Page not found</h1>
      <a href="/pay">Open USDC Pay</a>
    </section>
  );
}

function getPrimaryAction({
  account,
  isWrongNetwork,
  canSend,
  connectPending,
  switchPending,
  sendPending,
}: {
  account: Address | null;
  isWrongNetwork: boolean;
  canSend: boolean;
  connectPending: boolean;
  switchPending: boolean;
  sendPending: boolean;
}) {
  if (!account) {
    return {
      label: connectPending ? "Connecting..." : "Connect wallet",
      disabled: connectPending,
      pending: connectPending,
      icon: "wallet" as const,
    };
  }

  if (isWrongNetwork) {
    return {
      label: switchPending ? "Switching..." : "Switch to Ethereum",
      disabled: switchPending,
      pending: switchPending,
      icon: "send" as const,
    };
  }

  return {
    label: sendPending ? "Sending USDC..." : "Send USDC",
    disabled: !canSend,
    pending: sendPending,
    icon: "send" as const,
  };
}

function parseUsdcAmount(value: string): { valid: true; value: bigint } | { valid: false } {
  const trimmed = value.trim();
  if (!trimmed || !/^\d+(\.\d{0,6})?$/.test(trimmed)) {
    return { valid: false };
  }

  try {
    return { valid: true, value: parseUnits(trimmed, USDC_DECIMALS) };
  } catch {
    return { valid: false };
  }
}

function normalizeAmountInput(value: string) {
  const cleanValue = value.replace(/[^\d.]/g, "");
  const [whole, ...fractions] = cleanValue.split(".");
  const fraction = fractions.join("").slice(0, USDC_DECIMALS);
  return fractions.length > 0 ? `${whole}.${fraction}` : whole;
}

function formErrorMessage(
  recipient: RecipientState,
  parsedAmount: ReturnType<typeof parseUsdcAmount>,
  balances: Balances | null,
) {
  if (recipient.status !== "valid") return "Enter a valid recipient before sending.";
  if (!parsedAmount.valid || parsedAmount.value <= 0n) return "Enter a USDC amount greater than zero.";
  if (balances && parsedAmount.value > balances.usdc) return "You do not have enough USDC for that payment.";
  return "Check the payment details and try again.";
}

function toUserError(error: unknown) {
  const walletError = error as { code?: number; shortMessage?: string; message?: string };
  if (walletError.code === 4001) return "You rejected the wallet request.";
  if (walletError.code === -32000) return "Your wallet could not submit the transaction. Check gas and try again.";
  if (walletError.code === 4902) return "Ethereum mainnet is not available in this wallet.";

  if (error instanceof ContractFunctionRevertedError) {
    return error.reason ? `USDC transfer reverted: ${error.reason}` : "USDC transfer reverted.";
  }

  if (error instanceof ContractFunctionExecutionError) {
    return "USDC transfer failed before submission. Check the recipient, amount, and network.";
  }

  if (error instanceof BaseError) {
    return error.shortMessage;
  }

  return walletError.shortMessage ?? walletError.message ?? "Something went wrong. Please try again.";
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function addressGradient(address: string) {
  const hueA = Number.parseInt(address.slice(2, 6), 16) % 360;
  const hueB = Number.parseInt(address.slice(6, 10), 16) % 360;
  return `linear-gradient(135deg, hsl(${hueA} 72% 52%), hsl(${hueB} 78% 46%))`;
}

export { App };
