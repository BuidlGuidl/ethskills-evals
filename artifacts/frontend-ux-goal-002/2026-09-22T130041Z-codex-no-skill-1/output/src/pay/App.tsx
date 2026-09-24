import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  ContractFunctionExecutionError,
  UserRejectedRequestError,
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { mainnet } from "viem/chains";
import {
  USDC_ADDRESS,
  USDC_DECIMALS,
  USDC_SYMBOL,
  usdcAbi,
} from "../web3/usdc";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type ParsedAmount =
  | { ok: true; value: bigint }
  | { ok: false; message: string };

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

function parseUsdcAmount(input: string): ParsedAmount {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, message: "Enter an amount." };
  }

  if (!/^\d+(\.\d*)?$/.test(trimmed)) {
    return { ok: false, message: "Use a valid decimal amount." };
  }

  const decimals = trimmed.split(".")[1]?.length ?? 0;
  if (decimals > USDC_DECIMALS) {
    return { ok: false, message: "USDC supports up to 6 decimal places." };
  }

  try {
    const value = parseUnits(trimmed, USDC_DECIMALS);

    if (value <= 0n) {
      return { ok: false, message: "Amount must be greater than zero." };
    }

    return { ok: true, value };
  } catch {
    return { ok: false, message: "Use a valid USDC amount." };
  }
}

function truncateAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenAmount(value?: bigint, decimals = 18, maxFraction = 6) {
  if (value === undefined) return "0";
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const clippedFraction = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return clippedFraction ? `${whole}.${clippedFraction}` : whole;
}

function getErrorMessage(error: unknown) {
  if (!error) return "";
  if (error instanceof UserRejectedRequestError) return "Request rejected in wallet.";
  if (error instanceof ContractFunctionExecutionError) return error.shortMessage;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

async function readWalletState(provider: Eip1193Provider) {
  const [accountsResult, chainResult] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  const accounts = accountsResult as string[];

  return {
    address: accounts[0] ? getAddress(accounts[0]) : undefined,
    chainId: Number.parseInt(chainResult as string, 16),
  };
}

export function App() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [ethBalance, setEthBalance] = useState<bigint>();
  const [usdcBalance, setUsdcBalance] = useState<bigint>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [txHash, setTxHash] = useState<Hash>();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState("");

  const hasInjectedWallet = Boolean(window.ethereum);
  const isConnected = Boolean(address);
  const onMainnet = chainId === mainnet.id;

  const parsedAmount = useMemo(() => parseUsdcAmount(amount), [amount]);
  const recipientIsValid = isAddress(recipient);
  const hasEnoughUsdc =
    parsedAmount.ok && usdcBalance !== undefined
      ? parsedAmount.value <= usdcBalance
      : true;
  const canSubmit =
    isConnected &&
    onMainnet &&
    recipientIsValid &&
    parsedAmount.ok &&
    hasEnoughUsdc &&
    !isWriting &&
    !isConfirming;

  const refreshBalances = useCallback(
    async (nextAddress = address) => {
      if (!nextAddress) return;

      setIsBalanceLoading(true);
      setError("");
      try {
        const [nextEthBalance, nextUsdcBalance] = await Promise.all([
          publicClient.getBalance({ address: nextAddress }),
          publicClient.readContract({
            address: USDC_ADDRESS,
            abi: usdcAbi,
            functionName: "balanceOf",
            args: [nextAddress],
          }),
        ]);
        setEthBalance(nextEthBalance);
        setUsdcBalance(nextUsdcBalance);
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
      } finally {
        setIsBalanceLoading(false);
      }
    },
    [address],
  );

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const ethereum = provider;

    async function hydrateWalletState() {
      try {
        const state = await readWalletState(ethereum);
        setAddress(state.address);
        setChainId(state.chainId);
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
      }
    }

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts[0] ? getAddress(accounts[0]) : undefined);
      setTxHash(undefined);
      setIsConfirmed(false);
    };

    const handleChainChanged = (...args: unknown[]) => {
      setChainId(Number.parseInt(args[0] as string, 16));
    };

    void hydrateWalletState();
    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    if (!address) {
      setEthBalance(undefined);
      setUsdcBalance(undefined);
      return;
    }

    void refreshBalances(address);
  }, [address, refreshBalances]);

  const validationMessage = useMemo(() => {
    if (!recipient.trim()) return "Enter the recipient wallet.";
    if (!recipientIsValid) return "Recipient must be a valid Ethereum address.";
    if (!parsedAmount.ok) return parsedAmount.message;
    if (!hasEnoughUsdc) return "Amount exceeds your USDC balance.";
    return "";
  }, [hasEnoughUsdc, parsedAmount, recipient, recipientIsValid]);

  async function connectWallet() {
    const provider = window.ethereum;
    if (!provider) {
      setError("No injected wallet was found. Install a wallet such as MetaMask.");
      return;
    }

    setIsConnecting(true);
    setError("");
    try {
      await provider.request({ method: "eth_requestAccounts" });
      const state = await readWalletState(provider);
      setAddress(state.address);
      setChainId(state.chainId);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsConnecting(false);
    }
  }

  async function switchToMainnet() {
    const provider = window.ethereum;
    if (!provider) return;

    setIsSwitching(true);
    setError("");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${mainnet.id.toString(16)}` }],
      });
      setChainId(mainnet.id);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsSwitching(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !parsedAmount.ok || !recipientIsValid || !address) return;

    const provider = window.ethereum;
    if (!provider) return;

    setIsWriting(true);
    setIsConfirmed(false);
    setTxHash(undefined);
    setError("");

    try {
      const walletClient = createWalletClient({
        account: address,
        chain: mainnet,
        transport: custom(provider),
      });
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: usdcAbi,
        functionName: "transfer",
        args: [getAddress(recipient), parsedAmount.value],
      });

      setTxHash(hash);
      setIsWriting(false);
      setIsConfirming(true);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setIsConfirmed(receipt.status === "success");
      void refreshBalances();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsWriting(false);
      setIsConfirming(false);
    }
  }

  const txUrl = txHash ? `${mainnet.blockExplorers.default.url}/tx/${txHash}` : "";
  const addressUrl = address
    ? `${mainnet.blockExplorers.default.url}/address/${address}`
    : "";

  return (
    <main className="app-shell">
      <section className="pay-panel" aria-label="USDC payment">
        <header className="topbar">
          <div>
            <p className="eyebrow">Ethereum mainnet</p>
            <h1>USDC Pay</h1>
          </div>

          {isConnected ? (
            <div className="wallet-cluster">
              <a className="address-pill" href={addressUrl} target="_blank" rel="noreferrer">
                <Wallet aria-hidden="true" size={16} />
                <span>{truncateAddress(address)}</span>
                <ExternalLink aria-hidden="true" size={14} />
              </a>
              <button className="ghost-button" type="button" onClick={() => setAddress(undefined)}>
                Hide
              </button>
            </div>
          ) : (
            <button
              className="primary-button"
              type="button"
              disabled={!hasInjectedWallet || isConnecting}
              onClick={connectWallet}
            >
              {isConnecting ? <Loader2 className="spin" aria-hidden="true" size={18} /> : <Wallet aria-hidden="true" size={18} />}
              Connect wallet
            </button>
          )}
        </header>

        {!hasInjectedWallet ? (
          <Status tone="warning" icon={<AlertCircle size={18} />}>
            Open this page in a browser with an Ethereum wallet installed.
          </Status>
        ) : null}

        {error ? (
          <Status tone="error" icon={<AlertCircle size={18} />}>
            {error}
          </Status>
        ) : null}

        {isConnected && !onMainnet ? (
          <Status tone="warning" icon={<AlertCircle size={18} />}>
            <span>Your wallet is not on Ethereum mainnet.</span>
            <button
              className="inline-action"
              type="button"
              disabled={isSwitching}
              onClick={switchToMainnet}
            >
              {isSwitching ? "Switching..." : "Switch network"}
            </button>
          </Status>
        ) : null}

        <div className="balance-grid" aria-label="Wallet balances">
          <BalanceTile
            label="USDC balance"
            value={
              isBalanceLoading
                ? "Loading"
                : `${formatTokenAmount(usdcBalance, USDC_DECIMALS, 6)} ${USDC_SYMBOL}`
            }
            detail={USDC_ADDRESS}
          />
          <BalanceTile
            label="ETH for gas"
            value={
              isBalanceLoading
                ? "Loading"
                : `${ethBalance ? formatTokenAmount(ethBalance, 18, 5) : "0"} ETH`
            }
            detail="Required to confirm the transfer"
          />
        </div>

        <form className="transfer-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Recipient</span>
            <input
              inputMode="text"
              autoComplete="off"
              placeholder="0x..."
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Amount</span>
            <div className="amount-input">
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <strong>{USDC_SYMBOL}</strong>
            </div>
          </label>

          {validationMessage && (recipient || amount) ? (
            <p className="form-note" role="status">
              {validationMessage}
            </p>
          ) : null}

          <div className="actions">
            <button
              className="secondary-button"
              type="button"
              disabled={!isConnected}
              onClick={() => void refreshBalances()}
            >
              <RefreshCw aria-hidden="true" size={17} />
              Refresh
            </button>
            <button className="primary-button" type="submit" disabled={!canSubmit}>
              {isWriting || isConfirming ? (
                <Loader2 className="spin" aria-hidden="true" size={18} />
              ) : (
                <Send aria-hidden="true" size={18} />
              )}
              {isConfirming ? "Confirming" : isWriting ? "Sending" : "Send USDC"}
            </button>
          </div>
        </form>

        {txHash ? (
          <Status tone={isConfirmed ? "success" : "info"} icon={isConfirmed ? <CheckCircle2 size={18} /> : <Loader2 className="spin" size={18} />}>
            <span>{isConfirmed ? "Transfer confirmed." : "Transaction submitted."}</span>
            <a className="inline-link" href={txUrl} target="_blank" rel="noreferrer">
              View on Etherscan <ArrowRight aria-hidden="true" size={14} />
            </a>
          </Status>
        ) : null}

        <footer className="trust-strip">
          <span>
            <ShieldCheck aria-hidden="true" size={16} />
            Real mainnet USDC
          </span>
          <button
            className="contract-copy"
            type="button"
            onClick={() => navigator.clipboard.writeText(USDC_ADDRESS)}
          >
            <Copy aria-hidden="true" size={14} />
            {truncateAddress(USDC_ADDRESS)}
          </button>
          <span>
            <Lock aria-hidden="true" size={16} />
            6 decimals
          </span>
        </footer>
      </section>
    </main>
  );
}

function BalanceTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="balance-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Status({
  tone,
  icon,
  children,
}: {
  tone: "error" | "info" | "success" | "warning";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`status status-${tone}`}>
      {icon}
      <div>{children}</div>
    </div>
  );
}
