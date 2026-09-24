import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownUp,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock,
  Hammer,
  ImagePlus,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Upload,
  Wallet
} from "lucide-react";
import { useMemo, useState } from "react";
import { WagmiProvider, useAccount, useConnect, useDisconnect, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { keccak256, parseUnits, toBytes } from "viem";
import { erc20Abi, escrowAddress, toolshedEscrowAbi, usdcAddress, wagmiConfig } from "./contracts";
import { formatAddress, members, reliability, requests, Tool, tools } from "./data";

const queryClient = new QueryClient();

type SortMode = "reliable" | "deposit" | "available";

function ToolshedApp() {
  const [sortMode, setSortMode] = useState<SortMode>("reliable");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(tools[0]);
  const [days, setDays] = useState(3);
  const [deposit, setDeposit] = useState(tools[0].deposit.toString());
  const [lateFee, setLateFee] = useState(tools[0].lateFee.toString());
  const [txState, setTxState] = useState<"idle" | "approving" | "requesting" | "done">("idle");
  const [txError, setTxError] = useState("");
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = useQueryClient();

  const depositUnits = useMemo(() => {
    try {
      return parseUnits(deposit || "0", 6);
    } catch {
      return 0n;
    }
  }, [deposit]);

  const contractsConfigured = Boolean(escrowAddress && usdcAddress);
  const allowance = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? "0x0000000000000000000000000000000000000000", escrowAddress ?? "0x0000000000000000000000000000000000000000"],
    query: {
      enabled: Boolean(address && escrowAddress && usdcAddress)
    }
  });

  const sortedTools = useMemo(() => {
    return [...tools].sort((a, b) => {
      const ownerA = members.find((member) => member.id === a.ownerId)!;
      const ownerB = members.find((member) => member.id === b.ownerId)!;
      if (sortMode === "deposit") {
        return a.deposit - b.deposit;
      }
      if (sortMode === "available") {
        return Number(b.availability === "Available") - Number(a.availability === "Available");
      }
      return reliability(ownerB) - reliability(ownerA);
    });
  }, [sortMode]);

  const rankedRequests = useMemo(() => {
    return requests
      .filter((request) => request.status === "Pending")
      .map((request) => ({
        ...request,
        borrower: members.find((member) => member.id === request.borrowerId)!,
        tool: tools.find((tool) => tool.id === request.toolId)!
      }))
      .sort((a, b) => reliability(b.borrower) - reliability(a.borrower));
  }, []);

  const activeOwner = selectedTool ? members.find((member) => member.id === selectedTool.ownerId)! : members[0];
  const needsApproval = contractsConfigured && allowance.data !== undefined && allowance.data < depositUnits;

  function openTool(tool: Tool) {
    setSelectedTool(tool);
    setDeposit(tool.deposit.toString());
    setLateFee(tool.lateFee.toString());
    setTxError("");
    setTxState("idle");
  }

  async function approveDeposit() {
    if (!usdcAddress || !escrowAddress) {
      setTxError("Set VITE_USDC_ADDRESS and VITE_TOOLSHED_ESCROW_ADDRESS before sending transactions.");
      return;
    }
    setTxState("approving");
    setTxError("");
    try {
      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [escrowAddress, depositUnits]
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      await client.invalidateQueries();
      setTxState("idle");
    } catch (error) {
      setTxError(readableError(error));
      setTxState("idle");
    }
  }

  async function requestLoan() {
    if (!selectedTool || !escrowAddress) {
      setTxError("Select a tool and configure the escrow contract first.");
      return;
    }
    const startsAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const dueAt = startsAt + days * 24 * 60 * 60;
    setTxState("requesting");
    setTxError("");
    try {
      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: toolshedEscrowAbi,
        functionName: "requestLoan",
        args: [
          keccak256(toBytes(selectedTool.id)),
          activeOwner.address,
          depositUnits,
          parseUnits(lateFee || "0", 6),
          BigInt(startsAt),
          BigInt(dueAt)
        ]
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setTxState("done");
    } catch (error) {
      setTxError(readableError(error));
      setTxState("idle");
    }
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">
            <Hammer size={22} />
          </div>
          <div>
            <h1>Toolshed</h1>
            <p>Neighborhood lending library</p>
          </div>
        </div>
        <WalletButton />
      </header>

      <section className="summaryBand">
        <div>
          <span className="summaryLabel">Members</span>
          <strong>300</strong>
        </div>
        <div>
          <span className="summaryLabel">Tools listed</span>
          <strong>{tools.length}</strong>
        </div>
        <div>
          <span className="summaryLabel">Escrow token</span>
          <strong>USDC</strong>
        </div>
        <div>
          <span className="summaryLabel">Late fee route</span>
          <strong>Owner payout</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="inventoryPanel">
          <div className="panelHeader">
            <div>
              <h2>Browse tools</h2>
              <p>Sorted by owner track record and availability.</p>
            </div>
            <div className="segmented" aria-label="Sort tools">
              <button className={sortMode === "reliable" ? "active" : ""} onClick={() => setSortMode("reliable")}>
                <Star size={16} />
                Reliable
              </button>
              <button className={sortMode === "available" ? "active" : ""} onClick={() => setSortMode("available")}>
                <SlidersHorizontal size={16} />
                Open
              </button>
              <button className={sortMode === "deposit" ? "active" : ""} onClick={() => setSortMode("deposit")}>
                <ArrowDownUp size={16} />
                Deposit
              </button>
            </div>
          </div>

          <div className="toolGrid">
            {sortedTools.map((tool) => {
              const owner = members.find((member) => member.id === tool.ownerId)!;
              return (
                <button
                  key={tool.id}
                  className={`toolCard ${selectedTool?.id === tool.id ? "selected" : ""}`}
                  onClick={() => openTool(tool)}
                >
                  <img src={tool.image} alt={tool.name} />
                  <div className="toolBody">
                    <div className="toolTitle">
                      <h3>{tool.name}</h3>
                      <span className={tool.availability === "Available" ? "statusGood" : "statusPending"}>
                        {tool.availability}
                      </span>
                    </div>
                    <p>{tool.condition}</p>
                    <div className="metaRow">
                      <span>{owner.name}</span>
                      <span>{reliability(owner)} score</span>
                    </div>
                    <div className="moneyRow">
                      <span>${tool.deposit} deposit</span>
                      <span>${tool.lateFee}/day late</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="sidePanel">
          <section className="borrowBox">
            {selectedTool && (
              <>
                <div className="photoUpload">
                  <ImagePlus size={18} />
                  <span>Owner photo on listing</span>
                </div>
                <h2>{selectedTool.name}</h2>
                <p>{selectedTool.condition}</p>
                <div className="ownerLine">
                  <ShieldCheck size={18} />
                  <span>
                    {activeOwner.name} · {formatAddress(activeOwner.address)} · {reliability(activeOwner)} score
                  </span>
                </div>

                <label>
                  Borrow days
                  <input value={days} min={1} max={14} type="number" onChange={(event) => setDays(Number(event.target.value))} />
                </label>
                <label>
                  Deposit in USDC
                  <input value={deposit} inputMode="decimal" onChange={(event) => setDeposit(event.target.value)} />
                </label>
                <label>
                  Daily late fee in USDC
                  <input value={lateFee} inputMode="decimal" onChange={(event) => setLateFee(event.target.value)} />
                </label>

                <div className="costPreview">
                  <div>
                    <CircleDollarSign size={18} />
                    <span>${deposit || "0"} locked</span>
                  </div>
                  <div>
                    <Clock size={18} />
                    <span>${lateFee || "0"} per late day</span>
                  </div>
                </div>

                <ActionArea
                  isConnected={isConnected}
                  contractsConfigured={contractsConfigured}
                  needsApproval={Boolean(needsApproval)}
                  txState={txState}
                  txError={txError}
                  onApprove={approveDeposit}
                  onRequest={requestLoan}
                />
              </>
            )}
          </section>

          <section className="queueBox">
            <div className="panelHeader compact">
              <div>
                <h2>Request queue</h2>
                <p>Reliable borrowers surface first.</p>
              </div>
            </div>
            {rankedRequests.map((request) => (
              <div className="requestRow" key={request.id}>
                <div>
                  <strong>{request.borrower.name}</strong>
                  <span>
                    {request.tool.name} · {request.days} days
                  </span>
                </div>
                <b>{reliability(request.borrower)}</b>
              </div>
            ))}
          </section>

          <section className="listBox">
            <h2>List a tool</h2>
            <div className="uploadDrop">
              <Upload size={20} />
              <span>Photo, condition notes, deposit, late fee</span>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function ActionArea({
  isConnected,
  contractsConfigured,
  needsApproval,
  txState,
  txError,
  onApprove,
  onRequest
}: {
  isConnected: boolean;
  contractsConfigured: boolean;
  needsApproval: boolean;
  txState: "idle" | "approving" | "requesting" | "done";
  txError: string;
  onApprove: () => void;
  onRequest: () => void;
}) {
  if (!isConnected) {
    return (
      <div className="emptyAction">
        <Wallet size={18} />
        <span>Connect a wallet to request this tool.</span>
      </div>
    );
  }

  if (!contractsConfigured) {
    return (
      <div className="emptyAction warning">
        <AlertCircle size={18} />
        <span>Contract addresses are not configured in the frontend environment.</span>
      </div>
    );
  }

  return (
    <>
      {needsApproval ? (
        <button className="primaryButton" disabled={txState === "approving"} onClick={onApprove}>
          {txState === "approving" ? "Approving..." : "Approve USDC deposit"}
        </button>
      ) : (
        <button className="primaryButton" disabled={txState === "requesting" || txState === "done"} onClick={onRequest}>
          {txState === "requesting" ? "Requesting..." : txState === "done" ? "Request sent" : "Request loan"}
        </button>
      )}
      {txState === "done" && (
        <div className="successLine">
          <Check size={18} />
          <span>Deposit escrowed and request submitted.</span>
        </div>
      )}
      {txError && (
        <div className="errorLine">
          <AlertCircle size={18} />
          <span>{txError}</span>
        </div>
      )}
    </>
  );
}

function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injectedConnector = connectors[0];

  if (isConnected && address) {
    return (
      <button className="walletButton connected" onClick={() => disconnect()}>
        <Wallet size={18} />
        {formatAddress(address)}
      </button>
    );
  }

  return (
    <button className="walletButton" disabled={isPending || !injectedConnector} onClick={() => connect({ connector: injectedConnector })}>
      <Wallet size={18} />
      {isPending ? "Connecting..." : "Connect wallet"}
    </button>
  );
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("User rejected")) {
      return "Wallet request rejected.";
    }
    if (error.message.includes("NotMember")) {
      return "This wallet is not on the member allowlist.";
    }
    if (error.message.includes("allowance")) {
      return "USDC approval is too low for this deposit.";
    }
    return error.message.split("\n")[0];
  }
  return "Transaction failed.";
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ToolshedApp />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
