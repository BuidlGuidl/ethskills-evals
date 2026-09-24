import {
  AlertCircle,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Copy,
  ExternalLink,
  Fuel,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wallet,
  WalletCards,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { mainnet } from "wagmi/chains";
import { formatUnits, isAddress, parseUnits } from "viem";
import type { Address } from "viem";
import { USDC_ADDRESS, USDC_DECIMALS, usdcAbi } from "./usdc";

const ETHERSCAN_TX_URL = "https://etherscan.io/tx/";
const ETHERSCAN_ADDRESS_URL = "https://etherscan.io/address/";

function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDisplay(value?: bigint, decimals = 18, fractionDigits = 4) {
  if (value === undefined) return "0";
  const raw = formatUnits(value, decimals);
  const [whole, fraction = ""] = raw.split(".");
  const trimmedFraction = fraction.slice(0, fractionDigits).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function validateAmount(amount: string, balance?: bigint) {
  if (!amount.trim()) return "Enter an amount.";
  if (!/^\d+(\.\d{1,6})?$/.test(amount.trim())) {
    return "Use up to 6 decimal places for USDC.";
  }

  const parsed = parseUnits(amount.trim(), USDC_DECIMALS);
  if (parsed <= 0n) return "Amount must be greater than zero.";
  if (balance !== undefined && parsed > balance) return "Amount exceeds your USDC balance.";
  return "";
}

function AppShell() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const onMainnet = chainId === mainnet.id;

  const ethBalance = useBalance({
    address,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address),
      refetchInterval: 15_000,
    },
  });

  const usdcBalance = useReadContract({
    abi: usdcAbi,
    address: USDC_ADDRESS,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: mainnet.id,
    query: {
      enabled: Boolean(address),
      refetchInterval: 15_000,
    },
  });

  const {
    writeContract,
    data: txHash,
    error: writeError,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: mainnet.id,
  });

  const recipientError = recipient && !isAddress(recipient) ? "Enter a valid Ethereum address." : "";
  const amountError = useMemo(
    () => validateAmount(amount, usdcBalance.data),
    [amount, usdcBalance.data],
  );
  const balancesReady = usdcBalance.data !== undefined && ethBalance.data?.value !== undefined;
  const hasGas = ethBalance.data?.value === undefined || ethBalance.data.value > 0n;
  const networkReady = isConnected && onMainnet && hasGas;
  const canSubmit =
    isConnected &&
    onMainnet &&
    balancesReady &&
    hasGas &&
    isAddress(recipient) &&
    !amountError &&
    !isWritePending &&
    !receipt.isLoading;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    writeContract({
      abi: usdcAbi,
      address: USDC_ADDRESS,
      functionName: "transfer",
      args: [recipient as Address, parseUnits(amount.trim(), USDC_DECIMALS)],
      chainId: mainnet.id,
    });
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const visibleConnectors = connectors.filter((connector, index, all) => {
    return all.findIndex((item) => item.name === connector.name) === index;
  });

  return (
    <main className="app-shell">
      <section className="pay-surface" aria-labelledby="page-title">
        <div className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <BadgeDollarSign size={28} strokeWidth={2.2} />
            </div>
            <div>
              <p className="eyebrow">Ethereum mainnet</p>
              <h1 id="page-title">USDC Pay</h1>
            </div>
          </div>

          {isConnected ? (
            <div className="account-chip" aria-label="Connected account">
              <button className="icon-button" type="button" onClick={copyAddress} title="Copy address">
                <Copy size={16} />
              </button>
              <span>{shortAddress(address)}</span>
              <button
                className="icon-button danger"
                type="button"
                onClick={() => disconnect()}
                title="Disconnect wallet"
              >
                <LogOut size={16} />
              </button>
              <span className="copied-state" aria-live="polite">
                {copied ? "Copied" : ""}
              </span>
            </div>
          ) : null}
        </div>

        <div className="content-grid">
          <aside className="status-panel" aria-label="Wallet status">
            <div className="token-plate">
              <div className="usdc-orbit" aria-hidden="true">
                <span>$</span>
              </div>
              <div>
                <p className="token-label">Real USDC contract</p>
                <a href={`${ETHERSCAN_ADDRESS_URL}${USDC_ADDRESS}`} target="_blank" rel="noreferrer">
                  {shortAddress(USDC_ADDRESS)}
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            <div className="balance-grid">
              <div className="metric">
                <div className="metric-icon">
                  <WalletCards size={18} />
                </div>
                <div>
                  <p>USDC balance</p>
                  <strong>
                    {usdcBalance.isLoading ? "Loading" : formatDisplay(usdcBalance.data, USDC_DECIMALS, 2)}
                  </strong>
                </div>
              </div>
              <div className="metric">
                <div className="metric-icon">
                  <Fuel size={18} />
                </div>
                <div>
                  <p>ETH for gas</p>
                  <strong>{ethBalance.isLoading ? "Loading" : formatDisplay(ethBalance.data?.value, 18, 5)}</strong>
                </div>
              </div>
            </div>

            <div className={`network-state ${networkReady ? "ok" : "warn"}`}>
              {networkReady ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
              <span>
                {!isConnected
                  ? "Connect wallet to check network"
                  : onMainnet
                    ? hasGas
                      ? "Ready on Ethereum mainnet"
                      : "Add ETH for gas"
                    : "Switch to Ethereum mainnet"}
              </span>
            </div>

            {isConnected && !onMainnet ? (
              <button
                className="button primary full"
                type="button"
                onClick={() => switchChain({ chainId: mainnet.id })}
                disabled={isSwitching}
              >
                {isSwitching ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
                Switch network
              </button>
            ) : null}
          </aside>

          <section className="payment-panel" aria-label="Send USDC">
            {!isConnected ? (
              <div className="connect-stack">
                <div className="connect-copy">
                  <Wallet size={28} />
                  <h2>Connect your wallet</h2>
                  <p>Choose a browser wallet to view balances and send mainnet USDC.</p>
                </div>
                <div className="connector-list">
                  {visibleConnectors.map((connector) => (
                    <button
                      className="button secondary"
                      key={connector.uid}
                      type="button"
                      disabled={isConnecting}
                      onClick={() => connect({ connector })}
                    >
                      {isConnecting ? <Loader2 className="spin" size={18} /> : <Wallet size={18} />}
                      {connector.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <form className="pay-form" onSubmit={handleSubmit}>
                <div className="form-heading">
                  <h2>Send USDC</h2>
                  <p>Transfers settle from your wallet on Ethereum mainnet.</p>
                </div>

                <label className="field">
                  <span>Recipient</span>
                  <input
                    value={recipient}
                    onChange={(event) => {
                      setRecipient(event.target.value.trim());
                      resetWrite();
                    }}
                    placeholder="0x..."
                    spellCheck={false}
                    autoComplete="off"
                    inputMode="text"
                  />
                  <small>{recipientError}</small>
                </label>

                <label className="field">
                  <span>Amount</span>
                  <div className="amount-row">
                    <input
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value);
                        resetWrite();
                      }}
                      placeholder="0.00"
                      inputMode="decimal"
                      autoComplete="off"
                    />
                    <button
                      className="max-button"
                      type="button"
                      onClick={() => setAmount(formatUnits(usdcBalance.data ?? 0n, USDC_DECIMALS))}
                    >
                      Max
                    </button>
                  </div>
                  <small>{amount ? amountError : ""}</small>
                </label>

                <button className="button primary submit" type="submit" disabled={!canSubmit}>
                  {isWritePending || receipt.isLoading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
                  {receipt.isLoading ? "Confirming" : "Send USDC"}
                </button>

                <div className="transaction-state" aria-live="polite">
                  {writeError ? (
                    <p className="error">
                      <AlertCircle size={16} />
                      {writeError.message}
                    </p>
                  ) : null}
                  {txHash ? (
                    <a href={`${ETHERSCAN_TX_URL}${txHash}`} target="_blank" rel="noreferrer">
                      View transaction
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                  {receipt.isSuccess ? (
                    <p className="success">
                      <CheckCircle2 size={16} />
                      USDC transfer confirmed.
                    </p>
                  ) : null}
                </div>
              </form>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

export function App() {
  useEffect(() => {
    if (window.location.pathname !== "/pay") {
      window.history.replaceState(null, "", "/pay");
    }
  }, []);

  return <AppShell />;
}
