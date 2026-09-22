import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  HandCoins,
  Loader2,
  PackageCheck,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { BaseError, getAddress, parseUnits, type Address, type Hash } from "viem";
import {
  appChain,
  blockExplorer,
  chainId,
  chainName,
  erc20Abi,
  escrowAbi,
  escrowAddress,
  publicClient,
  usdcAddress,
  walletClient,
} from "./contracts";
import { reliability, reliabilityLabel, requests, tools, type ToolCard } from "./sampleData";

type Tab = "catalog" | "requests" | "operate";
type PendingKey = "connect" | "switch" | "member" | "list" | "borrow" | "approve" | "return" | "cancel";

const emptyListing = {
  name: "Cordless impact driver",
  image: "https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?auto=format&fit=crop&w=900&q=80",
  condition: "Good battery, case latch is cracked.",
  deposit: "60",
  lateFee: "8",
  maxDays: "5",
};

function App() {
  const [tab, setTab] = useState<Tab>("catalog");
  const [account, setAccount] = useState<Address | null>(null);
  const [walletChain, setWalletChain] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingKey | null>(null);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [lastHash, setLastHash] = useState<Hash | null>(null);
  const [listing, setListing] = useState(emptyListing);
  const [memberAddress, setMemberAddress] = useState("");
  const [borrowToolId, setBorrowToolId] = useState("1");
  const [borrowDays, setBorrowDays] = useState("3");
  const [loanId, setLoanId] = useState("1");

  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) => {
        const reliabilityDelta = reliability(b.requester) - reliability(a.requester);
        if (reliabilityDelta !== 0) return reliabilityDelta;
        return b.requester.completedLoans - a.requester.completedLoans;
      }),
    [],
  );

  const configured = Boolean(escrowAddress && usdcAddress);
  const wrongNetwork = walletChain !== null && walletChain !== chainId;

  async function connectWallet() {
    await run("connect", "Connecting wallet...", async () => {
      const client = walletClient();
      const [address] = await client.requestAddresses();
      setAccount(address);
      setWalletChain(await client.getChainId());
      return undefined;
    });
  }

  async function switchNetwork() {
    await run("switch", `Switching to ${chainName}...`, async () => {
      if (!window.ethereum) throw new Error("No wallet provider found.");
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        });
      } catch (switchError) {
        const code = typeof switchError === "object" && switchError !== null && "code" in switchError ? switchError.code : undefined;
        if (code !== 4902) throw switchError;
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${chainId.toString(16)}`,
              chainName,
              nativeCurrency: appChain.nativeCurrency,
              rpcUrls: appChain.rpcUrls.default.http,
              blockExplorerUrls: [blockExplorer],
            },
          ],
        });
      }
      setWalletChain(chainId);
      return undefined;
    });
  }

  async function listTool() {
    await run("list", "Listing tool...", async () => {
      const { client, address } = await requireReadyWallet();
      const metadata = `data:application/json,${encodeURIComponent(
        JSON.stringify({
          name: listing.name,
          image: listing.image,
          condition: listing.condition,
        }),
      )}`;
      const hash = await client.writeContract({
        account: address,
        chain: appChain,
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "listTool",
        args: [
          metadata,
          parseUnits(listing.deposit, 6),
          parseUnits(listing.lateFee, 6),
          Number(listing.maxDays),
        ],
      });
      return hash;
    });
  }

  async function addMember() {
    await run("member", "Adding member...", async () => {
      const { client, address } = await requireReadyWallet();
      const hash = await client.writeContract({
        account: address,
        chain: appChain,
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "setMember",
        args: [getAddress(memberAddress), true],
      });
      return hash;
    });
  }

  async function requestLoanFromChain(tool?: ToolCard) {
    const toolId = BigInt(tool?.id ?? Number(borrowToolId));
    const days = Number(tool ? Math.min(3, tool.maxDays) : borrowDays);
    const deposit = parseUnits(String(tool?.deposit ?? 75), 6);

    await run("borrow", "Checking allowance...", async () => {
      const { client, address } = await requireReadyWallet();
      const allowance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, escrowAddress],
      });

      if (allowance < deposit) {
        setStatus("Approving exact USDC deposit...");
        const approveHash = await client.writeContract({
          account: address,
          chain: appChain,
          address: usdcAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [escrowAddress, deposit],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus("Requesting loan...");
      const hash = await client.writeContract({
        account: address,
        chain: appChain,
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "requestLoan",
        args: [toolId, days],
      });
      return hash;
    });
  }

  async function approveLoan() {
    await writeLoanAction("approve", "Approving loan request...", "approveLoan");
  }

  async function confirmReturn() {
    await writeLoanAction("return", "Confirming return...", "confirmReturn");
  }

  async function cancelPending() {
    await writeLoanAction("cancel", "Cancelling pending request...", "cancelPendingLoan");
  }

  async function writeLoanAction(
    key: PendingKey,
    message: string,
    functionName: "approveLoan" | "confirmReturn" | "cancelPendingLoan",
  ) {
    await run(key, message, async () => {
      const { client, address } = await requireReadyWallet();
      const hash = await client.writeContract({
        account: address,
        chain: appChain,
        address: escrowAddress,
        abi: escrowAbi,
        functionName,
        args: [BigInt(loanId)],
      });
      return hash;
    });
  }

  async function requireReadyWallet() {
    if (!configured) throw new Error("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
    const client = walletClient();
    const [address] = account ? [account] : await client.requestAddresses();
    const activeChain = await client.getChainId();
    setAccount(address);
    setWalletChain(activeChain);
    if (activeChain !== chainId) throw new Error(`Switch to ${chainName} before sending a transaction.`);
    return { client, address };
  }

  async function run(key: PendingKey, message: string, action: () => Promise<Hash | undefined>) {
    setPending(key);
    setStatus(message);
    setError("");
    setLastHash(null);
    try {
      const hash = await action();
      if (hash) {
        setStatus("Waiting for confirmation...");
        await publicClient.waitForTransactionReceipt({ hash });
        setLastHash(hash);
      }
      setStatus("Confirmed");
    } catch (caught) {
      setError(parseError(caught));
      setStatus("Action failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <main>
      <section className="topbar">
        <div>
          <div className="brand">
            <Wrench size={24} />
            <span>Toolshed</span>
          </div>
          <p className="subtitle">Neighborhood lending library with USDC deposits, late fees, and borrower reputation.</p>
        </div>
        <div className="walletBox">
          <div>
            <span className={configured ? "dot ok" : "dot warn"} />
            {configured ? "Contract configured" : "Missing contract env"}
          </div>
          <strong>{account ? shortAddress(account) : "Wallet not connected"}</strong>
          <div className="walletActions">
            {!account ? (
              <ActionButton icon={<PlugZap size={16} />} label="Connect" pending={pending === "connect"} onClick={connectWallet} />
            ) : wrongNetwork ? (
              <ActionButton icon={<RotateCcw size={16} />} label={`Switch to ${chainName}`} pending={pending === "switch"} onClick={switchNetwork} />
            ) : (
              <span className="network">{chainName}</span>
            )}
          </div>
        </div>
      </section>

      <section className="metrics">
        <Metric icon={<ShieldCheck />} label="Members" value="~300" />
        <Metric icon={<HandCoins />} label="Deposit asset" value="USDC" />
        <Metric icon={<Clock />} label="Late fee cadence" value="Daily" />
        <Metric icon={<SlidersHorizontal />} label="Borrower sort" value="Reliability first" />
      </section>

      <nav className="tabs" aria-label="Toolshed sections">
        <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>Catalog</button>
        <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>Request Queue</button>
        <button className={tab === "operate" ? "active" : ""} onClick={() => setTab("operate")}>Onchain Actions</button>
      </nav>

      {tab === "catalog" && (
        <section className="grid">
          {tools.map((tool) => (
            <article className="toolCard" key={tool.id}>
              <img src={tool.image} alt={tool.name} />
              <div className="toolBody">
                <div className="toolHeader">
                  <div>
                    <h2>{tool.name}</h2>
                    <p>{tool.condition}</p>
                  </div>
                  <span className="toolId">#{tool.id}</span>
                </div>
                <div className="tagRow">
                  {tool.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div className="terms">
                  <span>${tool.deposit} deposit</span>
                  <span>${tool.lateFee}/day late</span>
                  <span>{tool.maxDays} day max</span>
                </div>
                <div className="ownerLine">
                  <div>
                    <strong>{tool.owner.name}</strong>
                    <small>{tool.owner.neighborhood} · {tool.owner.completedLoans} loans · {tool.owner.lateReturns} late</small>
                  </div>
                  <b>{reliabilityLabel(tool.owner)}</b>
                </div>
                <ActionButton
                  icon={<HandCoins size={16} />}
                  label="Request with USDC"
                  pending={pending === "borrow"}
                  disabled={!configured || wrongNetwork}
                  onClick={() => requestLoanFromChain(tool)}
                />
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "requests" && (
        <section className="queue">
          {sortedRequests.map((request, index) => (
            <article className="requestRow" key={request.id}>
              <div className="rank">{index + 1}</div>
              <div>
                <h2>{request.requester.name}</h2>
                <p>{request.note}</p>
                <small>{request.requester.neighborhood} · {request.requester.completedLoans} loans · {request.requester.lateReturns} late</small>
              </div>
              <div className="requestTerms">
                <strong>{request.toolName}</strong>
                <span>{request.days} days · ${request.deposit} deposit</span>
              </div>
              <div className="score">{reliabilityLabel(request.requester)}</div>
            </article>
          ))}
        </section>
      )}

      {tab === "operate" && (
        <section className="operate">
          <article className="panel">
            <h2>Member Access</h2>
            <Field label="Member wallet" value={memberAddress} onChange={setMemberAddress} />
            <ActionButton icon={<ShieldCheck size={16} />} label="Add member" pending={pending === "member"} disabled={!configured || wrongNetwork} onClick={addMember} />
          </article>

          <article className="panel">
            <h2>List A Tool</h2>
            <Field label="Tool name" value={listing.name} onChange={(value) => setListing({ ...listing, name: value })} />
            <Field label="Photo URL" value={listing.image} onChange={(value) => setListing({ ...listing, image: value })} />
            <Field label="Condition notes" value={listing.condition} onChange={(value) => setListing({ ...listing, condition: value })} />
            <div className="three">
              <Field label="Deposit" value={listing.deposit} onChange={(value) => setListing({ ...listing, deposit: value })} />
              <Field label="Late fee/day" value={listing.lateFee} onChange={(value) => setListing({ ...listing, lateFee: value })} />
              <Field label="Max days" value={listing.maxDays} onChange={(value) => setListing({ ...listing, maxDays: value })} />
            </div>
            <ActionButton icon={<PackageCheck size={16} />} label="List onchain" pending={pending === "list"} disabled={!configured || wrongNetwork} onClick={listTool} />
          </article>

          <article className="panel">
            <h2>Loan Operations</h2>
            <div className="two">
              <Field label="Tool ID" value={borrowToolId} onChange={setBorrowToolId} />
              <Field label="Days" value={borrowDays} onChange={setBorrowDays} />
            </div>
            <ActionButton icon={<HandCoins size={16} />} label="Request loan" pending={pending === "borrow"} disabled={!configured || wrongNetwork} onClick={() => requestLoanFromChain()} />
            <Field label="Loan ID" value={loanId} onChange={setLoanId} />
            <div className="buttonStack">
              <ActionButton icon={<CheckCircle2 size={16} />} label="Approve request" pending={pending === "approve"} disabled={!configured || wrongNetwork} onClick={approveLoan} />
              <ActionButton icon={<ClipboardCheck size={16} />} label="Confirm return" pending={pending === "return"} disabled={!configured || wrongNetwork} onClick={confirmReturn} />
              <ActionButton icon={<RotateCcw size={16} />} label="Cancel pending" pending={pending === "cancel"} disabled={!configured || wrongNetwork} onClick={cancelPending} />
            </div>
          </article>
        </section>
      )}

      <section className="statusBar">
        <div>
          {pending ? <Loader2 className="spin" size={16} /> : error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{error || status}</span>
        </div>
        {lastHash && (
          <a href={`${blockExplorer}/tx/${lastHash}`} target="_blank" rel="noreferrer">
            View transaction
          </a>
        )}
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ActionButton({
  icon,
  label,
  pending,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="action" disabled={disabled || pending} onClick={onClick}>
      {pending ? <Loader2 className="spin" size={16} /> : icon}
      <span>{pending ? `${label}...` : label}</span>
    </button>
  );
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseError(error: unknown) {
  if (error instanceof BaseError) return error.shortMessage;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export default App;
