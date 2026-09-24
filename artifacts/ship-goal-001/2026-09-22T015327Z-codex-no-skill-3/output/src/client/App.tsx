import {
  ArrowDownUp,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Clock,
  Hammer,
  PackagePlus,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  TimerOff,
  Wallet,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  approveLoan,
  createTool,
  declineLoan,
  getState,
  requestLoan,
  returnLoan
} from "./api";
import { formatUsdcFixed } from "../shared/money";
import type { LoanWithDetails, MemberReputation, ToolWithOwner, ToolshedState } from "../shared/types";

type Tab = "browse" | "lend" | "loans" | "members";

const today = new Date().toISOString().slice(0, 10);

const initialToolForm = {
  name: "",
  category: "Home repair",
  photoUrl: "",
  conditionNotes: "",
  depositUsdc: "40",
  dailyLateFeeUsdc: "5"
};

export function App() {
  const [state, setState] = useState<ToolshedState | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [currentMemberId, setCurrentMemberId] = useState("m-ana");
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function loadState() {
    const nextState = await getState();
    setState(nextState);
    if (!nextState.members.some((member) => member.id === currentMemberId)) {
      setCurrentMemberId(nextState.members[0]?.id ?? "");
    }
  }

  useEffect(() => {
    loadState().catch((error: unknown) => setMessage(errorMessage(error)));
  }, []);

  const currentMember = state?.members.find((member) => member.id === currentMemberId) ?? state?.members[0];
  const wallet = state?.wallets.find((candidate) => candidate.memberId === currentMember?.id);
  const selectedTool = state?.tools.find((tool) => tool.id === selectedToolId) ?? state?.tools.find((tool) => tool.status === "available");
  const incomingRequests = useMemo(
    () =>
      state?.loans
        .filter((loan) => loan.status === "requested" && loan.ownerId === currentMember?.id)
        .sort((a, b) => b.borrower.reliabilityScore - a.borrower.reliabilityScore) ?? [],
    [state, currentMember?.id]
  );
  const activeLoans = state?.loans.filter((loan) => loan.status === "active") ?? [];

  async function runAction(action: () => Promise<unknown>, success: string) {
    setIsBusy(true);
    setMessage(null);
    try {
      await action();
      await loadState();
      setMessage(success);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  if (!state || !currentMember || !wallet) {
    return (
      <main className="loadingShell">
        <Hammer size={34} aria-hidden="true" />
        <span>Loading Toolshed</span>
      </main>
    );
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brandLockup">
          <div className="brandMark">
            <Hammer size={26} aria-hidden="true" />
          </div>
          <div>
            <h1>Toolshed</h1>
            <p>Neighborhood lending library</p>
          </div>
        </div>

        <label className="fieldLabel" htmlFor="member">
          Acting as
        </label>
        <select id="member" value={currentMember.id} onChange={(event) => setCurrentMemberId(event.target.value)}>
          {state.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>

        <div className="walletPanel">
          <div>
            <span>Available</span>
            <strong>{formatUsdcFixed(wallet.availableMicroUsdc)} USDC</strong>
          </div>
          <div>
            <span>Escrowed</span>
            <strong>{formatUsdcFixed(wallet.escrowedMicroUsdc)} USDC</strong>
          </div>
          <div>
            <span>Late fees earned</span>
            <strong>{formatUsdcFixed(wallet.earnedFeesMicroUsdc)} USDC</strong>
          </div>
        </div>

        <nav className="tabList" aria-label="Toolshed sections">
          <TabButton active={activeTab === "browse"} icon={<Hammer size={18} />} onClick={() => setActiveTab("browse")}>
            Browse
          </TabButton>
          <TabButton active={activeTab === "lend"} icon={<PackagePlus size={18} />} onClick={() => setActiveTab("lend")}>
            List tool
          </TabButton>
          <TabButton active={activeTab === "loans"} icon={<Clock size={18} />} onClick={() => setActiveTab("loans")}>
            Loans
          </TabButton>
          <TabButton active={activeTab === "members"} icon={<BadgeCheck size={18} />} onClick={() => setActiveTab("members")}>
            Members
          </TabButton>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">300-member association pilot</p>
            <h2>{headingFor(activeTab)}</h2>
          </div>
          <button className="iconButton" type="button" onClick={() => runAction(loadState, "Data refreshed.")} title="Refresh data">
            <RefreshCcw size={18} aria-hidden="true" />
          </button>
        </header>

        {message ? <div className="notice">{message}</div> : null}

        {activeTab === "browse" ? (
          <BrowsePanel
            tools={state.tools}
            selectedTool={selectedTool}
            selectedToolId={selectedTool?.id ?? ""}
            currentMember={currentMember}
            onSelectTool={setSelectedToolId}
            isBusy={isBusy}
            onRequest={(tool, startDate, dueDate) =>
              runAction(
                () => requestLoan({ toolId: tool.id, borrowerId: currentMember.id, startDate, dueDate }),
                "Request submitted and deposit moved into escrow."
              )
            }
          />
        ) : null}

        {activeTab === "lend" ? (
          <LendPanel
            currentMember={currentMember}
            isBusy={isBusy}
            onSubmit={(input) =>
              runAction(() => createTool({ ...input, ownerId: currentMember.id }), "Tool listed for the neighborhood.")
            }
          />
        ) : null}

        {activeTab === "loans" ? (
          <LoansPanel
            activeLoans={activeLoans}
            incomingRequests={incomingRequests}
            currentMember={currentMember}
            isBusy={isBusy}
            onApprove={(loan) => runAction(() => approveLoan(loan.id, { ownerId: currentMember.id }), "Request approved.")}
            onDecline={(loan) =>
              runAction(() => declineLoan(loan.id, { ownerId: currentMember.id }), "Request declined and deposit refunded.")
            }
            onReturn={(loan) =>
              runAction(() => returnLoan(loan.id, { returnedAt: new Date().toISOString() }), "Loan returned and escrow settled.")
            }
          />
        ) : null}

        {activeTab === "members" ? <MembersPanel members={state.members} /> : null}
      </section>
    </main>
  );
}

function BrowsePanel({
  tools,
  selectedTool,
  selectedToolId,
  currentMember,
  onSelectTool,
  onRequest,
  isBusy
}: {
  tools: ToolWithOwner[];
  selectedTool?: ToolWithOwner;
  selectedToolId: string;
  currentMember: MemberReputation;
  onSelectTool: (id: string) => void;
  onRequest: (tool: ToolWithOwner, startDate: string, dueDate: string) => void;
  isBusy: boolean;
}) {
  const [startDate, setStartDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDays(today, 3));
  const availableTools = tools.filter((tool) => tool.status === "available");

  return (
    <div className="browseGrid">
      <section className="toolList" aria-label="Tools sorted by owner reputation">
        <div className="sectionIntro">
          <h3>Available first, reliable owners first</h3>
          <span>
            <ArrowDownUp size={15} aria-hidden="true" /> reputation sorted
          </span>
        </div>
        <div className="cards">
          {tools.map((tool) => (
            <button
              className={`toolCard ${tool.id === selectedToolId ? "selected" : ""}`}
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
            >
              <img src={tool.photoUrl} alt="" />
              <div className="toolCardBody">
                <div className="rowBetween">
                  <span className={`statusPill ${tool.status}`}>{tool.status}</span>
                  <span className="score">{tool.owner.reliabilityScore}</span>
                </div>
                <h4>{tool.name}</h4>
                <p>{tool.category}</p>
                <small>{tool.owner.name}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="detailPanel">
        {selectedTool ? (
          <>
            <img className="detailImage" src={selectedTool.photoUrl} alt="" />
            <div className="detailBody">
              <div className="rowBetween">
                <span className={`statusPill ${selectedTool.status}`}>{selectedTool.status}</span>
                <span>{selectedTool.category}</span>
              </div>
              <h3>{selectedTool.name}</h3>
              <p>{selectedTool.conditionNotes}</p>
              <div className="metricGrid">
                <Metric icon={<CircleDollarSign size={18} />} label="Deposit" value={`${formatUsdcFixed(selectedTool.depositMicroUsdc)} USDC`} />
                <Metric icon={<TimerOff size={18} />} label="Daily late fee" value={`${formatUsdcFixed(selectedTool.dailyLateFeeMicroUsdc)} USDC`} />
                <Metric icon={<ShieldCheck size={18} />} label="Owner score" value={String(selectedTool.owner.reliabilityScore)} />
              </div>
              <div className="ownerStrip">
                <strong>{selectedTool.owner.name}</strong>
                <span>
                  {selectedTool.owner.completedLoans} loans, {selectedTool.owner.lateReturns} late
                </span>
              </div>
              <form
                className="borrowForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  onRequest(selectedTool, startDate, dueDate);
                }}
              >
                <label>
                  Start
                  <input type="date" value={startDate} min={today} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label>
                  Due
                  <input type="date" value={dueDate} min={startDate} onChange={(event) => setDueDate(event.target.value)} />
                </label>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={isBusy || selectedTool.status !== "available" || selectedTool.ownerId === currentMember.id}
                >
                  <Wallet size={18} aria-hidden="true" />
                  Request with deposit
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="emptyState">
            <Hammer size={30} aria-hidden="true" />
            <p>{availableTools.length === 0 ? "No tools are available right now." : "Select a tool to see details."}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function LendPanel({
  currentMember,
  isBusy,
  onSubmit
}: {
  currentMember: MemberReputation;
  isBusy: boolean;
  onSubmit: (input: typeof initialToolForm) => void;
}) {
  const [form, setForm] = useState(initialToolForm);

  function updateField(field: keyof typeof initialToolForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);
    setForm(initialToolForm);
  }

  return (
    <form className="formPanel" onSubmit={submit}>
      <div className="sectionIntro">
        <h3>List a tool from {currentMember.name}</h3>
        <span>Listing details</span>
      </div>
      <div className="formGrid">
        <label>
          Tool name
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Cordless impact driver" required />
        </label>
        <label>
          Category
          <input value={form.category} onChange={(event) => updateField("category", event.target.value)} required />
        </label>
        <label className="wide">
          Photo URL
          <input
            value={form.photoUrl}
            onChange={(event) => updateField("photoUrl", event.target.value)}
            placeholder="https://..."
            type="url"
            required
          />
        </label>
        <label className="wide">
          Condition notes
          <textarea
            value={form.conditionNotes}
            onChange={(event) => updateField("conditionNotes", event.target.value)}
            placeholder="Battery holds charge, chuck has cosmetic wear."
            required
          />
        </label>
        <label>
          Deposit, USDC
          <input value={form.depositUsdc} onChange={(event) => updateField("depositUsdc", event.target.value)} inputMode="decimal" required />
        </label>
        <label>
          Daily late fee, USDC
          <input
            value={form.dailyLateFeeUsdc}
            onChange={(event) => updateField("dailyLateFeeUsdc", event.target.value)}
            inputMode="decimal"
            required
          />
        </label>
      </div>
      <button className="primaryButton" type="submit" disabled={isBusy}>
        <PackagePlus size={18} aria-hidden="true" />
        Publish listing
      </button>
    </form>
  );
}

function LoansPanel({
  activeLoans,
  incomingRequests,
  currentMember,
  isBusy,
  onApprove,
  onDecline,
  onReturn
}: {
  activeLoans: LoanWithDetails[];
  incomingRequests: LoanWithDetails[];
  currentMember: MemberReputation;
  isBusy: boolean;
  onApprove: (loan: LoanWithDetails) => void;
  onDecline: (loan: LoanWithDetails) => void;
  onReturn: (loan: LoanWithDetails) => void;
}) {
  return (
    <div className="loanGrid">
      <section className="listPanel">
        <div className="sectionIntro">
          <h3>Incoming requests</h3>
          <span>best borrower score first</span>
        </div>
        {incomingRequests.length === 0 ? <p className="muted">No requests for tools you own.</p> : null}
        {incomingRequests.map((loan) => (
          <article className="loanRow" key={loan.id}>
            <img src={loan.tool.photoUrl} alt="" />
            <div>
              <strong>{loan.tool.name}</strong>
              <span>
                {loan.borrower.name} · score {loan.borrower.reliabilityScore} · {loan.borrower.lateReturns} late
              </span>
              <small>
                {loan.startDate} to {loan.dueDate} · {formatUsdcFixed(loan.depositMicroUsdc)} USDC escrow
              </small>
            </div>
            <div className="buttonPair">
              <button className="iconButton approve" type="button" onClick={() => onApprove(loan)} disabled={isBusy} title="Approve request">
                <Check size={18} aria-hidden="true" />
              </button>
              <button className="iconButton danger" type="button" onClick={() => onDecline(loan)} disabled={isBusy} title="Decline request">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="listPanel">
        <div className="sectionIntro">
          <h3>Active loans</h3>
          <span>escrow backed</span>
        </div>
        {activeLoans.length === 0 ? <p className="muted">No tools are currently borrowed.</p> : null}
        {activeLoans.map((loan) => (
          <article className="loanRow" key={loan.id}>
            <img src={loan.tool.photoUrl} alt="" />
            <div>
              <strong>{loan.tool.name}</strong>
              <span>
                {loan.borrower.name} borrowing from {loan.owner.name}
              </span>
              <small>
                due {loan.dueDate} · {formatUsdcFixed(loan.dailyLateFeeMicroUsdc)} USDC per late day
              </small>
            </div>
            <button
              className="iconButton"
              type="button"
              onClick={() => onReturn(loan)}
              disabled={isBusy || loan.borrowerId !== currentMember.id}
              title="Mark returned"
            >
              <RotateCcw size={18} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function MembersPanel({ members }: { members: MemberReputation[] }) {
  return (
    <section className="listPanel">
      <div className="sectionIntro">
        <h3>Member track records</h3>
        <span>used for request priority</span>
      </div>
      <div className="memberTable" role="table" aria-label="Member reputation">
        <div className="tableHeader" role="row">
          <span>Member</span>
          <span>Loans</span>
          <span>Late</span>
          <span>Score</span>
        </div>
        {members.map((member) => (
          <div className="tableRow" role="row" key={member.id}>
            <span>
              <strong>{member.name}</strong>
              <small>{member.block}</small>
            </span>
            <span>{member.completedLoans}</span>
            <span>{member.lateReturns}</span>
            <span>{member.reliabilityScore}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TabButton({
  active,
  icon,
  children,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={`tabButton ${active ? "active" : ""}`} type="button" onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

function headingFor(tab: Tab): string {
  return {
    browse: "Browse tools",
    lend: "List a tool",
    loans: "Requests and returns",
    members: "Reputation ledger"
  }[tab];
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
