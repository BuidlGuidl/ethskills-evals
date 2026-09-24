import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserProvider, Contract, Interface, JsonRpcProvider, formatUnits, parseUnits } from "ethers";
import deployment from "./deployments/localhost.json";
import { erc20Abi, tipJarAbi } from "./lib/abi";
import "./styles.css";

const LOCAL_CHAIN_ID = 31337;
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const USDC_DECIMALS = 6;

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsdc(value) {
  const formatted = formatUnits(value || 0n, USDC_DECIMALS);
  return Number(formatted).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function App() {
  const [account, setAccount] = useState("");
  const [walletChainId, setWalletChainId] = useState(null);
  const [balance, setBalance] = useState(null);
  const [jarBalance, setJarBalance] = useState(null);
  const [totalTips, setTotalTips] = useState(null);
  const [tips, setTips] = useState([]);
  const [amount, setAmount] = useState("5");
  const [message, setMessage] = useState("Thanks for building on Base.");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDeployment = Boolean(deployment.tipJar && deployment.usdc);
  const readProvider = useMemo(() => new JsonRpcProvider(LOCAL_RPC_URL), []);

  const loadFeed = useCallback(async () => {
    if (!hasDeployment) {
      setTips([]);
      return;
    }

    try {
      const tipJar = new Contract(deployment.tipJar, tipJarAbi, readProvider);
      const iface = new Interface(tipJarAbi);
      const filter = {
        address: deployment.tipJar,
        topics: [iface.getEvent("Tip").topicHash],
        fromBlock: 0,
        toBlock: "latest"
      };
      const logs = await readProvider.getLogs(filter);
      const parsed = logs
        .map((log) => {
          const event = iface.parseLog(log);
          return {
            id: `${log.transactionHash}-${log.index}`,
            txHash: log.transactionHash,
            tipper: event.args.tipper,
            amount: event.args.amount,
            message: event.args.message,
            timestamp: Number(event.args.timestamp)
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      const [currentBalance, currentTotal] = await Promise.all([
        tipJar.balance(),
        tipJar.totalTips()
      ]);

      setTips(parsed);
      setJarBalance(currentBalance);
      setTotalTips(currentTotal);
    } catch (error) {
      setStatus(`Waiting for the local chain: ${error.shortMessage || error.message}`);
    }
  }, [hasDeployment, readProvider]);

  const refreshWalletState = useCallback(async (address = account) => {
    if (!address || !hasDeployment || !window.ethereum) return;

    const browserProvider = new BrowserProvider(window.ethereum);
    const network = await browserProvider.getNetwork();
    setWalletChainId(Number(network.chainId));

    const usdc = new Contract(deployment.usdc, erc20Abi, browserProvider);
    setBalance(await usdc.balanceOf(address));
  }, [account, hasDeployment]);

  useEffect(() => {
    loadFeed();
    const interval = window.setInterval(loadFeed, 5000);
    return () => window.clearInterval(interval);
  }, [loadFeed]);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = ([nextAccount]) => {
      setAccount(nextAccount || "");
      if (nextAccount) refreshWalletState(nextAccount);
    };
    const handleChainChanged = () => window.location.reload();

    window.ethereum.request({ method: "eth_accounts" }).then(([existingAccount]) => {
      if (existingAccount) {
        setAccount(existingAccount);
        refreshWalletState(existingAccount);
      }
    });
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [refreshWalletState]);

  async function switchToLocalhost() {
    if (!window.ethereum) throw new Error("No injected wallet found.");

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }]
      });
    } catch (error) {
      if (error.code !== 4902) throw error;

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x7a69",
          chainName: "Hardhat Localhost",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [LOCAL_RPC_URL],
          blockExplorerUrls: []
        }]
      });
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Install a wallet such as MetaMask or Rabby to send a tip.");
      return;
    }

    try {
      await switchToLocalhost();
      const [selectedAccount] = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(selectedAccount);
      await refreshWalletState(selectedAccount);
      setStatus("Wallet connected.");
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function mintLocalUsdc() {
    if (!account) {
      await connectWallet();
      return;
    }

    setIsSubmitting(true);
    setStatus("Minting local test USDC...");

    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();
      const usdc = new Contract(deployment.usdc, erc20Abi, signer);
      const tx = await usdc.mint(account, parseUnits("1000", USDC_DECIMALS));
      await tx.wait();
      await refreshWalletState(account);
      setStatus("Added 1,000 local USDC to your wallet.");
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendTip(event) {
    event.preventDefault();

    if (!hasDeployment) {
      setStatus("Run npm run deploy:local before sending a tip.");
      return;
    }

    if (!account) {
      await connectWallet();
      return;
    }

    setIsSubmitting(true);
    setStatus("Preparing approval...");

    try {
      await switchToLocalhost();
      const parsedAmount = parseUnits(amount || "0", USDC_DECIMALS);
      if (parsedAmount <= 0n) throw new Error("Enter a tip amount greater than zero.");
      if (message.length > 280) throw new Error("Keep the message under 280 characters.");

      const browserProvider = new BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();
      const usdc = new Contract(deployment.usdc, erc20Abi, signer);
      const tipJar = new Contract(deployment.tipJar, tipJarAbi, signer);

      const approval = await usdc.approve(deployment.tipJar, parsedAmount);
      setStatus("Approval sent. Waiting for confirmation...");
      await approval.wait();

      const tip = await tipJar.tip(parsedAmount, message);
      setStatus("Tip sent. Waiting for confirmation...");
      await tip.wait();

      setAmount("5");
      setMessage("");
      await Promise.all([loadFeed(), refreshWalletState(account)]);
      setStatus("Tip confirmed. The feed has been updated.");
    } catch (error) {
      setStatus(error.shortMessage || error.reason || error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const wrongNetwork = walletChainId && walletChainId !== LOCAL_CHAIN_ID;

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Base USDC Tip Jar</p>
          <h1>Send a USDC thank-you onchain.</h1>
        </div>
        <button className="wallet" onClick={connectWallet}>
          {account ? shortAddress(account) : "Connect wallet"}
        </button>
      </section>

      <section className="stats">
        <div>
          <span>Jar balance</span>
          <strong>{jarBalance === null ? "--" : `${formatUsdc(jarBalance)} USDC`}</strong>
        </div>
        <div>
          <span>Total tipped</span>
          <strong>{totalTips === null ? "--" : `${formatUsdc(totalTips)} USDC`}</strong>
        </div>
        <div>
          <span>Your local USDC</span>
          <strong>{balance === null ? "--" : `${formatUsdc(balance)} USDC`}</strong>
        </div>
      </section>

      {!hasDeployment && (
        <div className="notice">
          The frontend is ready, but no local contracts are recorded yet. Run <code>npm run deploy:local</code>.
        </div>
      )}

      {wrongNetwork && (
        <div className="notice">
          Your wallet is connected to chain {walletChainId}. Switch to Hardhat Localhost to tip locally.
        </div>
      )}

      <section className="grid">
        <form className="panel form" onSubmit={sendTip}>
          <div className="panel-title">
            <div>
              <p className="eyebrow">Tip form</p>
              <h2>Leave a note with your USDC.</h2>
            </div>
            <button type="button" className="ghost" onClick={mintLocalUsdc} disabled={!hasDeployment || isSubmitting}>
              Get test USDC
            </button>
          </div>

          <label>
            Amount
            <div className="amount-row">
              <input
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <span>USDC</span>
            </div>
          </label>

          <label>
            Message
            <textarea
              maxLength={280}
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Say thanks, fund coffee, celebrate a launch..."
            />
          </label>

          <button className="primary" disabled={!hasDeployment || isSubmitting}>
            {isSubmitting ? "Confirming..." : account ? "Approve and tip" : "Connect to tip"}
          </button>

          {status && <p className="status">{status}</p>}
        </form>

        <section className="panel feed">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Live feed</p>
              <h2>Recent tips</h2>
            </div>
            <button className="ghost" onClick={loadFeed}>Refresh</button>
          </div>

          <div className="feed-list">
            {tips.length === 0 ? (
              <div className="empty">No tips yet. The first one gets pride of place.</div>
            ) : tips.map((tip) => (
              <article className="tip" key={tip.id}>
                <div className="tip-top">
                  <strong>{formatUsdc(tip.amount)} USDC</strong>
                  <span>{new Date(tip.timestamp * 1000).toLocaleString()}</span>
                </div>
                <p>{tip.message || "No message"}</p>
                <a href={`https://basescan.org/address/${tip.tipper}`} target="_blank" rel="noreferrer">
                  {shortAddress(tip.tipper)}
                </a>
              </article>
            ))}
          </div>
        </section>
      </section>

      <footer>
        Local contracts: TipJar {deployment.tipJar ? shortAddress(deployment.tipJar) : "--"} | USDC {deployment.usdc ? shortAddress(deployment.usdc) : "--"}
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
