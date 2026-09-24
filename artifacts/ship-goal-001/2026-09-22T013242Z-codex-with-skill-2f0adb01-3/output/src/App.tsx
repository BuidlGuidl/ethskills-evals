import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, Check, Copy, Drill, Plus, RefreshCcw, Search, ShieldCheck, Wallet } from "lucide-react";
import { type Address, formatUnits, isAddress, keccak256, parseUnits, stringToHex } from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { erc20Abi, toolshedEscrowAbi } from "./abi/toolshedEscrow";
import { initialTools, type ToolListing } from "./data/tools";
import { supportedChains } from "./wagmi";

const escrowAddress = import.meta.env.VITE_TOOLSHED_ESCROW_ADDRESS as Address | undefined;
const usdcAddress = import.meta.env.VITE_USDC_ADDRESS as Address | undefined;
const targetChainId = Number(import.meta.env.VITE_CHAIN_ID ?? baseSepolia.id);

type Notice = { kind: "success" | "error" | "info"; text: string } | null;

function App() {
  const [tools, setTools] = useState<ToolListing[]>(initialTools);
  const [selectedId, setSelectedId] = useState(initialTools[0].id);
  const [borrowDays, setBorrowDays] = useState(3);
  const [notice, setNotice] = useState<Notice>(null);
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approveCooldown, setApproveCooldown] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switchPending } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const selectedTool = tools.find((tool) => tool.id === selectedId) ?? tools[0];
  const deposit = parseUnits(selectedTool.depositUsd, 6);
  const lateFee = parseUnits(selectedTool.lateFeeUsd, 6);
  const wrongNetwork = isConnected && chainId !== targetChainId;
  const contractsConfigured = Boolean(escrowAddress && usdcAddress);

  const sortedTools = useMemo(() => {
    return [...tools]
      .filter((tool) => `${tool.name} ${tool.category} ${tool.ownerName}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => reliabilityScore(b) - reliabilityScore(a));
  }, [query, tools]);

  const { data: isMember, refetch: refetchMembership } = useReadContract({
    address: escrowAddress,
    abi: toolshedEscrowAbi,
    functionName: "isMember",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(contractsConfigured && address && !wrongNetwork) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && escrowAddress ? [address, escrowAddress] : undefined,
    query: { enabled: Boolean(contractsConfigured && address && !wrongNetwork) },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(contractsConfigured && address && !wrongNetwork) },
  });

  const needsApproval = contractsConfigured && Boolean(allowance !== undefined && allowance < deposit);
  const hasEnoughBalance = balance === undefined || balance >= deposit;

  async function approveDeposit() {
    if (!walletClient || !publicClient || !usdcAddress || !escrowAddress) return;
    setApprovalSubmitting(true);
    setNotice({ kind: "info", text: "Confirm the USDC approval in your wallet." });
    try {
      const hash = await walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [escrowAddress, deposit],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNotice({ kind: "success", text: "Deposit approval confirmed." });
      setApproveCooldown(true);
      await refetchAllowance();
      window.setTimeout(() => {
        setApproveCooldown(false);
        void refetchAllowance();
      }, 4_000);
    } catch (error) {
      setNotice({ kind: "error", text: parseWalletError(error) });
    } finally {
      setApprovalSubmitting(false);
    }
  }

  async function requestLoan() {
    if (!walletClient || !publicClient || !escrowAddress) return;
    if (!hasEnoughBalance) {
      setNotice({ kind: "error", text: "Your USDC balance is below the required deposit." });
      return;
    }
    setRequestSubmitting(true);
    setNotice({ kind: "info", text: "Confirm the borrow request in your wallet." });
    try {
      const dueAt = BigInt(Math.floor(Date.now() / 1000) + borrowDays * 24 * 60 * 60);
      const hash = await walletClient.writeContract({
        address: escrowAddress,
        abi: toolshedEscrowAbi,
        functionName: "requestLoan",
        args: [toolKey(selectedTool.id), selectedTool.owner, dueAt, deposit, lateFee],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setNotice({ kind: "success", text: "Borrow request recorded and deposit escrowed." });
      await Promise.all([refetchAllowance(), refetchBalance(), refetchMembership()]);
    } catch (error) {
      setNotice({ kind: "error", text: parseWalletError(error) });
    } finally {
      setRequestSubmitting(false);
    }
  }

  function addTool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const owner = String(form.get("owner") ?? "");
    if (!isAddress(owner)) {
      setNotice({ kind: "error", text: "Use a valid owner wallet address." });
      return;
    }

    const name = String(form.get("name") ?? "").trim();
    const condition = String(form.get("condition") ?? "").trim();
    const imageUrl = String(form.get("imageUrl") ?? "").trim();
    if (!name || !condition || !imageUrl) {
      setNotice({ kind: "error", text: "Name, condition notes, and photo URL are required." });
      return;
    }

    const tool: ToolListing = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name,
      category: String(form.get("category") ?? "Shared"),
      ownerName: String(form.get("ownerName") ?? "Neighbor"),
      owner: owner as Address,
      condition,
      imageUrl,
      depositUsd: String(form.get("depositUsd") ?? "50"),
      lateFeeUsd: String(form.get("lateFeeUsd") ?? "10"),
      loans: 0,
      lateReturns: 0,
    };

    setTools((current) => [tool, ...current]);
    setSelectedId(tool.id);
    event.currentTarget.reset();
    setNotice({ kind: "success", text: "Tool added to this browser session." });
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Drill size={20} />
          </span>
          <div>
            <h1>Toolshed</h1>
            <p>Neighborhood lending with deposits, late fees, and member track records.</p>
          </div>
        </div>
        <div className="wallet-panel">
          {isConnected ? (
            <>
              <button className="icon-button" title="Copy connected address" onClick={() => void navigator.clipboard.writeText(address ?? "")}>
                <Copy size={16} />
              </button>
              <span className="address">{shortAddress(address)}</span>
              <button className="secondary-button" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          ) : (
            <button className="primary-button" disabled={connectPending} onClick={() => connect({ connector: connectors[0] })}>
              <Wallet size={16} />
              {connectPending ? "Connecting..." : "Connect wallet"}
            </button>
          )}
        </div>
      </header>

      {!contractsConfigured && (
        <section className="notice info">
          <AlertCircle size={18} />
          Set <code>VITE_TOOLSHED_ESCROW_ADDRESS</code> and <code>VITE_USDC_ADDRESS</code> to enable onchain borrowing.
        </section>
      )}
      {notice && (
        <section className={`notice ${notice.kind}`}>
          {notice.kind === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
          {notice.text}
        </section>
      )}

      <section className="workspace">
        <aside className="catalog">
          <div className="catalog-header">
            <div>
              <h2>Browse tools</h2>
              <p>Sorted by owner reliability for first-version lending decisions.</p>
            </div>
            <label className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
            </label>
          </div>

          <div className="tool-list">
            {sortedTools.map((tool) => (
              <button
                key={tool.id}
                className={`tool-row ${tool.id === selectedTool.id ? "active" : ""}`}
                onClick={() => setSelectedId(tool.id)}
              >
                <img src={tool.imageUrl} alt={tool.name} />
                <span>
                  <strong>{tool.name}</strong>
                  <small>
                    {tool.ownerName} · {tool.category}
                  </small>
                </span>
                <b>{Math.round(reliabilityScore(tool))}</b>
              </button>
            ))}
          </div>
        </aside>

        <section className="detail">
          <div className="photo-frame">
            <img src={selectedTool.imageUrl} alt={selectedTool.name} />
          </div>
          <div className="detail-body">
            <div className="title-line">
              <div>
                <span className="eyebrow">{selectedTool.category}</span>
                <h2>{selectedTool.name}</h2>
              </div>
              <div className="score">
                <ShieldCheck size={18} />
                {Math.round(reliabilityScore(selectedTool))}/100
              </div>
            </div>
            <p className="condition">{selectedTool.condition}</p>
            <div className="stats-grid">
              <Metric label="Owner" value={selectedTool.ownerName} />
              <Metric label="Deposit" value={`$${selectedTool.depositUsd} USDC`} />
              <Metric label="Late fee" value={`$${selectedTool.lateFeeUsd}/day`} />
              <Metric label="Track record" value={`${selectedTool.loans} loans · ${selectedTool.lateReturns} late`} />
            </div>

            <div className="borrow-panel">
              <label>
                Borrow length
                <input
                  type="number"
                  min={1}
                  max={21}
                  value={borrowDays}
                  onChange={(event) => setBorrowDays(Number(event.target.value))}
                />
              </label>
              <div className="borrow-copy">
                <strong>{formatUnits(deposit, 6)} USDC deposit</strong>
                <span>
                  Due in {borrowDays} days. Late returns are charged {formatUnits(lateFee, 6)} USDC per day, capped by
                  the deposit.
                </span>
              </div>
              <ActionButton
                isConnected={isConnected}
                wrongNetwork={wrongNetwork}
                isMember={isMember}
                needsApproval={needsApproval}
                approveBusy={approvalSubmitting || approveCooldown}
                requestBusy={requestSubmitting}
                switchBusy={switchPending}
                contractsConfigured={contractsConfigured}
                onConnect={() => connect({ connector: connectors[0] })}
                onSwitch={() => switchChain({ chainId: targetChainId })}
                onApprove={approveDeposit}
                onRequest={requestLoan}
              />
            </div>
          </div>
        </section>

        <aside className="add-panel">
          <h2>Add a tool</h2>
          <form onSubmit={addTool}>
            <input name="name" placeholder="Tool name" />
            <input name="category" placeholder="Category" />
            <input name="ownerName" placeholder="Owner name" />
            <input name="owner" placeholder="Owner wallet address" />
            <input name="imageUrl" placeholder="Photo URL" />
            <textarea name="condition" placeholder="Condition notes" />
            <div className="form-row">
              <input name="depositUsd" type="number" min="1" step="1" placeholder="Deposit" />
              <input name="lateFeeUsd" type="number" min="1" step="1" placeholder="Late fee/day" />
            </div>
            <button className="secondary-button" type="submit">
              <Plus size={16} />
              Add listing
            </button>
          </form>
        </aside>
      </section>

      <footer>
        <RefreshCcw size={15} />
        Onchain actions use exact approvals, separate pending states, and USDC 6-decimal amounts.
      </footer>
    </main>
  );
}

function ActionButton(props: {
  isConnected: boolean;
  wrongNetwork: boolean;
  isMember: boolean | undefined;
  needsApproval: boolean;
  approveBusy: boolean;
  requestBusy: boolean;
  switchBusy: boolean;
  contractsConfigured: boolean;
  onConnect: () => void;
  onSwitch: () => void;
  onApprove: () => void;
  onRequest: () => void;
}) {
  if (!props.contractsConfigured) {
    return (
      <button className="primary-button" disabled>
        Configure contracts
      </button>
    );
  }
  if (!props.isConnected) {
    return (
      <button className="primary-button" onClick={props.onConnect}>
        <Wallet size={16} /> Connect wallet
      </button>
    );
  }
  if (props.wrongNetwork) {
    return (
      <button className="primary-button" disabled={props.switchBusy} onClick={props.onSwitch}>
        {props.switchBusy ? "Switching..." : `Switch to ${chainName(targetChainId)}`}
      </button>
    );
  }
  if (props.isMember === false) {
    return (
      <button className="primary-button" disabled>
        Membership required
      </button>
    );
  }
  if (props.needsApproval) {
    return (
      <button className="primary-button" disabled={props.approveBusy} onClick={props.onApprove}>
        {props.approveBusy ? "Approving..." : "Approve deposit"}
      </button>
    );
  }
  return (
    <button className="primary-button" disabled={props.requestBusy} onClick={props.onRequest}>
      {props.requestBusy ? "Requesting..." : "Request to borrow"}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function reliabilityScore(tool: ToolListing) {
  if (tool.loans === 0) return 50;
  const onTimeRate = (tool.loans - tool.lateReturns) / tool.loans;
  const experience = Math.min(tool.loans / 25, 1);
  return 45 + onTimeRate * 45 + experience * 10;
}

function toolKey(id: string) {
  return keccak256(stringToHex(id, { size: 32 }));
}

function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function chainName(chainId: number) {
  return supportedChains.find((chain) => chain.id === chainId)?.name ?? `chain ${chainId}`;
}

function parseWalletError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("user rejected")) return "Transaction rejected in wallet.";
  if (message.includes("NotMember")) return "This wallet is not marked as an active association member.";
  if (message.includes("InvalidLoanTerms")) return "The selected loan terms are invalid.";
  if (message.includes("insufficient funds")) return "Wallet has insufficient funds for this action.";
  return "Transaction failed. Check wallet details and try again.";
}

export default App;
