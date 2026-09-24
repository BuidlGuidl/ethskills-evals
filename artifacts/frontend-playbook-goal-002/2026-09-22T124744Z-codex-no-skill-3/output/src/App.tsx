import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Send,
  Wallet
} from "lucide-react";
import {
  Address,
  BaseError,
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits
} from "viem";
import { hardhat } from "viem/chains";
import {
  baseUsdcAddress,
  deploymentBlock,
  isDeploymentConfigured,
  localChainId,
  localRpcUrl,
  tipJarAddress
} from "./generated/deployment";
import { erc20Abi, tipEvent, tipJarAbi } from "./lib/abi";
import { formatTimestamp, formatUsdc, shortAddress } from "./lib/format";

type Tip = {
  id: string;
  tipper: Address;
  amount: bigint;
  message: string;
  timestamp: bigint;
  blockNumber: bigint;
};

const localChain = {
  ...hardhat,
  id: localChainId,
  name: "Hardhat Local",
  rpcUrls: {
    default: { http: [localRpcUrl] },
    public: { http: [localRpcUrl] }
  }
};

const publicClient = createPublicClient({
  chain: localChain,
  transport: http(localRpcUrl)
});

function errorMessage(error: unknown) {
  if (error instanceof BaseError) return error.shortMessage;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function App() {
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [tips, setTips] = useState<Tip[]>([]);
  const [balance, setBalance] = useState<bigint>(0n);
  const [jarBalance, setJarBalance] = useState<bigint>(0n);
  const [amount, setAmount] = useState("10");
  const [message, setMessage] = useState("Thanks for building on Base.");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const walletClient = useMemo(() => {
    if (!window.ethereum) return undefined;
    return createWalletClient({
      chain: localChain,
      transport: custom(window.ethereum)
    });
  }, []);

  const isCorrectChain = chainId === localChainId;
  const canSend = Boolean(account && isDeploymentConfigured && isCorrectChain && amount && !isSending);
  const totalTips = tips.reduce((sum, tip) => sum + tip.amount, 0n);

  const refreshFeed = useCallback(async () => {
    setIsRefreshing(true);
    setError("");
    try {
      if (!isDeploymentConfigured) {
        setTips([]);
        return;
      }

      const logs = await publicClient.getLogs({
        address: tipJarAddress,
        event: tipEvent,
        fromBlock: deploymentBlock,
        toBlock: "latest"
      });

      const nextTips = logs
        .map((log) => ({
          id: `${log.transactionHash}-${log.logIndex}`,
          tipper: log.args.tipper!,
          amount: log.args.amount!,
          message: log.args.message!,
          timestamp: log.args.timestamp!,
          blockNumber: log.blockNumber!
        }))
        .sort((a, b) => Number(b.blockNumber - a.blockNumber));

      setTips(nextTips);

      const jar = await publicClient.readContract({
        address: baseUsdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [tipJarAddress]
      });
      setJarBalance(jar);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const refreshWallet = useCallback(async (connectedAccount?: Address) => {
    const activeAccount = connectedAccount ?? account;
    if (!activeAccount) return;

    try {
      const [activeChain, activeBalance] = await Promise.all([
        walletClient?.getChainId(),
        publicClient.readContract({
          address: baseUsdcAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [activeAccount]
        })
      ]);

      setChainId(activeChain);
      setBalance(activeBalance);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [account, walletClient]);

  async function switchToLocalChain() {
    if (!window.ethereum) throw new Error("No injected wallet found.");

    const chainHex = `0x${localChainId.toString(16)}`;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }]
      });
    } catch (switchError) {
      const code = typeof switchError === "object" && switchError && "code" in switchError
        ? (switchError as { code?: number }).code
        : undefined;

      if (code !== 4902) throw switchError;

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainHex,
            chainName: "Hardhat Local",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [localRpcUrl]
          }
        ]
      });
    }
  }

  async function connectWallet() {
    setIsConnecting(true);
    setError("");
    setStatus("");

    try {
      if (!walletClient) throw new Error("Install a browser wallet such as MetaMask.");

      await switchToLocalChain();
      const [address] = await walletClient.requestAddresses();
      const activeChain = await walletClient.getChainId();
      setAccount(address);
      setChainId(activeChain);
      await refreshWallet(address);
      setStatus("Wallet connected.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsConnecting(false);
    }
  }

  async function submitTip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    try {
      if (!walletClient || !account) throw new Error("Connect a wallet first.");
      if (!isDeploymentConfigured) throw new Error("Run npm run deploy:local before sending a tip.");
      if (!isCorrectChain) await switchToLocalChain();

      const parsedAmount = parseUnits(amount || "0", 6);
      if (parsedAmount <= 0n) throw new Error("Enter a USDC amount greater than 0.");
      if (new TextEncoder().encode(message).length > 280) {
        throw new Error("Messages are limited to 280 bytes.");
      }

      setIsSending(true);
      setStatus("Approving USDC...");

      const allowance = await publicClient.readContract({
        address: baseUsdcAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, tipJarAddress]
      });

      if (allowance < parsedAmount) {
        const approveHash = await walletClient.writeContract({
          account,
          address: baseUsdcAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [tipJarAddress, parsedAmount]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus("Sending tip...");
      const tipHash = await walletClient.writeContract({
        account,
        address: tipJarAddress,
        abi: tipJarAbi,
        functionName: "tip",
        args: [parsedAmount, message.trim()]
      });
      await publicClient.waitForTransactionReceipt({ hash: tipHash });

      setStatus("Tip sent.");
      setAmount("10");
      await Promise.all([refreshFeed(), refreshWallet(account)]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    refreshFeed();
    const timer = window.setInterval(refreshFeed, 8000);
    return () => window.clearInterval(timer);
  }, [refreshFeed]);

  useEffect(() => {
    if (!window.ethereum) return;

    function handleAccountsChanged(accounts: unknown) {
      const [nextAccount] = accounts as Address[];
      setAccount(nextAccount);
      if (nextAccount) refreshWallet(nextAccount);
    }

    function handleChainChanged(chainHex: unknown) {
      setChainId(Number(chainHex));
      refreshWallet();
    }

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [refreshWallet]);

  return (
    <main className="shell">
      <section className="summary-band">
        <div>
          <p className="eyebrow">Base local USDC tip jar</p>
          <h1>Send and watch USDC tips in real time.</h1>
        </div>
        <div className="stats-grid" aria-label="Tip jar stats">
          <div className="stat">
            <span>Total tipped</span>
            <strong>{formatUsdc(totalTips)} USDC</strong>
          </div>
          <div className="stat">
            <span>Jar balance</span>
            <strong>{formatUsdc(jarBalance)} USDC</strong>
          </div>
          <div className="stat">
            <span>Contract</span>
            <strong>{isDeploymentConfigured ? shortAddress(tipJarAddress) : "Not deployed"}</strong>
          </div>
        </div>
      </section>

      {!isDeploymentConfigured && (
        <section className="notice" role="status">
          <Plug size={18} />
          <span>Start the Hardhat node and run <code>npm run deploy:local</code> to configure the local contract.</span>
        </section>
      )}

      <div className="workspace">
        <section className="feed-panel" aria-labelledby="feed-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live feed</p>
              <h2 id="feed-title">Recent tips</h2>
            </div>
            <button className="icon-button" onClick={refreshFeed} disabled={isRefreshing} title="Refresh feed">
              <RefreshCw size={18} className={isRefreshing ? "spin" : ""} />
            </button>
          </div>

          <div className="feed-list">
            {tips.length === 0 ? (
              <div className="empty-state">
                <CircleDollarSign size={32} />
                <p>No tips yet on this local chain.</p>
              </div>
            ) : (
              tips.map((tip) => (
                <article className="tip-card" key={tip.id}>
                  <div className="tip-avatar">
                    <CircleDollarSign size={22} />
                  </div>
                  <div className="tip-body">
                    <div className="tip-row">
                      <strong>{formatUsdc(tip.amount)} USDC</strong>
                      <span>{formatTimestamp(tip.timestamp)}</span>
                    </div>
                    <p>{tip.message || "No message"}</p>
                    <div className="tip-meta">
                      <span>{shortAddress(tip.tipper)}</span>
                      <span>Block {tip.blockNumber.toString()}</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="action-panel" aria-labelledby="tip-title">
          <div className="wallet-box">
            <div className="wallet-status">
              <Wallet size={20} />
              <div>
                <span>Wallet</span>
                <strong>{account ? shortAddress(account) : "Disconnected"}</strong>
              </div>
            </div>
            <button className="primary-button" onClick={connectWallet} disabled={isConnecting}>
              {isConnecting ? <Loader2 size={17} className="spin" /> : <Plug size={17} />}
              {account ? "Reconnect" : "Connect"}
            </button>
          </div>

          {account && (
            <div className="balance-strip">
              <span>Your local USDC</span>
              <strong>{Number(formatUnits(balance, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            </div>
          )}

          <form onSubmit={submitTip}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">Tip form</p>
                <h2 id="tip-title">Send USDC</h2>
              </div>
              {isCorrectChain && account && <CheckCircle2 className="ok" size={22} />}
            </div>

            <label>
              <span>Amount</span>
              <div className="amount-input">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="10"
                />
                <span>USDC</span>
              </div>
            </label>

            <label>
              <span>Message</span>
              <textarea
                value={message}
                maxLength={280}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
              />
            </label>

            <button className="send-button" disabled={!canSend} type="submit">
              {isSending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              Send tip
            </button>
          </form>

          <div className="details">
            <a href={`https://basescan.org/token/${baseUsdcAddress}`} target="_blank" rel="noreferrer">
              Base USDC <ExternalLink size={14} />
            </a>
            <span>Local chain {localChainId}</span>
          </div>

          {status && <p className="status success">{status}</p>}
          {error && <p className="status error">{error}</p>}
        </aside>
      </div>
    </main>
  );
}
