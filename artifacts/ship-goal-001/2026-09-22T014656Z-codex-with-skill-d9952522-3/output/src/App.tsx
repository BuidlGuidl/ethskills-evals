import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, CircleDollarSign, Search, Wallet } from "lucide-react";
import { createWalletClient, custom } from "viem";
import type { EIP1193Provider } from "viem";
import { baseSepolia } from "viem/chains";
import { configuredChainId, escrowAddress, listingUri, toolHash, toolshedEscrowAbi, usdcAbi, usdcAddress, usdcAmount } from "./contracts";
import { memberByAddress, reliabilityScore, tools, type Tool } from "./data";

type RequestState = "idle" | "approving" | "requesting" | "sent" | "error";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function App() {
  const [query, setQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(tools[0]);
  const [days, setDays] = useState(3);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("Connect a wallet to create a live escrow request.");

  const sortedTools = useMemo(() => {
    return tools
      .filter((tool) => `${tool.name} ${tool.condition}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const ownerA = memberByAddress(a.owner);
        const ownerB = memberByAddress(b.owner);
        return reliabilityScore(ownerB ?? fallbackMember) - reliabilityScore(ownerA ?? fallbackMember);
      });
  }, [query]);

  async function connectWallet() {
    if (!window.ethereum) {
      setMessage("No injected wallet found. Install a browser wallet, then reload.");
      return;
    }

    const client = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
    const [address] = await client.requestAddresses();
    setAccount(address);
    setMessage("Wallet connected. Pick dates, approve USDC, and send the request.");
  }

  async function requestLoan(tool: Tool) {
    if (!window.ethereum || !account || !escrowAddress || !usdcAddress) {
      setMessage("Missing wallet or VITE_TOOLSHED_ESCROW_ADDRESS / VITE_USDC_ADDRESS configuration.");
      setRequestState("error");
      return;
    }

    try {
      const client = createWalletClient({ chain: baseSepolia, account, transport: custom(window.ethereum) });
      const deposit = usdcAmount(tool.depositUsdc);
      const startAt = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
      const dueAt = startAt + BigInt(days * 24 * 60 * 60);

      setRequestState("approving");
      setMessage("Approving USDC deposit for escrow...");
      await client.writeContract({
        address: usdcAddress,
        abi: usdcAbi,
        functionName: "approve",
        args: [escrowAddress, deposit],
        chain: baseSepolia,
        account,
      });

      setRequestState("requesting");
      setMessage("Creating the Toolshed loan request...");
      const hash = await client.writeContract({
        address: escrowAddress,
        abi: toolshedEscrowAbi,
        functionName: "createRequest",
        args: [toolHash(tool), tool.owner, startAt, dueAt, deposit, usdcAmount(tool.dailyLateFeeUsdc), listingUri(tool)],
        chain: baseSepolia,
        account,
      });

      setRequestState("sent");
      setMessage(`Request sent: ${hash}`);
    } catch (error) {
      setRequestState("error");
      setMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Neighborhood lending library</p>
          <h1>Toolshed</h1>
        </div>
        <button className="walletButton" onClick={connectWallet} type="button">
          <Wallet size={18} />
          <span>{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect"}</span>
        </button>
      </section>

      <section className="toolbar">
        <label className="searchBox">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools or condition notes" />
        </label>
        <div className="chainPill">Chain ID {configuredChainId}</div>
      </section>

      <section className="workspace">
        <div className="toolList" aria-label="Tools">
          {sortedTools.map((tool) => {
            const owner = memberByAddress(tool.owner) ?? fallbackMember;
            const score = reliabilityScore(owner);
            return (
              <button
                key={tool.id}
                className={`toolRow ${selectedTool?.id === tool.id ? "selected" : ""}`}
                onClick={() => setSelectedTool(tool)}
                type="button"
              >
                <img alt="" src={tool.photo} />
                <span>
                  <strong>{tool.name}</strong>
                  <small>{owner.name} · reliability {score}</small>
                </span>
                <span className="fee">${tool.dailyLateFeeUsdc}/day</span>
              </button>
            );
          })}
        </div>

        {selectedTool ? (
          <ToolDetail
            days={days}
            setDays={setDays}
            tool={selectedTool}
            message={message}
            requestState={requestState}
            onRequest={() => requestLoan(selectedTool)}
          />
        ) : (
          <section className="detailPanel empty">No matching tools.</section>
        )}
      </section>
    </main>
  );
}

function ToolDetail({
  tool,
  days,
  setDays,
  onRequest,
  requestState,
  message,
}: {
  tool: Tool;
  days: number;
  setDays: (days: number) => void;
  onRequest: () => void;
  requestState: RequestState;
  message: string;
}) {
  const owner = memberByAddress(tool.owner) ?? fallbackMember;
  const score = reliabilityScore(owner);
  const totalLateExposure = tool.dailyLateFeeUsdc * days;

  return (
    <section className="detailPanel">
      <img className="heroPhoto" src={tool.photo} alt={tool.name} />
      <div className="detailContent">
        <div className="titleBlock">
          <div>
            <p className="eyebrow">{tool.availableFrom}</p>
            <h2>{tool.name}</h2>
          </div>
          <span className="score">
            <CheckCircle2 size={18} />
            {score}
          </span>
        </div>

        <p className="condition">{tool.condition}</p>

        <dl className="facts">
          <div>
            <dt>Owner</dt>
            <dd>{owner.name}</dd>
          </div>
          <div>
            <dt>Track record</dt>
            <dd>
              {owner.loansBorrowed} loans · {owner.lateReturns} late
            </dd>
          </div>
          <div>
            <dt>Deposit</dt>
            <dd>${tool.depositUsdc} USDC</dd>
          </div>
          <div>
            <dt>Late fee</dt>
            <dd>${tool.dailyLateFeeUsdc} / day</dd>
          </div>
        </dl>

        <div className="requestBox">
          <label>
            <CalendarDays size={18} />
            Borrow days
            <input min="1" max="14" type="number" value={days} onChange={(event) => setDays(Number(event.target.value))} />
          </label>
          <div className="cost">
            <CircleDollarSign size={18} />
            <span>Deposit ${tool.depositUsdc}</span>
            <small>Late exposure for {days} days: ${totalLateExposure}</small>
          </div>
          <button disabled={requestState === "approving" || requestState === "requesting"} onClick={onRequest} type="button">
            {requestState === "approving" ? "Approving..." : requestState === "requesting" ? "Requesting..." : "Request tool"}
          </button>
        </div>

        <p className={`status ${requestState}`}>{message}</p>
      </div>
    </section>
  );
}

const fallbackMember = {
  address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  name: "Unknown member",
  neighborhood: "Unlisted",
  loansBorrowed: 0,
  lateReturns: 0,
};
