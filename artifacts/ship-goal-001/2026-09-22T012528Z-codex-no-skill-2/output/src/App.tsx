import { FormEvent, useMemo, useState } from "react";
import {
  ArrowDownUp,
  BadgeDollarSign,
  Check,
  Clock,
  HandCoins,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Wrench,
  X,
} from "lucide-react";
import { seedState } from "./data/seed";
import {
  addDays,
  calculateReturnSettlement,
  createLoanRequest,
  roundUsdc,
} from "./domain/lending";
import {
  compareBorrowersByReputation,
  onTimeRate,
  reputationLabel,
  reputationScore,
} from "./domain/reputation";
import type { AppState, LoanRequest, Member, Tool, ToolCondition } from "./domain/types";

const storageKey = "toolshed-state-v1";
const todayIso = "2026-09-22T12:00:00.000Z";

const conditions: ToolCondition[] = ["Excellent", "Good", "Working", "Needs care"];

function loadState(): AppState {
  const stored = window.localStorage.getItem(storageKey);
  return stored ? JSON.parse(stored) : seedState;
}

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [activeMemberId, setActiveMemberId] = useState("m-devon");
  const [query, setQuery] = useState("");
  const [selectedToolId, setSelectedToolId] = useState("t-compound-miter");
  const [requestDays, setRequestDays] = useState(3);
  const [returnOffsetDays, setReturnOffsetDays] = useState(0);
  const [newTool, setNewTool] = useState({
    name: "",
    category: "Shared",
    photoUrl: "",
    condition: "Good" as ToolCondition,
    conditionNotes: "",
    depositUsdc: 50,
    lateFeeUsdcPerDay: 8,
  });

  function commit(nextState: AppState) {
    setState(nextState);
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  }

  const activeMember = state.members.find((member) => member.id === activeMemberId)!;
  const selectedTool = state.tools.find((tool) => tool.id === selectedToolId) ?? state.tools[0];
  const activeLoans = state.requests.filter((request) => request.status === "active");
  const openRequests = state.requests.filter((request) => request.status === "requested");

  const filteredTools = useMemo(() => {
    const lowered = query.trim().toLowerCase();

    return state.tools
      .filter((tool) => {
        if (!lowered) return true;
        return [tool.name, tool.category, tool.conditionNotes]
          .join(" ")
          .toLowerCase()
          .includes(lowered);
      })
      .sort((a, b) => {
        if (a.availability !== b.availability) {
          return a.availability === "available" ? -1 : 1;
        }

        return bestRequesterScore(b.id) - bestRequesterScore(a.id);
      });
  }, [query, state.requests, state.tools, state.members]);

  const selectedRequests = openRequests
    .filter((request) => request.toolId === selectedTool.id)
    .sort((a, b) =>
      compareBorrowersByReputation(memberForRequest(a, state.members), memberForRequest(b, state.members)),
    );

  function bestRequesterScore(toolId: string) {
    const requests = openRequests.filter((request) => request.toolId === toolId);
    if (requests.length === 0) return 0;

    return Math.max(
      ...requests.map((request) => reputationScore(memberForRequest(request, state.members).stats)),
    );
  }

  function memberForRequest(request: LoanRequest, members: Member[]) {
    return members.find((member) => member.id === request.borrowerId)!;
  }

  function ownerForTool(tool: Tool) {
    return state.members.find((member) => member.id === tool.ownerId)!;
  }

  function requestsForTool(toolId: string) {
    return openRequests.filter((request) => request.toolId === toolId).length;
  }

  function requestTool() {
    if (!selectedTool || selectedTool.ownerId === activeMember.id || selectedTool.availability !== "available") {
      return;
    }

    const existingRequest = openRequests.find(
      (request) => request.toolId === selectedTool.id && request.borrowerId === activeMember.id,
    );

    if (existingRequest) {
      return;
    }

    const id = `r-${crypto.randomUUID()}`;
    const { request, ledgerEntry } = createLoanRequest(
      id,
      selectedTool,
      activeMember,
      requestDays,
      new Date().toISOString(),
    );

    commit({
      ...state,
      requests: [...state.requests, request],
      ledger: [...state.ledger, ledgerEntry],
    });
  }

  function approveRequest(requestId: string) {
    const request = state.requests.find((item) => item.id === requestId);
    if (!request) return;

    const approvedAt = new Date().toISOString();
    const dueAt = addDays(approvedAt, request.requestedDays);

    commit({
      ...state,
      tools: state.tools.map((tool) =>
        tool.id === request.toolId ? { ...tool, availability: "loaned" } : tool,
      ),
      requests: state.requests.map((item) => {
        if (item.id === requestId) {
          return { ...item, status: "active", approvedAt, dueAt };
        }

        if (item.toolId === request.toolId && item.status === "requested") {
          return { ...item, status: "declined" };
        }

        return item;
      }),
    });
  }

  function returnLoan(requestId: string) {
    const request = state.requests.find((item) => item.id === requestId);
    if (!request) return;

    const tool = state.tools.find((item) => item.id === request.toolId)!;
    const returnedAt = addDays(request.dueAt ?? todayIso, returnOffsetDays);
    const settlement = calculateReturnSettlement(request, returnedAt);
    const now = new Date().toISOString();

    commit({
      ...state,
      tools: state.tools.map((item) =>
        item.id === request.toolId ? { ...item, availability: "available" } : item,
      ),
      members: state.members.map((member) => {
        if (member.id !== request.borrowerId) return member;

        return {
          ...member,
          stats: {
            completedLoans: member.stats.completedLoans + 1,
            lateReturns: member.stats.lateReturns + (settlement.lateDays > 0 ? 1 : 0),
            totalLateDays: member.stats.totalLateDays + settlement.lateDays,
            depositsForfeitedUsdc: roundUsdc(
              member.stats.depositsForfeitedUsdc + settlement.feePaidUsdc,
            ),
          },
        };
      }),
      requests: state.requests.map((item) =>
        item.id === requestId
          ? { ...item, status: "returned", returnedAt, ...settlement }
          : item,
      ),
      ledger: [
        ...state.ledger,
        {
          id: `${requestId}-refund-${now}`,
          at: now,
          type: "refund",
          requestId,
          toMemberId: request.borrowerId,
          amountUsdc: settlement.refundUsdc,
          memo: `${settlement.refundUsdc} USDC returned to borrower.`,
        },
        ...(settlement.feePaidUsdc > 0
          ? [
              {
                id: `${requestId}-fee-${now}`,
                at: now,
                type: "late_fee" as const,
                requestId,
                fromMemberId: request.borrowerId,
                toMemberId: tool.ownerId,
                amountUsdc: settlement.feePaidUsdc,
                memo: `${settlement.feePaidUsdc} USDC late fee paid to owner.`,
              },
            ]
          : []),
      ],
    });
  }

  function addTool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const id = `t-${crypto.randomUUID()}`;
    const tool: Tool = {
      id,
      ownerId: activeMember.id,
      name: newTool.name,
      category: newTool.category,
      photoUrl:
        newTool.photoUrl ||
        "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=900&q=80",
      condition: newTool.condition,
      conditionNotes: newTool.conditionNotes,
      depositUsdc: Number(newTool.depositUsdc),
      lateFeeUsdcPerDay: Number(newTool.lateFeeUsdcPerDay),
      availability: "available",
    };

    commit({ ...state, tools: [tool, ...state.tools] });
    setSelectedToolId(id);
    setNewTool({
      name: "",
      category: "Shared",
      photoUrl: "",
      condition: "Good",
      conditionNotes: "",
      depositUsdc: 50,
      lateFeeUsdcPerDay: 8,
    });
  }

  function resetDemo() {
    window.localStorage.removeItem(storageKey);
    setState(seedState);
    setSelectedToolId("t-compound-miter");
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Wrench size={24} aria-hidden />
          </div>
          <div>
            <h1>Toolshed</h1>
            <p>Neighborhood tool lending with USDC deposits and reputation-first queues.</p>
          </div>
        </div>

        <label className="member-switcher">
          <span>Acting as</span>
          <select value={activeMemberId} onChange={(event) => setActiveMemberId(event.target.value)}>
            {state.members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="summary-grid" aria-label="Toolshed summary">
        <Metric icon={<PackageCheck size={18} />} label="Tools listed" value={state.tools.length} />
        <Metric icon={<Clock size={18} />} label="Open requests" value={openRequests.length} />
        <Metric icon={<HandCoins size={18} />} label="Active deposits" value={`$${escrowTotal(state)} USDC`} />
        <Metric
          icon={<ShieldCheck size={18} />}
          label="Your score"
          value={reputationScore(activeMember.stats)}
        />
      </section>

      <div className="workspace">
        <section className="browse-panel" aria-labelledby="browse-heading">
          <div className="section-heading">
            <div>
              <h2 id="browse-heading">Browse</h2>
              <p>Available tools rise first; tools with stronger borrower queues rise within each state.</p>
            </div>
            <button className="ghost-button" onClick={resetDemo} type="button">
              <RotateCcw size={16} />
              Reset
            </button>
          </div>

          <label className="searchbox">
            <Search size={16} />
            <input
              placeholder="Search tools, categories, notes"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="tool-list">
            {filteredTools.map((tool) => (
              <button
                className={`tool-row ${tool.id === selectedTool.id ? "selected" : ""}`}
                key={tool.id}
                onClick={() => setSelectedToolId(tool.id)}
                type="button"
              >
                <img src={tool.photoUrl} alt="" />
                <span>
                  <strong>{tool.name}</strong>
                  <small>
                    {tool.category} · {ownerForTool(tool).name}
                  </small>
                </span>
                <StatusPill status={tool.availability} count={requestsForTool(tool.id)} />
              </button>
            ))}
          </div>
        </section>

        <section className="detail-panel" aria-labelledby="tool-heading">
          <div className="tool-hero">
            <img src={selectedTool.photoUrl} alt="" />
            <div className="tool-hero-copy">
              <span className="eyebrow">{selectedTool.category}</span>
              <h2 id="tool-heading">{selectedTool.name}</h2>
              <p>{selectedTool.conditionNotes}</p>
              <div className="tool-meta">
                <Badge text={selectedTool.condition} />
                <Badge text={`${selectedTool.depositUsdc} USDC deposit`} />
                <Badge text={`${selectedTool.lateFeeUsdcPerDay} USDC/day late`} />
              </div>
            </div>
          </div>

          <div className="split">
            <div className="owner-panel">
              <h3>Owner</h3>
              <MemberCard member={ownerForTool(selectedTool)} />
            </div>

            <div className="request-panel">
              <h3>Borrow</h3>
              {selectedTool.ownerId === activeMember.id ? (
                <p className="muted">You own this tool.</p>
              ) : selectedTool.availability !== "available" ? (
                <p className="muted">This tool is currently out.</p>
              ) : (
                <>
                  <label className="days-control">
                    <span>Days</span>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={requestDays}
                      onChange={(event) => setRequestDays(Number(event.target.value))}
                    />
                  </label>
                  <button className="primary-button" type="button" onClick={requestTool}>
                    <BadgeDollarSign size={18} />
                    Deposit {selectedTool.depositUsdc} USDC
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="queue-panel">
            <div className="section-heading compact">
              <div>
                <h3>Borrower Queue</h3>
                <p>Sorted by track record so reliable members get considered first.</p>
              </div>
              <ArrowDownUp size={18} aria-hidden />
            </div>

            {selectedRequests.length === 0 ? (
              <p className="empty">No pending requests for this tool.</p>
            ) : (
              <div className="queue-list">
                {selectedRequests.map((request) => {
                  const borrower = memberForRequest(request, state.members);
                  const ownsTool = selectedTool.ownerId === activeMember.id;

                  return (
                    <article className="queue-item" key={request.id}>
                      <MemberCard member={borrower} />
                      <div className="queue-terms">
                        <strong>{request.requestedDays} days</strong>
                        <span>{request.depositUsdc} USDC escrowed</span>
                      </div>
                      {ownsTool ? (
                        <button className="icon-button accept" onClick={() => approveRequest(request.id)} type="button">
                          <Check size={18} />
                          Approve
                        </button>
                      ) : (
                        <span className="muted">Owner approval</span>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="queue-panel">
            <h3>Active Loans</h3>
            {activeLoans.length === 0 ? (
              <p className="empty">No active loans.</p>
            ) : (
              <div className="loan-list">
                {activeLoans.map((request) => {
                  const tool = state.tools.find((item) => item.id === request.toolId)!;
                  const borrower = memberForRequest(request, state.members);
                  const canReturn = request.borrowerId === activeMember.id || tool.ownerId === activeMember.id;

                  return (
                    <article className="loan-row" key={request.id}>
                      <div>
                        <strong>{tool.name}</strong>
                        <small>
                          {borrower.name} · due {formatDate(request.dueAt)}
                        </small>
                      </div>
                      <label className="late-control">
                        <span>Return offset</span>
                        <input
                          type="number"
                          value={returnOffsetDays}
                          onChange={(event) => setReturnOffsetDays(Number(event.target.value))}
                        />
                      </label>
                      <button
                        className="secondary-button"
                        disabled={!canReturn}
                        onClick={() => returnLoan(request.id)}
                        type="button"
                      >
                        <PackageCheck size={16} />
                        Return
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="side-panel">
          <section>
            <h2>Member Reputation</h2>
            <div className="member-list">
              {[...state.members].sort(compareBorrowersByReputation).map((member) => (
                <MemberCard member={member} key={member.id} />
              ))}
            </div>
          </section>

          <section>
            <h2>Add Tool</h2>
            <form className="add-form" onSubmit={addTool}>
              <input
                required
                placeholder="Tool name"
                value={newTool.name}
                onChange={(event) => setNewTool({ ...newTool, name: event.target.value })}
              />
              <input
                required
                placeholder="Category"
                value={newTool.category}
                onChange={(event) => setNewTool({ ...newTool, category: event.target.value })}
              />
              <input
                placeholder="Photo URL"
                value={newTool.photoUrl}
                onChange={(event) => setNewTool({ ...newTool, photoUrl: event.target.value })}
              />
              <select
                value={newTool.condition}
                onChange={(event) =>
                  setNewTool({ ...newTool, condition: event.target.value as ToolCondition })
                }
              >
                {conditions.map((condition) => (
                  <option key={condition}>{condition}</option>
                ))}
              </select>
              <textarea
                required
                placeholder="Condition notes"
                value={newTool.conditionNotes}
                onChange={(event) => setNewTool({ ...newTool, conditionNotes: event.target.value })}
              />
              <div className="number-grid">
                <label>
                  <span>Deposit</span>
                  <input
                    type="number"
                    min={1}
                    value={newTool.depositUsdc}
                    onChange={(event) =>
                      setNewTool({ ...newTool, depositUsdc: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>Late/day</span>
                  <input
                    type="number"
                    min={1}
                    value={newTool.lateFeeUsdcPerDay}
                    onChange={(event) =>
                      setNewTool({ ...newTool, lateFeeUsdcPerDay: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <button className="primary-button" type="submit">
                <Plus size={18} />
                List Tool
              </button>
            </form>
          </section>

          <section>
            <h2>USDC Ledger</h2>
            <div className="ledger-list">
              {[...state.ledger].reverse().slice(0, 8).map((entry) => (
                <article className="ledger-row" key={entry.id}>
                  <span className={`ledger-dot ${entry.type}`} />
                  <div>
                    <strong>{entry.amountUsdc} USDC</strong>
                    <small>{entry.memo}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function MemberCard({ member }: { member: Member }) {
  const score = reputationScore(member.stats);

  return (
    <article className="member-card">
      <div className="avatar">{member.name.slice(0, 1)}</div>
      <div className="member-card-copy">
        <strong>{member.name}</strong>
        <small>
          {member.stats.completedLoans} loans · {member.stats.lateReturns} late ·{" "}
          {Math.round(onTimeRate(member.stats) * 100)}% on time
        </small>
      </div>
      <span className={`score score-${reputationLabel(member.stats).toLowerCase()}`}>
        <Star size={13} />
        {score}
      </span>
    </article>
  );
}

function StatusPill({ status, count }: { status: Tool["availability"]; count: number }) {
  return (
    <span className={`status-pill ${status}`}>
      {status === "available" ? `${count} asks` : "out"}
    </span>
  );
}

function Badge({ text }: { text: string }) {
  return <span className="badge">{text}</span>;
}

function escrowTotal(state: AppState) {
  const escrowed = state.ledger
    .filter((entry) => entry.type === "escrow")
    .reduce((sum, entry) => sum + entry.amountUsdc, 0);
  const released = state.ledger
    .filter((entry) => entry.type === "refund" || entry.type === "late_fee")
    .reduce((sum, entry) => sum + entry.amountUsdc, 0);

  return roundUsdc(escrowed - released);
}

function formatDate(value?: string) {
  if (!value) return "pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export default App;
