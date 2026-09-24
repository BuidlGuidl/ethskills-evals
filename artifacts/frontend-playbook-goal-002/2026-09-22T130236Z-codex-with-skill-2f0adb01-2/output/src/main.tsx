import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { CheckCircle2, Coins, ExternalLink, RefreshCw, Send, Wallet } from "lucide-react";
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits } from "ethers";
import deployment from "./deployments/localhost.json";
import { LOCAL_CHAIN_HEX, LOCAL_CHAIN_ID, LOCAL_RPC_URL, TIP_JAR_ABI, USDC_ABI } from "./lib/contracts";
import "./styles.css";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type Tip = {
  id: number;
  from: string;
  amount: bigint;
  message: string;
  timestamp: bigint;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const readProvider = new JsonRpcProvider(LOCAL_RPC_URL);
const formatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [amount, setAmount] = useState("5");
  const [message, setMessage] = useState("Thanks for building on Base.");
  const [balance, setBalance] = useState<bigint>(0n);
  const [recipient, setRecipient] = useState(deployment.recipient);
  const [tips, setTips] = useState<Tip[]>([]);
  const [status, setStatus] = useState("Start the local chain and deploy script to load the jar.");
  const [isBusy, setIsBusy] = useState(false);

  const hasDeployment = deployment.tipJar.length > 0;
  const isConnected = account.length > 0;
  const isLocalChain = chainId === LOCAL_CHAIN_ID;

  const shortAccount = useMemo(() => shorten(account), [account]);

  const loadFeed = useCallback(async () => {
    if (!hasDeployment) return;

    const tipJar = new Contract(deployment.tipJar, TIP_JAR_ABI, readProvider);
    const count = await tipJar.getTipCount();
    const allTips = await tipJar.getTips(0, count);
    const normalizedTips = allTips.map((tip: Tip, index: number) => ({ ...tip, id: index })).reverse();
    const currentRecipient = await tipJar.recipient();

    setTips(normalizedTips);
    setRecipient(currentRecipient);
  }, [hasDeployment]);

  const loadWalletState = useCallback(async () => {
    if (!window.ethereum) return;

    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_accounts", []);
    const network = await provider.getNetwork();

    setAccount(accounts[0] ?? "");
    setChainId(network.chainId);

    if (accounts[0] && hasDeployment) {
      const usdc = new Contract(deployment.usdc, USDC_ABI, provider);
      setBalance(await usdc.balanceOf(accounts[0]));
    }
  }, [hasDeployment]);

  useEffect(() => {
    void loadFeed().catch(() => setStatus("Waiting for the local Hardhat node and deployment."));
    void loadWalletState().catch(() => undefined);
  }, [loadFeed, loadWalletState]);

  useEffect(() => {
    if (!window.ethereum?.on) return;

    const handleAccounts = () => void loadWalletState();
    const handleChain = () => void loadWalletState();

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccounts);
      window.ethereum?.removeListener?.("chainChanged", handleChain);
    };
  }, [loadWalletState]);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Install a browser wallet with an injected provider, then refresh.");
      return;
    }

    const provider = new BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    setAccount(accounts[0] ?? "");
    setChainId(network.chainId);
    setStatus(accounts[0] ? "Wallet connected." : "No wallet account selected.");
  }

  async function switchToLocal() {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: LOCAL_CHAIN_HEX }]
      });
    } catch {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: LOCAL_CHAIN_HEX,
            chainName: "Hardhat Local",
            nativeCurrency: { name: "Local ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [LOCAL_RPC_URL]
          }
        ]
      });
    }

    await loadWalletState();
  }

  async function mintTestUsdc() {
    await runWalletAction(async (provider, connectedAccount) => {
      const signer = await provider.getSigner();
      const usdc = new Contract(deployment.usdc, USDC_ABI, signer);
      const tx = await usdc.mint(connectedAccount, parseUnits("1000", 6));
      setStatus("Minting 1,000 local USDC...");
      await tx.wait();
      setStatus("Minted 1,000 local USDC.");
    });
  }

  async function submitTip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runWalletAction(async (provider, connectedAccount) => {
      const parsedAmount = parseUnits(amount || "0", 6);
      const signer = await provider.getSigner();
      const usdc = new Contract(deployment.usdc, USDC_ABI, signer);
      const tipJar = new Contract(deployment.tipJar, TIP_JAR_ABI, signer);
      const currentAllowance = await usdc.allowance(connectedAccount, deployment.tipJar);

      if (currentAllowance < parsedAmount) {
        const approveTx = await usdc.approve(deployment.tipJar, parsedAmount);
        setStatus("Approving USDC...");
        await approveTx.wait();
      }

      const tipTx = await tipJar.tip(parsedAmount, message.trim());
      setStatus("Sending tip...");
      await tipTx.wait();
      setMessage("");
      setStatus("Tip sent. The feed is fresh.");
    });
  }

  async function runWalletAction(action: (provider: BrowserProvider, connectedAccount: string) => Promise<void>) {
    if (!hasDeployment) {
      setStatus("Run npm run deploy:local before using the jar.");
      return;
    }

    if (!window.ethereum) {
      setStatus("Install or enable a browser wallet first.");
      return;
    }

    setIsBusy(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const connectedAccount = accounts[0];
      const network = await provider.getNetwork();

      setAccount(connectedAccount);
      setChainId(network.chainId);

      if (network.chainId !== LOCAL_CHAIN_ID) {
        setStatus("Switch to the local Hardhat chain before sending transactions.");
        return;
      }

      await action(provider, connectedAccount);
      const usdc = new Contract(deployment.usdc, USDC_ABI, provider);
      setBalance(await usdc.balanceOf(connectedAccount));
      await loadFeed();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="topbar" aria-label="Wallet controls">
        <div className="brand">
          <span className="brandMark">
            <Coins size={22} />
          </span>
          <div>
            <h1>Base USDC Tip Jar</h1>
            <p>{hasDeployment ? `Jar ${shorten(deployment.tipJar)}` : "Local deployment needed"}</p>
          </div>
        </div>
        <div className="walletCluster">
          {isConnected && (
            <span className={`networkPill ${isLocalChain ? "ok" : "warn"}`}>
              {isLocalChain ? "Hardhat Local" : "Wrong network"}
            </span>
          )}
          {isConnected && !isLocalChain && (
            <button className="secondaryButton" type="button" onClick={switchToLocal}>
              Switch
            </button>
          )}
          <button className="primaryButton" type="button" onClick={connectWallet}>
            <Wallet size={18} />
            {isConnected ? shortAccount : "Connect"}
          </button>
        </div>
      </section>

      <section className="dashboard">
        <div className="composerPanel">
          <div className="panelHeader">
            <div>
              <h2>Send a tip</h2>
              <p>Tips move local mock USDC at the real Base USDC address.</p>
            </div>
            <button className="iconButton" type="button" aria-label="Refresh feed" onClick={() => void loadFeed()}>
              <RefreshCw size={18} />
            </button>
          </div>

          <form onSubmit={(event) => void submitTip(event)} className="tipForm">
            <label>
              Amount
              <div className="amountInput">
                <input
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="5.00"
                />
                <span>USDC</span>
              </div>
            </label>

            <label>
              Message
              <textarea
                maxLength={280}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Leave a short note"
              />
            </label>

            <div className="actions">
              <button className="secondaryButton" type="button" onClick={() => void mintTestUsdc()} disabled={isBusy}>
                <Coins size={18} />
                Mint test USDC
              </button>
              <button className="primaryButton" type="submit" disabled={isBusy || !hasDeployment}>
                <Send size={18} />
                Tip
              </button>
            </div>
          </form>

          <div className="statsGrid">
            <div>
              <span>Your balance</span>
              <strong>{formatUsdc(balance)}</strong>
            </div>
            <div>
              <span>Recipient</span>
              <strong>{recipient ? shorten(recipient) : "Not set"}</strong>
            </div>
            <div>
              <span>Total tips</span>
              <strong>{tips.length}</strong>
            </div>
          </div>

          <p className="statusLine">
            <CheckCircle2 size={16} />
            {status}
          </p>
        </div>

        <div className="feedPanel">
          <div className="panelHeader">
            <div>
              <h2>Tip feed</h2>
              <p>Newest onchain tips from this local jar.</p>
            </div>
            <a
              className="contractLink"
              href={`https://basescan.org/address/${deployment.usdc}`}
              target="_blank"
              rel="noreferrer"
            >
              USDC
              <ExternalLink size={15} />
            </a>
          </div>

          <div className="feedList">
            {!hasDeployment && <EmptyState text="Run the local deploy script to create a jar." />}
            {hasDeployment && tips.length === 0 && <EmptyState text="No tips yet. Send the first one." />}
            {tips.map((tip) => (
              <article className="tipItem" key={`${tip.id}-${tip.from}-${tip.timestamp}`}>
                <div className="tipMeta">
                  <strong>{formatUsdc(tip.amount)}</strong>
                  <span>{formatTimestamp(tip.timestamp)}</span>
                </div>
                <p>{tip.message || "No message"}</p>
                <span className="addressLine">From {shorten(tip.from)}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}

function shorten(value: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatUsdc(value: bigint) {
  return `${formatUnits(value, 6)} USDC`;
}

function formatTimestamp(value: bigint) {
  if (value === 0n) return "Pending";
  return formatter.format(new Date(Number(value) * 1000));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
