import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CircleDollarSign,
  Coins,
  Loader2,
  PlugZap,
  Send,
  Unplug,
  Wallet,
} from "lucide-react";
import {
  BaseError,
  ContractFunctionRevertedError,
  formatUnits,
  getAddress,
  parseAbiItem,
  parseUnits,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import deployment from "./deployments/local.json";
import { hardhatLocal } from "./main";

type Deployment = typeof deployment & {
  tipJarAbi: readonly unknown[];
  mockUsdcAbi: readonly unknown[];
};

type Tip = {
  id: bigint;
  tipper: Address;
  amount: bigint;
  name: string;
  message: string;
  timestamp: bigint;
  transactionHash: Address;
};

const localDeployment = deployment as Deployment;
const tipJarAddress = localDeployment.tipJar as Address;
const usdcAddress = localDeployment.usdc as Address;
const isDeployed = tipJarAddress !== zeroAddress && usdcAddress !== zeroAddress;
const tipJarAbi = localDeployment.tipJarAbi;
const mockUsdcAbi = localDeployment.mockUsdcAbi;

const tipSentEvent = parseAbiItem(
  "event TipSent(uint256 indexed tipId, address indexed tipper, uint256 amount, string name, string message, uint256 timestamp)",
);

function App() {
  const { address, isConnected, chain } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: hardhatLocal.id });
  const queryClient = useQueryClient();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [amount, setAmount] = useState("5");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const walletUsdc = useReadContract({
    address: usdcAddress,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isDeployed && Boolean(address), refetchInterval: 6_000 },
  });

  const allowance = useReadContract({
    address: usdcAddress,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: address ? [address, tipJarAddress] : undefined,
    query: { enabled: isDeployed && Boolean(address), refetchInterval: 6_000 },
  });

  const jarBalance = useReadContract({
    address: usdcAddress,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: [tipJarAddress],
    query: { enabled: isDeployed, refetchInterval: 6_000 },
  });

  const totalTips = useReadContract({
    address: tipJarAddress,
    abi: tipJarAbi,
    functionName: "totalTips",
    query: { enabled: isDeployed, refetchInterval: 6_000 },
  });

  const ethBalance = useBalance({
    address,
    chainId: hardhatLocal.id,
    query: { enabled: Boolean(address), refetchInterval: 8_000 },
  });

  const tipsQuery = useQuery({
    queryKey: ["tips", tipJarAddress],
    enabled: isDeployed && Boolean(publicClient),
    refetchInterval: 7_000,
    queryFn: async () => {
      if (!publicClient) return [];
      const logs = await publicClient.getLogs({
        address: tipJarAddress,
        event: tipSentEvent,
        fromBlock: 0n,
        toBlock: "latest",
      });

      return logs
        .map((log) => ({
          id: log.args.tipId ?? 0n,
          tipper: log.args.tipper ?? zeroAddress,
          amount: log.args.amount ?? 0n,
          name: log.args.name ?? "",
          message: log.args.message ?? "",
          timestamp: log.args.timestamp ?? 0n,
          transactionHash: log.transactionHash,
        }))
        .sort((a, b) => Number(b.id - a.id));
    },
  });

  const parsedAmount = useMemo(() => {
    try {
      return amount ? parseUnits(amount, 6) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = parsedAmount > ((allowance.data as bigint | undefined) ?? 0n);
  const onWrongNetwork = isConnected && chainId !== hardhatLocal.id;
  const connector = connectors[0];

  async function refresh() {
    await Promise.all([
      walletUsdc.refetch(),
      allowance.refetch(),
      jarBalance.refetch(),
      totalTips.refetch(),
      queryClient.invalidateQueries({ queryKey: ["tips", tipJarAddress] }),
    ]);
  }

  async function runTx(label: string, action: () => Promise<unknown>) {
    setError("");
    setStatus(label);
    try {
      await action();
      await refresh();
      setStatus("Done");
      window.setTimeout(() => setStatus(""), 2200);
    } catch (caught) {
      setStatus("");
      setError(readableError(caught));
    }
  }

  async function waitForHash(hash: Hash) {
    if (!publicClient) return;
    await publicClient.waitForTransactionReceipt({ hash });
  }

  async function mintTestUsdc() {
    if (!address) return;

    await runTx("Minting test USDC", async () => {
      const hash = await writeContractAsync({
        chainId: hardhatLocal.id,
        address: usdcAddress,
        abi: mockUsdcAbi,
        functionName: "mint",
        args: [address, parseUnits("1000", 6)],
      });
      await waitForHash(hash);
    });
  }

  async function sendTip() {
    if (!address || parsedAmount <= 0n) {
      setError("Enter a positive USDC amount.");
      return;
    }

    await runTx(needsApproval ? "Approving, then sending tip" : "Sending tip", async () => {
      if (needsApproval) {
        const approvalHash = await writeContractAsync({
          chainId: hardhatLocal.id,
          address: usdcAddress,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [tipJarAddress, parsedAmount],
        });
        await waitForHash(approvalHash);
      }

      const tipHash = await writeContractAsync({
        chainId: hardhatLocal.id,
        address: tipJarAddress,
        abi: tipJarAbi,
        functionName: "tip",
        args: [parsedAmount, name.trim(), message.trim()],
      });
      await waitForHash(tipHash);

      setAmount("5");
      setName("");
      setMessage("");
    });
  }

  return (
    <main className="shell">
      <section className="topbar" aria-label="Wallet connection">
        <div>
          <p className="eyebrow">Base USDC tip jar</p>
          <h1>Send tips, watch the feed fill in live.</h1>
        </div>

        <div className="walletCluster">
          {isConnected && address ? (
            <>
              <div className="walletPill">
                <Wallet size={16} />
                <span>{shortAddress(address)}</span>
              </div>
              <button className="iconButton" type="button" title="Disconnect" onClick={() => disconnect()}>
                <Unplug size={18} />
              </button>
            </>
          ) : (
            <button
              className="primaryButton"
              type="button"
              disabled={!connector || isConnecting}
              onClick={() => connector && connect({ connector })}
            >
              {isConnecting ? <Loader2 className="spin" size={18} /> : <PlugZap size={18} />}
              Connect wallet
            </button>
          )}
        </div>
      </section>

      {!isDeployed ? (
        <section className="notice">
          <strong>Local deployment missing.</strong>
          <span>Run `npm run chain`, then `npm run deploy:local` so the frontend has contract addresses.</span>
        </section>
      ) : null}

      {onWrongNetwork ? (
        <section className="notice amber">
          <strong>Wrong network.</strong>
          <span>Switch your wallet to Hardhat Local before sending a local tip.</span>
          <button type="button" onClick={() => switchChain({ chainId: hardhatLocal.id })} disabled={isSwitching}>
            Switch
          </button>
        </section>
      ) : null}

      <section className="metrics" aria-label="Tip jar totals">
        <Metric
          icon={<CircleDollarSign size={20} />}
          label="Jar balance"
          value={`${formatUsdc(jarBalance.data)} USDC`}
        />
        <Metric icon={<Coins size={20} />} label="All-time tips" value={`${formatUsdc(totalTips.data)} USDC`} />
        <Metric
          icon={<Wallet size={20} />}
          label="Your local balance"
          value={`${formatUsdc(walletUsdc.data)} USDC`}
        />
      </section>

      <section className="workspace">
        <form
          className="tipForm"
          onSubmit={(event) => {
            event.preventDefault();
            void sendTip();
          }}
        >
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Send a tip</p>
              <h2>Local mUSDC</h2>
            </div>
            <button
              className="secondaryButton"
              type="button"
              disabled={!isConnected || onWrongNetwork || isWriting}
              onClick={() => void mintTestUsdc()}
            >
              <Coins size={17} />
              Faucet
            </button>
          </div>

          <label>
            Amount
            <div className="amountInput">
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
            Name
            <input maxLength={64} placeholder="Anonymous builder" value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label>
            Message
            <textarea
              maxLength={280}
              rows={5}
              placeholder="Leave a note for the feed"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <button
            className="sendButton"
            type="submit"
            disabled={!isConnected || onWrongNetwork || isWriting || parsedAmount <= 0n}
          >
            {isWriting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            {needsApproval ? "Approve and tip" : "Send tip"}
          </button>

          <div className="formMeta">
            <span>{ethBalance.data ? `${Number(ethBalance.data.formatted).toFixed(3)} ETH gas` : "Local gas balance"}</span>
            <span>{status || "Ready"}</span>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="feed">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Tip feed</p>
              <h2>{tipsQuery.data?.length ?? 0} entries</h2>
            </div>
            <button className="iconButton" type="button" title="Refresh feed" onClick={() => void refresh()}>
              <ArrowUpRight size={18} />
            </button>
          </div>

          <div className="feedList">
            {tipsQuery.isLoading ? (
              <div className="emptyState">Loading feed...</div>
            ) : tipsQuery.data && tipsQuery.data.length > 0 ? (
              tipsQuery.data.map((tip) => <TipRow key={tip.id.toString()} tip={tip} />)
            ) : (
              <div className="emptyState">No tips yet. Send the first one from your local wallet.</div>
            )}
          </div>
        </section>
      </section>

      <section className="contractStrip">
        <span>Tip jar {shortAddress(tipJarAddress)}</span>
        <span>Local USDC {shortAddress(usdcAddress)}</span>
        <span>Base USDC {shortAddress(localDeployment.baseUsdc as Address)}</span>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TipRow({ tip }: { tip: Tip }) {
  const displayName = tip.name || "Anonymous";
  const date = tip.timestamp > 0n ? new Date(Number(tip.timestamp) * 1000).toLocaleString() : "Pending";

  return (
    <article className="tipRow">
      <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
      <div>
        <header>
          <strong>{displayName}</strong>
          <span>{formatUsdc(tip.amount)} USDC</span>
        </header>
        <p>{tip.message || "No note attached."}</p>
        <footer>
          <span>{shortAddress(getAddress(tip.tipper))}</span>
          <span>{date}</span>
        </footer>
      </div>
    </article>
  );
}

function formatUsdc(value: unknown) {
  if (typeof value !== "bigint") return "0.00";
  return Number(formatUnits(value, 6)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortAddress(value: Address | string) {
  if (!value || value === zeroAddress) return "not set";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function readableError(error: unknown) {
  if (error instanceof BaseError) {
    const revert = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.reason) return revert.reason;
    return error.shortMessage;
  }

  if (error instanceof Error) return error.message;
  return "Transaction failed.";
}

export default App;
