import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { CircleDollarSign, Loader2, PlugZap, RefreshCw, Send, Wallet } from "lucide-react";
import tipJarConfig from "./contracts/tipJar.json";

const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const USDC_DECIMALS = 6;
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)"
];

function compactAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsdc(value) {
  const formatted = ethers.formatUnits(value ?? 0n, USDC_DECIMALS);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmedFraction = fraction.slice(0, 2).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(Number(timestamp) * 1000));
}

function normalizeTip(tip, index) {
  return {
    id: index,
    sender: tip.sender,
    amount: tip.amount,
    message: tip.message,
    timestamp: tip.timestamp
  };
}

export default function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [tips, setTips] = useState([]);
  const [totalTips, setTotalTips] = useState(0n);
  const [totalAmount, setTotalAmount] = useState(0n);
  const [beneficiary, setBeneficiary] = useState("");
  const [usdcBalance, setUsdcBalance] = useState(null);
  const [amount, setAmount] = useState("5");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const readProvider = useMemo(() => new ethers.JsonRpcProvider(LOCAL_RPC_URL), []);
  const isDeployed = tipJarConfig.address !== ethers.ZeroAddress && tipJarConfig.abi.length > 0;
  const isConnectedToLocal = chainId === tipJarConfig.chainId;
  const canTip = isDeployed && account && isConnectedToLocal && !submitting;

  const loadTipJar = useCallback(async () => {
    if (!isDeployed) {
      setLoading(false);
      setError("Run the local deploy script to create frontend/src/contracts/tipJar.json.");
      return;
    }

    try {
      const tipJar = new ethers.Contract(tipJarConfig.address, tipJarConfig.abi, readProvider);
      const [recentTips, tipCount, amountTotal, currentBeneficiary] = await Promise.all([
        tipJar.getRecentTips(25),
        tipJar.totalTips(),
        tipJar.totalAmount(),
        tipJar.beneficiary()
      ]);

      setTips(recentTips.map((tip, index) => normalizeTip(tip, Number(tipCount) - index - 1)));
      setTotalTips(tipCount);
      setTotalAmount(amountTotal);
      setBeneficiary(currentBeneficiary);
      setError("");
    } catch (caught) {
      setError(caught.shortMessage || caught.message || "Could not read the local tip jar.");
    } finally {
      setLoading(false);
    }
  }, [isDeployed, readProvider]);

  const loadWalletBalance = useCallback(async (walletAddress) => {
    if (!walletAddress || !isDeployed) return;

    try {
      const usdc = new ethers.Contract(tipJarConfig.usdc, USDC_ABI, readProvider);
      setUsdcBalance(await usdc.balanceOf(walletAddress));
    } catch {
      setUsdcBalance(null);
    }
  }, [isDeployed, readProvider]);

  const refreshWallet = useCallback(async () => {
    if (!window.ethereum) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const accounts = await provider.send("eth_accounts", []);
    setChainId(Number(network.chainId));
    setAccount(accounts[0] || "");
    if (accounts[0]) await loadWalletBalance(accounts[0]);
  }, [loadWalletBalance]);

  const requestLocalChain = async () => {
    if (!window.ethereum) {
      setError("No injected wallet was found.");
      return;
    }

    const hexChainId = `0x${tipJarConfig.chainId.toString(16)}`;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }]
      });
    } catch (caught) {
      if (caught.code !== 4902) throw caught;

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexChainId,
          chainName: "Hardhat Localhost",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [LOCAL_RPC_URL]
        }]
      });
    }
  };

  const connectWallet = async () => {
    setError("");
    setStatus("");

    if (!window.ethereum) {
      setError("Install or open a browser wallet to connect.");
      return;
    }

    try {
      await requestLocalChain();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setAccount(accounts[0] || "");
      setChainId(Number(network.chainId));
      if (accounts[0]) await loadWalletBalance(accounts[0]);
    } catch (caught) {
      setError(caught.shortMessage || caught.message || "Wallet connection failed.");
    }
  };

  const sendTip = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!canTip) return;

    try {
      setSubmitting(true);
      const parsedAmount = ethers.parseUnits(amount || "0", USDC_DECIMALS);
      if (parsedAmount <= 0n) {
        setError("Enter a positive USDC amount.");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(tipJarConfig.usdc, USDC_ABI, signer);
      const tipJar = new ethers.Contract(tipJarConfig.address, tipJarConfig.abi, signer);

      const allowance = await usdc.allowance(account, tipJarConfig.address);
      if (allowance < parsedAmount) {
        setStatus("Approving USDC...");
        await (await usdc.approve(tipJarConfig.address, parsedAmount)).wait();
      }

      setStatus("Sending tip...");
      await (await tipJar.tip(parsedAmount, message.trim())).wait();

      setAmount("5");
      setMessage("");
      setStatus("Tip sent.");
      await Promise.all([loadTipJar(), loadWalletBalance(account)]);
    } catch (caught) {
      setError(caught.shortMessage || caught.reason || caught.message || "Tip transaction failed.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadTipJar();
    const interval = window.setInterval(loadTipJar, 12_000);
    return () => window.clearInterval(interval);
  }, [loadTipJar]);

  useEffect(() => {
    refreshWallet();

    if (!window.ethereum) return undefined;
    const handleAccounts = () => refreshWallet();
    const handleChain = () => refreshWallet();
    window.ethereum.on?.("accountsChanged", handleAccounts);
    window.ethereum.on?.("chainChanged", handleChain);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccounts);
      window.ethereum.removeListener?.("chainChanged", handleChain);
    };
  }, [refreshWallet]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <CircleDollarSign aria-hidden="true" />
          <div>
            <h1>Base USDC Tip Jar</h1>
            <p>Local contract target: {compactAddress(tipJarConfig.address)}</p>
          </div>
        </div>

        <div className="wallet-cluster">
          {account ? (
            <div className="wallet-pill">
              <Wallet size={18} aria-hidden="true" />
              <span>{compactAddress(account)}</span>
            </div>
          ) : null}
          <button className="primary-button" type="button" onClick={connectWallet}>
            <PlugZap size={18} aria-hidden="true" />
            <span>{account ? "Reconnect" : "Connect"}</span>
          </button>
        </div>
      </header>

      <section className="status-strip" aria-live="polite">
        <div>
          <span className="label">Network</span>
          <strong>{chainId ? (isConnectedToLocal ? "Hardhat localhost" : `Chain ${chainId}`) : "Not connected"}</strong>
        </div>
        <div>
          <span className="label">USDC Balance</span>
          <strong>{usdcBalance === null ? "--" : `${formatUsdc(usdcBalance)} USDC`}</strong>
        </div>
        <div>
          <span className="label">Total Tipped</span>
          <strong>{formatUsdc(totalAmount)} USDC</strong>
        </div>
        <div>
          <span className="label">Tips</span>
          <strong>{totalTips.toString()}</strong>
        </div>
      </section>

      <div className="workspace">
        <section className="tip-panel" aria-labelledby="tip-form-title">
          <div className="section-heading">
            <h2 id="tip-form-title">Send a tip</h2>
            <button className="icon-button" type="button" onClick={loadTipJar} aria-label="Refresh tip feed">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={sendTip}>
            <label htmlFor="amount">Amount</label>
            <div className="amount-input">
              <input
                id="amount"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <span>USDC</span>
            </div>

            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              maxLength={280}
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Thanks for building on Base."
            />
            <div className="form-footer">
              <span>{message.length}/280</span>
              <button className="primary-button" type="submit" disabled={!canTip}>
                {submitting ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                <span>{submitting ? "Working" : "Tip"}</span>
              </button>
            </div>
          </form>

          <div className="contract-facts">
            <div>
              <span className="label">USDC</span>
              <strong>{compactAddress(tipJarConfig.usdc)}</strong>
            </div>
            <div>
              <span className="label">Beneficiary</span>
              <strong>{compactAddress(beneficiary)}</strong>
            </div>
          </div>
        </section>

        <section className="feed-panel" aria-labelledby="tip-feed-title">
          <div className="section-heading">
            <h2 id="tip-feed-title">Tip feed</h2>
            <span className="live-dot">Local</span>
          </div>

          {error ? <p className="notice error">{error}</p> : null}
          {status ? <p className="notice">{status}</p> : null}

          {loading ? (
            <div className="empty-state">
              <Loader2 className="spin" size={24} aria-hidden="true" />
              <span>Loading tips</span>
            </div>
          ) : tips.length === 0 ? (
            <div className="empty-state">
              <span>No tips yet</span>
            </div>
          ) : (
            <ol className="tip-list">
              {tips.map((tip) => (
                <li key={`${tip.id}-${tip.sender}-${tip.timestamp}`} className="tip-item">
                  <div className="tip-item-topline">
                    <strong>{formatUsdc(tip.amount)} USDC</strong>
                    <span>{formatDate(tip.timestamp)}</span>
                  </div>
                  <p>{tip.message || "No message"}</p>
                  <span className="sender">{compactAddress(tip.sender)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
