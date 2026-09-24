import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  Check,
  CircleDollarSign,
  Clock3,
  ImagePlus,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  UserPlus,
  Wrench
} from "lucide-react";
import {
  createBorrowRequest,
  createLoan,
  createMember,
  createTool,
  getBootstrap,
  updateBorrowRequest,
  updateLoan
} from "./api";
import { erc20Abi, escrowAbi, ESCROW_ADDRESS, EXPECTED_CHAIN_ID, USDC_ADDRESS } from "./contracts";

const blankListing = {
  name: "",
  category: "Power tools",
  conditionNotes: "",
  depositUsdc: "25",
  dailyLateFeeUsdc: "4",
  photoDataUrl: ""
};

const blankMember = {
  name: "",
  neighborhood: ""
};

function shortAddress(address = "") {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function dateToDueTimestamp(date) {
  return Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);
}

function lateDays(dueDate, returnedAt = new Date()) {
  const due = new Date(`${dueDate}T23:59:59Z`).getTime();
  const returned = new Date(returnedAt).getTime();
  if (returned <= due) return 0;
  return Math.ceil((returned - due) / 86_400_000);
}

function reputationLabel(reputation) {
  if (!reputation || reputation.completedLoans === 0) return "New member";
  if (reputation.lateReturns === 0) return "On-time";
  return `${reputation.lateReturns} late`;
}

function App() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [wallet, setWallet] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [listing, setListing] = useState(blankListing);
  const [member, setMember] = useState(blankMember);
  const [borrowForm, setBorrowForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    message: ""
  });

  async function refresh() {
    const next = await getBootstrap();
    setData(next);
  }

  useEffect(() => {
    refresh().catch((error) => setStatus(error.message));
  }, []);

  const membersByAddress = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(data.members.map((item) => [item.address.toLowerCase(), item]));
  }, [data]);

  const currentMember = wallet?.address ? membersByAddress[wallet.address.toLowerCase()] : null;

  const tools = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();
    return data.tools
      .filter((tool) => {
        const content = `${tool.name} ${tool.category} ${tool.conditionNotes}`.toLowerCase();
        return content.includes(normalized);
      })
      .sort((a, b) => {
        const scoreA = a.owner?.reputation?.score || 0;
        const scoreB = b.owner?.reputation?.score || 0;
        return scoreB - scoreA || a.name.localeCompare(b.name);
      });
  }, [data, query]);

  const activeLoans = useMemo(() => {
    if (!data) return [];
    return data.loans.filter((loan) => loan.status === "active");
  }, [data]);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Install a browser wallet to use escrow transactions.");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    setWallet({
      address: accounts[0],
      provider,
      chainId: Number(network.chainId)
    });
  }

  async function addMember(event) {
    event.preventDefault();
    if (!wallet?.address) {
      setStatus("Connect a wallet before joining.");
      return;
    }
    await createMember({ ...member, address: wallet.address });
    setMember(blankMember);
    setStatus("Member added.");
    await refresh();
  }

  async function addTool(event) {
    event.preventDefault();
    if (!wallet?.address) {
      setStatus("Connect a wallet before listing a tool.");
      return;
    }
    await createTool({ ...listing, ownerAddress: wallet.address });
    setListing(blankListing);
    setStatus("Tool listed.");
    await refresh();
  }

  async function choosePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setListing((current) => ({ ...current, photoDataUrl: reader.result }));
    reader.readAsDataURL(file);
  }

  async function requestTool(event) {
    event.preventDefault();
    if (!wallet?.address || !selectedTool) return;
    await createBorrowRequest({
      ...borrowForm,
      toolId: selectedTool.id,
      borrowerAddress: wallet.address
    });
    setSelectedTool(null);
    setBorrowForm((current) => ({ ...current, message: "" }));
    setStatus("Borrow request sent.");
    await refresh();
  }

  async function approveRequest(borrowRequest) {
    await updateBorrowRequest(borrowRequest.id, { status: "approved" });
    setStatus("Request approved.");
    await refresh();
  }

  async function approveAndOpenLoan(borrowRequest) {
    if (!wallet?.provider || !ESCROW_ADDRESS) {
      setStatus("Set VITE_TOOLSHED_ESCROW_ADDRESS before opening escrow loans.");
      return;
    }
    if (wallet.chainId !== EXPECTED_CHAIN_ID) {
      setStatus(`Switch wallet to chain ${EXPECTED_CHAIN_ID}.`);
      return;
    }

    const signer = await wallet.provider.getSigner();
    const tool = borrowRequest.tool;
    const deposit = ethers.parseUnits(tool.depositUsdc, 6);
    const lateFee = ethers.parseUnits(tool.dailyLateFeeUsdc, 6);
    const dueAt = dateToDueTimestamp(borrowRequest.dueDate);
    const token = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);
    const escrow = new ethers.Contract(ESCROW_ADDRESS, escrowAbi, signer);

    setStatus("Approving USDC deposit...");
    const allowance = await token.allowance(wallet.address, ESCROW_ADDRESS);
    if (allowance < deposit) {
      const approval = await token.approve(ESCROW_ADDRESS, deposit);
      await approval.wait();
    }

    setStatus("Opening escrow loan...");
    const tx = await escrow.openLoan(ethers.id(tool.id), tool.ownerAddress, dueAt, deposit, lateFee);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map((log) => {
        try {
          return escrow.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.name === "LoanOpened");
    const escrowLoanId = event ? event.args.loanId.toString() : "";

    await updateBorrowRequest(borrowRequest.id, {
      status: "escrowed",
      escrowLoanId,
      txHash: receipt.hash
    });
    await createLoan({
      toolId: tool.id,
      ownerAddress: tool.ownerAddress,
      borrowerAddress: borrowRequest.borrowerAddress,
      dueDate: borrowRequest.dueDate,
      depositUsdc: tool.depositUsdc,
      dailyLateFeeUsdc: tool.dailyLateFeeUsdc,
      escrowLoanId,
      txHash: receipt.hash
    });
    setStatus(`Escrow loan ${escrowLoanId || "opened"} recorded.`);
    await refresh();
  }

  async function markReturned(loan) {
    const returnedAt = new Date();
    const computedLateDays = lateDays(loan.dueDate, returnedAt);

    if (wallet?.provider && ESCROW_ADDRESS && loan.escrowLoanId) {
      const signer = await wallet.provider.getSigner();
      const escrow = new ethers.Contract(ESCROW_ADDRESS, escrowAbi, signer);
      setStatus("Settling escrow return...");
      const tx = await escrow.settleReturn(loan.escrowLoanId);
      const receipt = await tx.wait();
      await updateLoan(loan.id, {
        status: "returned",
        returnedAt: returnedAt.toISOString(),
        lateDays: computedLateDays,
        settleTxHash: receipt.hash
      });
    } else {
      await updateLoan(loan.id, {
        status: "returned",
        returnedAt: returnedAt.toISOString(),
        lateDays: computedLateDays
      });
    }

    setStatus("Loan returned.");
    await refresh();
  }

  if (!data) {
    return <main className="loading">Loading Toolshed...</main>;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Neighborhood Association</p>
          <h1>Toolshed</h1>
        </div>
        <div className="walletPanel">
          {wallet ? (
            <span className="wallet">{shortAddress(wallet.address)}</span>
          ) : (
            <button className="primaryButton" onClick={connectWallet}>
              <PlugZap size={18} /> Connect
            </button>
          )}
          <button className="iconButton" onClick={refresh} title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      {status ? <div className="status">{status}</div> : null}

      <section className="metrics">
        <Metric label="Tools" value={data.tools.length} />
        <Metric label="Pending" value={data.requests.filter((item) => item.status === "pending").length} />
        <Metric label="Active" value={activeLoans.length} />
        <Metric label="Members" value={data.members.length} />
      </section>

      <section className="workspace">
        <div className="catalog">
          <div className="sectionHeader">
            <div>
              <h2>Browse</h2>
              <span>{tools.length} tools</span>
            </div>
            <label className="search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools" />
            </label>
          </div>

          <div className="toolGrid">
            {tools.map((tool) => (
              <article className="toolCard" key={tool.id}>
                <img
                  src={tool.photoDataUrl || "/tools-workbench.png"}
                  alt={tool.name}
                  className="toolPhoto"
                />
                <div className="toolBody">
                  <div className="toolTitle">
                    <h3>{tool.name}</h3>
                    <span className={tool.available ? "badge" : "badge muted"}>
                      {tool.available ? "Available" : "Loaned"}
                    </span>
                  </div>
                  <p>{tool.conditionNotes}</p>
                  <div className="toolFacts">
                    <span><CircleDollarSign size={16} /> {tool.depositUsdc} deposit</span>
                    <span><Clock3 size={16} /> {tool.dailyLateFeeUsdc}/day</span>
                  </div>
                  <div className="ownerRow">
                    <ShieldCheck size={16} />
                    <span>{tool.owner?.name || shortAddress(tool.ownerAddress)}</span>
                    <strong>{reputationLabel(tool.owner?.reputation)}</strong>
                  </div>
                  <button
                    className="secondaryButton"
                    disabled={!wallet || !tool.available || wallet.address.toLowerCase() === tool.ownerAddress.toLowerCase()}
                    onClick={() => setSelectedTool(tool)}
                  >
                    <Wrench size={18} /> Request
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="sideRail">
          {!currentMember ? (
            <form className="panel" onSubmit={addMember}>
              <div className="panelTitle">
                <UserPlus size={18} />
                <h2>Join</h2>
              </div>
              <input
                required
                value={member.name}
                onChange={(event) => setMember({ ...member, name: event.target.value })}
                placeholder="Name"
              />
              <input
                value={member.neighborhood}
                onChange={(event) => setMember({ ...member, neighborhood: event.target.value })}
                placeholder="Block or street"
              />
              <button className="primaryButton" disabled={!wallet}>
                <UserPlus size={18} /> Add member
              </button>
            </form>
          ) : null}

          <form className="panel" onSubmit={addTool}>
            <div className="panelTitle">
              <Upload size={18} />
              <h2>List Tool</h2>
            </div>
            <input
              required
              value={listing.name}
              onChange={(event) => setListing({ ...listing, name: event.target.value })}
              placeholder="Tool name"
            />
            <input
              value={listing.category}
              onChange={(event) => setListing({ ...listing, category: event.target.value })}
              placeholder="Category"
            />
            <textarea
              required
              value={listing.conditionNotes}
              onChange={(event) => setListing({ ...listing, conditionNotes: event.target.value })}
              placeholder="Condition notes"
            />
            <div className="moneyFields">
              <input
                required
                value={listing.depositUsdc}
                onChange={(event) => setListing({ ...listing, depositUsdc: event.target.value })}
                placeholder="Deposit"
              />
              <input
                required
                value={listing.dailyLateFeeUsdc}
                onChange={(event) => setListing({ ...listing, dailyLateFeeUsdc: event.target.value })}
                placeholder="Late fee"
              />
            </div>
            <label className="fileButton">
              <ImagePlus size={18} />
              <span>{listing.photoDataUrl ? "Photo ready" : "Photo"}</span>
              <input type="file" accept="image/*" onChange={choosePhoto} />
            </label>
            <button className="primaryButton" disabled={!wallet}>
              <Upload size={18} /> Publish
            </button>
          </form>

          <section className="panel">
            <div className="panelTitle">
              <ShieldCheck size={18} />
              <h2>Request Queue</h2>
            </div>
            <div className="queue">
              {data.requests.filter((item) => ["pending", "approved"].includes(item.status)).map((request) => (
                <article className="queueItem" key={request.id}>
                  <strong>{request.tool?.name || "Tool"}</strong>
                  <span>{request.borrower?.name || shortAddress(request.borrowerAddress)}</span>
                  <small>
                    {request.borrower?.reputation.completedLoans || 0} loans,
                    {" "}{request.borrower?.reputation.lateReturns || 0} late
                  </small>
                  {request.status === "pending" ? (
                    <button
                      className="secondaryButton"
                      disabled={!wallet || wallet.address.toLowerCase() !== request.tool?.ownerAddress.toLowerCase()}
                      onClick={() => approveRequest(request)}
                    >
                      <Check size={18} /> Approve
                    </button>
                  ) : (
                    <button
                      className="secondaryButton"
                      disabled={!wallet || wallet.address.toLowerCase() !== request.borrowerAddress.toLowerCase()}
                      onClick={() => approveAndOpenLoan(request)}
                    >
                      <CircleDollarSign size={18} /> Deposit
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panelTitle">
              <Clock3 size={18} />
              <h2>Active Loans</h2>
            </div>
            <div className="queue">
              {activeLoans.map((loan) => (
                <article className="queueItem" key={loan.id}>
                  <strong>{data.tools.find((tool) => tool.id === loan.toolId)?.name || "Tool"}</strong>
                  <span>Due {loan.dueDate}</span>
                  <small>{loan.depositUsdc} USDC held</small>
                  <button
                    className="secondaryButton"
                    disabled={!wallet || wallet.address.toLowerCase() !== loan.ownerAddress.toLowerCase()}
                    onClick={() => markReturned(loan)}
                  >
                    <Check size={18} /> Returned
                  </button>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>

      {selectedTool ? (
        <div className="modalBackdrop" onClick={() => setSelectedTool(null)}>
          <form className="modal" onSubmit={requestTool} onClick={(event) => event.stopPropagation()}>
            <h2>{selectedTool.name}</h2>
            <div className="moneyFields">
              <input
                type="date"
                required
                value={borrowForm.startDate}
                onChange={(event) => setBorrowForm({ ...borrowForm, startDate: event.target.value })}
              />
              <input
                type="date"
                required
                value={borrowForm.dueDate}
                onChange={(event) => setBorrowForm({ ...borrowForm, dueDate: event.target.value })}
              />
            </div>
            <textarea
              value={borrowForm.message}
              onChange={(event) => setBorrowForm({ ...borrowForm, message: event.target.value })}
              placeholder="Message to owner"
            />
            <div className="modalActions">
              <button type="button" className="ghostButton" onClick={() => setSelectedTool(null)}>Cancel</button>
              <button className="primaryButton"><Wrench size={18} /> Request</button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
