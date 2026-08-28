import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserProvider, Contract, formatUnits, id, parseUnits } from "ethers";
import "./styles.css";

const ESCROW = import.meta.env.VITE_ESCROW_ADDRESS;
const USDC = import.meta.env.VITE_USDC_ADDRESS;
const escrowAbi = [
  "function isMember(address) view returns(bool)",
  "function completedLoans(address) view returns(uint256)",
  "function lateReturns(address) view returns(uint256)",
  "function requestLoan(bytes32,address,uint64,uint128,uint128) returns(uint256)",
  "function acceptLoan(uint256)",
  "function cancelRequest(uint256)",
  "function rejectRequest(uint256)",
  "function markReturned(uint256)",
  "function confirmReturn(uint256)",
  "event LoanRequested(uint256 indexed loanId,bytes32 indexed toolId,address indexed borrower,address lender,uint256 dueAt,uint256 deposit,uint256 lateFeePerDay)",
];
const erc20Abi = ["function approve(address,uint256) returns(bool)"];
function short(a) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "Owner not configured";
}

function App() {
  const [account, setAccount] = useState("");
  const [tools, setTools] = useState([]);
  const [notice, setNotice] = useState("");
  const [loanId, setLoanId] = useState("");
  const [scores, setScores] = useState({});
  const [form, setForm] = useState({
    name: "",
    owner: "",
    condition: "",
    image: "",
    deposit: "25",
    fee: "2",
  });
  const provider = useMemo(
    () => (window.ethereum ? new BrowserProvider(window.ethereum) : null),
    [],
  );

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then(setTools)
      .catch(() => setNotice("The listings API is offline."));
  }, []);
  useEffect(() => {
    if (!provider || !ESCROW || !account) return;
    const contract = new Contract(ESCROW, escrowAbi, provider);
    Promise.all(
      tools
        .filter((t) => t.owner)
        .map(async (t) => {
          const [loans, late] = await Promise.all([
            contract.completedLoans(t.owner),
            contract.lateReturns(t.owner),
          ]);
          return [
            t.owner.toLowerCase(),
            { loans: Number(loans), late: Number(late) },
          ];
        }),
    )
      .then((entries) => setScores(Object.fromEntries(entries)))
      .catch(() => {});
  }, [account, tools, provider]);

  async function connect() {
    if (!provider) return setNotice("Install a browser wallet first.");
    const [address] = await provider.send("eth_requestAccounts", []);
    setAccount(address);
    setForm((v) => ({ ...v, owner: v.owner || address }));
  }

  async function addTool(e) {
    e.preventDefault();
    const response = await fetch("/api/tools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json();
    if (!response.ok) return setNotice(body.error || "Could not list tool");
    setTools((v) => [body, ...v]);
    setForm((v) => ({ ...v, name: "", condition: "", image: "" }));
  }

  async function borrow(tool, days) {
    if (!ESCROW || !USDC)
      return setNotice("Set VITE_ESCROW_ADDRESS and VITE_USDC_ADDRESS first.");
    if (!account) return connect();
    if (!tool.owner)
      return setNotice(
        "This demo listing needs an owner address before it can be borrowed.",
      );
    try {
      const signer = await provider.getSigner();
      const deposit = parseUnits(tool.deposit, 6);
      setNotice("1/2 Approve the USDC deposit in your wallet…");
      await (
        await new Contract(USDC, erc20Abi, signer).approve(ESCROW, deposit)
      ).wait();
      setNotice("2/2 Place the loan request…");
      const due = Math.floor(Date.now() / 1000) + days * 86400;
      await (
        await new Contract(ESCROW, escrowAbi, signer).requestLoan(
          id(tool.id),
          tool.owner,
          due,
          deposit,
          parseUnits(tool.fee, 6),
        )
      ).wait();
      setNotice("Request sent. The owner can now accept it onchain.");
    } catch (error) {
      setNotice(error.shortMessage || error.message);
    }
  }

  async function act(method) {
    if (!account) return connect();
    if (!ESCROW || !loanId)
      return setNotice("Enter a loan ID and configure the escrow address.");
    try {
      setNotice("Confirm the transaction in your wallet…");
      const contract = new Contract(
        ESCROW,
        escrowAbi,
        await provider.getSigner(),
      );
      await (await contract[method](loanId)).wait();
      setNotice("Loan updated successfully.");
    } catch (error) {
      setNotice(error.shortMessage || error.message);
    }
  }

  const rankedTools = [...tools].sort((a, b) => {
    const sa = scores[a.owner?.toLowerCase()] || { loans: 0, late: 0 };
    const sb = scores[b.owner?.toLowerCase()] || { loans: 0, late: 0 };
    return sb.loans - sb.late - (sa.loans - sa.late) || sb.loans - sa.loans;
  });

  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">MAPLE STREET ASSOCIATION</span>
          <h1>Toolshed</h1>
          <p>
            Borrow nearby. Return on time. Keep useful things in circulation.
          </p>
        </div>
        <button onClick={connect}>
          {account ? short(account) : "Connect wallet"}
        </button>
      </header>
      {notice && (
        <aside onClick={() => setNotice("")}>
          {notice}
          <span>×</span>
        </aside>
      )}
      <section className="intro">
        <div>
          <b>{tools.length}</b>
          <span>tools shared</span>
        </div>
        <div>
          <b>USDC</b>
          <span>refundable deposits</span>
        </div>
        <div>
          <b>300</b>
          <span>neighbors, one shed</span>
        </div>
      </section>
      <div className="layout">
        <section>
          <div className="section-title">
            <div>
              <span className="eyebrow">AVAILABLE NEARBY</span>
              <h2>Find the right tool</h2>
            </div>
            <span>Sorted by owner reliability</span>
          </div>
          <div className="grid">
            {rankedTools.map((tool, i) => {
              const score = scores[tool.owner?.toLowerCase()] || {
                loans: 0,
                late: 0,
              };
              return (
                <article key={i}>
                  <img
                    src={
                      tool.image ||
                      "https://placehold.co/800x500/e7e1d2/383c2f?text=Tool"
                    }
                  />
                  <div className="card-body">
                    <span className="available">AVAILABLE</span>
                    <h3>{tool.name}</h3>
                    <p>{tool.condition}</p>
                    <div className="owner">
                      <span>{short(tool.owner)}</span>
                      <span>
                        ★ {score.loans} loans · {score.late} late
                      </span>
                    </div>
                    <div className="terms">
                      <span>
                        <b>${tool.deposit}</b> deposit
                      </span>
                      <span>
                        <b>${tool.fee}</b>/day late
                      </span>
                    </div>
                    <button onClick={() => borrow(tool, 3)}>
                      Request for 3 days
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <div>
          <form onSubmit={addTool}>
            <span className="eyebrow">ADD TO THE SHED</span>
            <h2>List your tool</h2>
            <label>
              What is it?
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Owner wallet
              <input
                required
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
              />
            </label>
            <label>
              Photo URL
              <input
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
              />
            </label>
            <label>
              Condition notes
              <textarea
                required
                value={form.condition}
                onChange={(e) =>
                  setForm({ ...form, condition: e.target.value })
                }
              />
            </label>
            <div className="pair">
              <label>
                Deposit ($)
                <input
                  value={form.deposit}
                  onChange={(e) =>
                    setForm({ ...form, deposit: e.target.value })
                  }
                />
              </label>
              <label>
                Late / day ($)
                <input
                  value={form.fee}
                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
                />
              </label>
            </div>
            <button>List tool</button>
            <small>
              Listings are shared by the association API. Escrow and loan
              history are onchain.
            </small>
          </form>
          <section className="manage">
            <span className="eyebrow">LOAN HANDOFF</span>
            <h2>Manage a loan</h2>
            <label>
              Loan ID
              <input
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
              />
            </label>
            <div className="actions">
              <button onClick={() => act("acceptLoan")}>Accept</button>
              <button onClick={() => act("markReturned")}>Mark returned</button>
              <button onClick={() => act("confirmReturn")}>
                Confirm & settle
              </button>
              <button onClick={() => act("cancelRequest")}>Cancel</button>
              <button onClick={() => act("rejectRequest")}>Reject</button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
