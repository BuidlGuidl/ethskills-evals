import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ethers } from "ethers";
import { CircleDollarSign, Copy, Loader2, RefreshCw, Send, Wallet } from "lucide-react";
import deployed from "./deployed.json";
import "./styles.css";

const LOCAL_CHAIN = {
  chainId: "0x7a69",
  chainName: "Hardhat Localhost",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["http://127.0.0.1:8545"],
};

const USDC_DECIMALS = 6;

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [tipAmount, setTipAmount] = useState("5");
  const [message, setMessage] = useState("");
  const [feed, setFeed] = useState([]);
  const [balance, setBalance] = useState("0");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const readProvider = useMemo(() => new ethers.JsonRpcProvider("http://127.0.0.1:8545"), []);
  const tipJarRead = useMemo(
    () => new ethers.Contract(deployed.tipJar, deployed.tipJarAbi, readProvider),
    [readProvider],
  );
  const usdcRead = useMemo(() => new ethers.Contract(deployed.usdc, deployed.usdcAbi, readProvider), [readProvider]);

  const tipJarWrite = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(deployed.tipJar, deployed.tipJarAbi, signer);
  }, [signer]);

  const usdcWrite = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(deployed.usdc, deployed.usdcAbi, signer);
  }, [signer]);

  const isExpectedChain = chainId === deployed.chainId;
  const hasLocalMock = Boolean(deployed.mockUsdc);

  const refreshFeed = useCallback(async () => {
    try {
      const count = Number(await tipJarRead.tipCount());
      const tips = count > 0 ? await tipJarRead.getTips(0, count) : [];
      const normalized = tips
        .map((tip, index) => ({
          id: index,
          sender: tip.sender,
          amount: ethers.formatUnits(tip.amount, USDC_DECIMALS),
          message: tip.message,
          timestamp: Number(tip.timestamp),
        }))
        .reverse();
      setFeed(normalized);
    } catch (error) {
      setStatus(`Could not load feed: ${shortError(error)}`);
    }
  }, [tipJarRead]);

  const refreshBalance = useCallback(async () => {
    if (!account) {
      setBalance("0");
      return;
    }

    try {
      const raw = await usdcRead.balanceOf(account);
      setBalance(formatUsdc(raw));
    } catch (error) {
      setStatus(`Could not load balance: ${shortError(error)}`);
    }
  }, [account, usdcRead]);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = async (accounts) => {
      const nextAccount = accounts[0] || "";
      setAccount(nextAccount);
      if (!nextAccount) {
        setSigner(null);
        setProvider(null);
        return;
      }

      const nextProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(nextProvider);
      setSigner(await nextProvider.getSigner());
    };

    const onChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
    };
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Install MetaMask or another injected wallet to send a tip.");
      return;
    }

    setBusy(true);
    setStatus("Connecting wallet...");

    try {
      const nextProvider = new ethers.BrowserProvider(window.ethereum);
      await nextProvider.send("eth_requestAccounts", []);
      const network = await nextProvider.getNetwork();
      const nextSigner = await nextProvider.getSigner();

      setProvider(nextProvider);
      setSigner(nextSigner);
      setChainId(Number(network.chainId));
      setAccount(await nextSigner.getAddress());
      setStatus("Wallet connected.");
    } catch (error) {
      setStatus(`Wallet connection failed: ${shortError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function switchToLocalNetwork() {
    if (!window.ethereum) return;

    setBusy(true);
    setStatus("Switching wallet network...");

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: LOCAL_CHAIN.chainId }],
      });
      const network = await provider.getNetwork();
      setChainId(Number(network.chainId));
      setStatus("Network switched.");
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [LOCAL_CHAIN],
        });
        setStatus("Local network added. Connect again if the wallet did not switch automatically.");
      } else {
        setStatus(`Network switch failed: ${shortError(error)}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function mintLocalUsdc() {
    if (!hasLocalMock || !usdcWrite || !account) return;

    setBusy(true);
    setStatus("Minting local test USDC...");

    try {
      const tx = await usdcWrite.mint(account, ethers.parseUnits("100", USDC_DECIMALS));
      await tx.wait();
      await refreshBalance();
      setStatus("Minted 100 local USDC.");
    } catch (error) {
      setStatus(`Mint failed: ${shortError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendTip(event) {
    event.preventDefault();
    if (!tipJarWrite || !usdcWrite || !account) {
      setStatus("Connect your wallet before sending a tip.");
      return;
    }
    if (!isExpectedChain) {
      setStatus(`Switch to chain ${deployed.chainId} before sending.`);
      return;
    }

    setBusy(true);
    setStatus("Preparing approval...");

    try {
      const amount = ethers.parseUnits(tipAmount || "0", USDC_DECIMALS);
      if (amount <= 0n) {
        setStatus("Enter a tip amount above 0.");
        return;
      }

      const allowance = await usdcRead.allowance(account, deployed.tipJar);
      if (allowance < amount) {
        const approveTx = await usdcWrite.approve(deployed.tipJar, amount);
        setStatus("Waiting for USDC approval...");
        await approveTx.wait();
      }

      setStatus("Sending tip...");
      const tx = await tipJarWrite.tip(amount, message.trim());
      await tx.wait();

      setMessage("");
      await Promise.all([refreshFeed(), refreshBalance()]);
      setStatus("Tip sent. Nice and clean.");
    } catch (error) {
      setStatus(`Tip failed: ${shortError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <aside className="sidebar" aria-label="Wallet and contract details">
          <div className="brand-lockup">
            <div className="coin-mark" aria-hidden="true">
              <CircleDollarSign size={30} />
            </div>
            <div>
              <p className="eyebrow">Base USDC</p>
              <h1>Tip Jar</h1>
            </div>
          </div>

          <div className="wallet-panel">
            <div>
              <p className="label">Wallet</p>
              <p className="mono">{account ? shorten(account) : "Not connected"}</p>
            </div>
            <button className="primary-button" type="button" onClick={connectWallet} disabled={busy}>
              <Wallet size={18} />
              {account ? "Reconnect" : "Connect"}
            </button>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Network</dt>
              <dd>{chainId ? `${chainId}${isExpectedChain ? "" : " (wrong)"}` : "Read-only local"}</dd>
            </div>
            <div>
              <dt>USDC Balance</dt>
              <dd>{balance} USDC</dd>
            </div>
            <div>
              <dt>Tip Jar</dt>
              <dd>
                <code>{shorten(deployed.tipJar)}</code>
                <CopyButton value={deployed.tipJar} />
              </dd>
            </div>
            <div>
              <dt>USDC Token</dt>
              <dd>
                <code>{shorten(deployed.usdc)}</code>
                <CopyButton value={deployed.usdc} />
              </dd>
            </div>
          </dl>

          <div className="sidebar-actions">
            {account && !isExpectedChain ? (
              <button type="button" onClick={switchToLocalNetwork} disabled={busy}>
                Switch Network
              </button>
            ) : null}
            {account && hasLocalMock ? (
              <button type="button" onClick={mintLocalUsdc} disabled={busy}>
                Mint Test USDC
              </button>
            ) : null}
          </div>

          {status ? (
            <div className="status-line" role="status">
              {busy ? <Loader2 className="spin" size={16} /> : null}
              <span>{status}</span>
            </div>
          ) : null}
        </aside>

        <section className="content-grid">
          <form className="tip-form" onSubmit={sendTip}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Send</p>
                <h2>Leave a USDC tip</h2>
              </div>
              <button type="submit" disabled={busy || !account}>
                <Send size={18} />
                Tip
              </button>
            </div>

            <label>
              <span>Amount</span>
              <div className="amount-input">
                <input
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  type="number"
                  value={tipAmount}
                  onChange={(event) => setTipAmount(event.target.value)}
                  placeholder="5.00"
                />
                <strong>USDC</strong>
              </div>
            </label>

            <label>
              <span>Message</span>
              <textarea
                maxLength={280}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Say what the tip is for"
              />
            </label>
          </form>

          <section className="feed-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Feed</p>
                <h2>Latest tips</h2>
              </div>
              <button className="icon-button" type="button" onClick={refreshFeed} aria-label="Refresh tip feed">
                <RefreshCw size={18} />
              </button>
            </div>

            <div className="feed-list">
              {feed.length === 0 ? (
                <div className="empty-state">
                  <CircleDollarSign size={34} />
                  <p>No tips yet. Send the first one locally.</p>
                </div>
              ) : (
                feed.map((tip) => (
                  <article className="tip-card" key={`${tip.sender}-${tip.timestamp}-${tip.id}`}>
                    <div>
                      <strong>{tip.amount} USDC</strong>
                      <span>{formatDate(tip.timestamp)}</span>
                    </div>
                    <p>{tip.message || "No message"}</p>
                    <code>{shorten(tip.sender)}</code>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button className="copy-button" type="button" onClick={copy} aria-label={copied ? "Copied" : "Copy address"}>
      <Copy size={14} />
    </button>
  );
}

function shorten(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatUsdc(value) {
  const formatted = ethers.formatUnits(value, USDC_DECIMALS);
  return Number(formatted).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function shortError(error) {
  return error?.shortMessage || error?.reason || error?.message || "Unknown error";
}

createRoot(document.getElementById("root")).render(<App />);
