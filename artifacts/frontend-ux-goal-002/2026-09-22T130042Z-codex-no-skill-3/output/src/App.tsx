import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import {
  BaseError,
  ContractFunctionRevertedError,
  Hex,
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
} from "viem";
import { mainnet } from "viem/chains";
import {
  ETHEREUM_MAINNET_CHAIN_ID,
  USDC_ADDRESS,
  erc20Abi,
  formatEth,
  formatUsdc,
  parseUsdcAmount,
  shortenAddress,
  validateRecipient,
} from "./lib/usdc";
import { Eip1193Provider, WalletOption, discoverInjectedWallets } from "./lib/wallet";

type BannerTone = "neutral" | "success" | "error" | "warning";
type LoadableBalance = {
  value?: bigint;
  loading: boolean;
};

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(import.meta.env.VITE_ETHEREUM_RPC_URL),
});

export function App() {
  useEffect(() => {
    if (window.location.pathname !== "/pay") {
      window.history.replaceState(null, "", "/pay");
    }
  }, []);

  return <PayPage />;
}

function PayPage() {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [provider, setProvider] = useState<Eip1193Provider>();
  const [address, setAddress] = useState<`0x${string}`>();
  const [chainId, setChainId] = useState<number>();
  const [connectError, setConnectError] = useState<string>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [ethBalance, setEthBalance] = useState<LoadableBalance>({ loading: false });
  const [usdcBalance, setUsdcBalance] = useState<LoadableBalance>({ loading: false });
  const [usdcSymbol, setUsdcSymbol] = useState("USDC");
  const [transferHash, setTransferHash] = useState<Hex>();
  const [transactionError, setTransactionError] = useState<string>();
  const [isConfirmingWallet, setIsConfirmingWallet] = useState(false);
  const [isMining, setIsMining] = useState(false);
  const isConnected = Boolean(address && provider);
  const isMainnet = chainId === ETHEREUM_MAINNET_CHAIN_ID;

  const parsedAmount = useMemo(() => parseUsdcAmount(amount), [amount]);
  const recipientValidation = useMemo(() => validateRecipient(recipient), [recipient]);
  const transferAmount = parsedAmount.valid ? parsedAmount.amount : undefined;
  const hasEnoughUsdc =
    transferAmount !== undefined && usdcBalance.value !== undefined
      ? usdcBalance.value >= transferAmount
      : true;
  const hasGas = ethBalance.value !== 0n;
  const balancesReady =
    ethBalance.value !== undefined &&
    usdcBalance.value !== undefined &&
    !ethBalance.loading &&
    !usdcBalance.loading;

  useEffect(() => discoverInjectedWallets(setWallets), []);

  useEffect(() => {
    if (!provider) {
      return;
    }

    const handleAccountsChanged = (accounts: unknown) => {
      const [nextAddress] = Array.isArray(accounts) ? accounts : [];
      setAddress(typeof nextAddress === "string" ? getAddress(nextAddress) : undefined);
    };

    const handleChainChanged = (nextChainId: unknown) => {
      if (typeof nextChainId === "string") {
        setChainId(Number.parseInt(nextChainId, 16));
      }
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [provider]);

  useEffect(() => {
    void loadUsdcSymbol();
  }, []);

  useEffect(() => {
    if (!address) {
      setEthBalance({ loading: false });
      setUsdcBalance({ loading: false });
      return;
    }

    void refreshBalances(address);
    const interval = window.setInterval(() => void refreshBalances(address), 30_000);

    return () => window.clearInterval(interval);
  }, [address]);

  const formError = getFormError({
    connected: isConnected,
    isMainnet,
    recipientValid: recipientValidation.valid,
    recipientMessage: recipientValidation.valid ? undefined : recipientValidation.message,
    amountValid: parsedAmount.valid,
    amountMessage: parsedAmount.valid ? undefined : parsedAmount.message,
    hasEnoughUsdc,
    hasGas,
  });

  const canSend =
    isConnected &&
    isMainnet &&
    recipientValidation.valid &&
    parsedAmount.valid &&
    hasEnoughUsdc &&
    hasGas &&
    balancesReady &&
    !isConfirmingWallet &&
    !isMining;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend || !parsedAmount.valid || !recipientValidation.valid || !provider || !address) {
      return;
    }

    setTransactionError(undefined);
    setTransferHash(undefined);
    setIsConfirmingWallet(true);
    setIsMining(false);

    try {
      const account = getAddress(address);
      const walletClient = createWalletClient({
        account,
        chain: mainnet,
        transport: custom(provider),
      });
      const { request } = await publicClient.simulateContract({
        account,
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [getAddress(recipient), parsedAmount.amount],
      });
      const hash = await walletClient.writeContract(request);

      setTransferHash(hash);
      setIsConfirmingWallet(false);
      setIsMining(true);

      await publicClient.waitForTransactionReceipt({ hash });
      setIsMining(false);
      setAmount("");
      setRecipient("");
      await refreshBalances(account);
    } catch (error) {
      setTransactionError(formatTransactionError(error));
      setIsConfirmingWallet(false);
      setIsMining(false);
    }
  }

  async function connectWallet(wallet: WalletOption) {
    setConnectError(undefined);
    setIsConnecting(true);

    try {
      const accounts = await wallet.provider.request<string[]>({ method: "eth_requestAccounts" });
      const selectedAddress = accounts[0];

      if (!selectedAddress) {
        throw new Error("No wallet account was returned.");
      }

      const activeChainId = await wallet.provider.request<string>({ method: "eth_chainId" });

      setProvider(wallet.provider);
      setAddress(getAddress(selectedAddress));
      setChainId(Number.parseInt(activeChainId, 16));
    } catch (error) {
      setConnectError(formatTransactionError(error));
    } finally {
      setIsConnecting(false);
    }
  }

  function disconnectWallet() {
    setProvider(undefined);
    setAddress(undefined);
    setChainId(undefined);
    setTransferHash(undefined);
    setTransactionError(undefined);
  }

  async function switchToMainnet() {
    if (!provider) {
      return;
    }

    setIsSwitching(true);
    setTransactionError(undefined);

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      });
      setChainId(ETHEREUM_MAINNET_CHAIN_ID);
    } catch (error) {
      setTransactionError(formatTransactionError(error));
    } finally {
      setIsSwitching(false);
    }
  }

  async function loadUsdcSymbol() {
    try {
      const symbol = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "symbol",
      });

      setUsdcSymbol(symbol);
    } catch {
      setUsdcSymbol("USDC");
    }
  }

  async function refreshBalances(walletAddress = address) {
    if (!walletAddress) {
      return;
    }

    setEthBalance((current) => ({ ...current, loading: true }));
    setUsdcBalance((current) => ({ ...current, loading: true }));

    try {
      const [nextEthBalance, nextUsdcBalance] = await Promise.all([
        publicClient.getBalance({ address: walletAddress }),
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [walletAddress],
        }),
      ]);

      setEthBalance({ value: nextEthBalance, loading: false });
      setUsdcBalance({ value: nextUsdcBalance, loading: false });
    } catch (error) {
      setEthBalance((current) => ({ ...current, loading: false }));
      setUsdcBalance((current) => ({ ...current, loading: false }));
      setTransactionError(formatTransactionError(error));
    }
  }

  async function handleCopyAddress() {
    if (!address) {
      return;
    }

    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <main className="app-shell">
      <section className="pay-layout" aria-labelledby="pay-title">
        <div className="pay-header">
          <div>
            <p className="eyebrow">Ethereum mainnet</p>
            <h1 id="pay-title">USDC Pay</h1>
          </div>

          {isConnected && address ? (
            <div className="account-cluster">
              <button className="ghost-button compact" type="button" onClick={handleCopyAddress}>
                <Copy size={16} aria-hidden="true" />
                <span>{copied ? "Copied" : shortenAddress(address)}</span>
              </button>
              <button className="icon-button" type="button" onClick={disconnectWallet} title="Disconnect wallet">
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <div className="content-grid">
          <aside className="balance-panel" aria-label="Wallet balances">
            <div className="balance-row">
              <span>{usdcSymbol} balance</span>
              <strong>{usdcBalance.loading ? "..." : formatUsdc(usdcBalance.value)} USDC</strong>
            </div>
            <div className="balance-row">
              <span>ETH for gas</span>
              <strong>{ethBalance.loading ? "..." : formatEth(ethBalance.value)} ETH</strong>
            </div>
            <div className="token-address">
              <span>Token</span>
              <a href={`https://etherscan.io/token/${USDC_ADDRESS}`} target="_blank" rel="noreferrer">
                {shortenAddress(USDC_ADDRESS)}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
            <button
              className="ghost-button full"
              type="button"
              disabled={!isConnected || ethBalance.loading || usdcBalance.loading}
              onClick={() => void refreshBalances()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </aside>

          <section className="payment-panel" aria-label="Send USDC">
            {!isConnected ? (
              <div className="connect-section">
                <div className="status-icon">
                  <Wallet size={22} aria-hidden="true" />
                </div>
                <h2>Connect wallet</h2>
                <div className="connector-list">
                  {wallets.length ? (
                    wallets.map((wallet) => (
                      <button
                        key={wallet.id}
                        className="primary-button"
                        type="button"
                        disabled={isConnecting}
                        onClick={() => void connectWallet(wallet)}
                      >
                        {isConnecting ? (
                          <Loader2 className="spin" size={18} aria-hidden="true" />
                        ) : (
                          <Wallet size={18} aria-hidden="true" />
                        )}
                        <span>{wallet.name}</span>
                      </button>
                    ))
                  ) : (
                    <Banner tone="warning" message="No injected wallet was detected." />
                  )}
                </div>
                {connectError ? <Banner tone="error" message={connectError} /> : null}
              </div>
            ) : (
              <form className="payment-form" onSubmit={handleSubmit}>
                {!isMainnet ? (
                  <Banner
                    tone="warning"
                    message="Switch to Ethereum mainnet before sending USDC."
                    action={
                      <button
                        className="inline-action"
                        type="button"
                        disabled={isSwitching}
                        onClick={() => void switchToMainnet()}
                      >
                        {isSwitching ? "Switching" : "Switch"}
                      </button>
                    }
                  />
                ) : (
                  <Banner tone="neutral" message="This sends real USDC on Ethereum mainnet." />
                )}

                <label className="field">
                  <span>Recipient</span>
                  <input
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="0x..."
                    spellCheck={false}
                    autoComplete="off"
                    inputMode="text"
                  />
                </label>

                <label className="field">
                  <span>Amount</span>
                  <div className="amount-input">
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      autoComplete="off"
                    />
                    <span>USDC</span>
                  </div>
                </label>

                {formError ? <Banner tone="error" message={formError} /> : null}
                {transactionError ? <Banner tone="error" message={transactionError} /> : null}
                {transferHash ? (
                  <Banner
                    tone={!isMining ? "success" : "neutral"}
                    message={!isMining ? "Transfer confirmed." : "Transaction submitted."}
                    action={
                      <a className="inline-link" href={`https://etherscan.io/tx/${transferHash}`} target="_blank" rel="noreferrer">
                        View
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    }
                  />
                ) : null}

                <button className="send-button" type="submit" disabled={!canSend}>
                  {isConfirmingWallet || isMining ? (
                    <Loader2 className="spin" size={18} aria-hidden="true" />
                  ) : (
                    <Send size={18} aria-hidden="true" />
                  )}
                  <span>{isMining ? "Confirming" : isConfirmingWallet ? "Approve in wallet" : "Send USDC"}</span>
                </button>
              </form>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function Banner({
  tone,
  message,
  action,
}: {
  tone: BannerTone;
  message: string;
  action?: ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className={`banner ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <span>{message}</span>
      {action}
    </div>
  );
}

function getFormError({
  connected,
  isMainnet,
  recipientValid,
  recipientMessage,
  amountValid,
  amountMessage,
  hasEnoughUsdc,
  hasGas,
}: {
  connected: boolean;
  isMainnet: boolean;
  recipientValid: boolean;
  recipientMessage?: string;
  amountValid: boolean;
  amountMessage?: string;
  hasEnoughUsdc: boolean;
  hasGas: boolean;
}) {
  if (!connected || !isMainnet) {
    return undefined;
  }

  if (!recipientValid && recipientMessage) {
    return recipientMessage;
  }

  if (!amountValid && amountMessage) {
    return amountMessage;
  }

  if (!hasEnoughUsdc) {
    return "Insufficient USDC balance.";
  }

  if (!hasGas) {
    return "Add ETH for gas before sending.";
  }

  return undefined;
}

function formatTransactionError(error: unknown) {
  if (!error) {
    return undefined;
  }

  if (typeof error === "object" && "code" in error && error.code === 4001) {
    return "Request rejected in wallet.";
  }

  if (error instanceof BaseError) {
    const revert = error.walk((cause) => cause instanceof ContractFunctionRevertedError);

    if (revert instanceof ContractFunctionRevertedError) {
      return revert.reason ?? "USDC transfer reverted.";
    }

    return error.shortMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
