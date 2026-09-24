"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { getAddress, isAddress, type Address } from "viem";
import { TxButton } from "@/components/TxButton";
import { TrackRecordBadge } from "@/components/TrackRecordBadge";
import { ConfigWarning } from "@/components/ConfigWarning";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { useMembership } from "@/hooks/useToolshed";
import { useRoster } from "@/hooks/useRoster";
import { LOAN_STATUS_LABEL, LoanStatus, OPEN_LOAN_STATUSES, toolshed, type Loan } from "@/lib/contracts";
import { formatUsdc, parseUsdc, shortAddress } from "@/lib/format";

/**
 * The association's admin screen: who is on the roster, and the two levers the steward has —
 * admitting/suspending members, and splitting a disputed deposit. The steward cannot move money
 * anywhere except between a loan's own borrower and its tool owner.
 */
export default function StewardPage() {
  const { isConnected } = useAccount();
  const { isSteward, steward } = useMembership();
  const { rows, isLoading, error } = useRoster();
  const memberCount = useReadContract({ ...toolshed, functionName: "memberCount" });
  const paused = useReadContract({ ...toolshed, functionName: "paused" });

  if (!isConnected) {
    return (
      <ConnectPrompt>
        This screen is for the association steward{steward ? ` (${shortAddress(steward)})` : ""}. Connect that wallet
        to admit members or resolve a dispute.
      </ConnectPrompt>
    );
  }

  if (!isSteward) {
    return (
      <div className="card p-6 text-sm text-shed-600">
        Only the association steward{steward ? ` (${shortAddress(steward)})` : ""} can admit members or resolve a
        dispute. You are connected as someone else.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ConfigWarning />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Steward</h1>
        <p className="text-sm text-shed-600">
          {Number(memberCount.data ?? 0n)} members on the roster
          {paused.data ? " · new activity is paused" : ""}
        </p>
      </header>

      <AdmitMembers roster={rows} />
      <Roster rows={rows} isLoading={isLoading} error={error} />
      <ResolveDispute />
      <EmergencyStop paused={!!paused.data} />
      <Housekeeping />
    </div>
  );
}

function AdmitMembers({ roster }: { roster: ReturnType<typeof useRoster>["rows"] }) {
  const [text, setText] = useState("");
  const candidates = text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = candidates.filter((c) => !isAddress(c, { strict: false }));
  // Checksum the input and drop duplicates, so pasting the whole roster again does not revert the
  // batch with AlreadyAMember.
  const alreadyActive = new Set(roster.filter((r) => r.active).map((r) => r.address.toLowerCase()));
  const seen = new Set<string>();
  const valid: Address[] = [];
  const skipped: string[] = [];
  for (const candidate of candidates) {
    if (!isAddress(candidate, { strict: false })) continue;
    const normalised = getAddress(candidate);
    const key = normalised.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (alreadyActive.has(key)) skipped.push(normalised);
    else valid.push(normalised);
  }

  return (
    <section className="card p-4">
      <h2 className="mb-1 text-lg font-semibold">Admit members</h2>
      <p className="mb-3 text-sm text-shed-600">
        One address per line, or pasted in any separated form. Only members can list tools or borrow. ENS names are
        not resolved here — paste addresses.
      </p>
      <label>
        <span className="label">Member addresses</span>
        <textarea
          className="input font-mono text-xs"
          rows={4}
          placeholder="0xabc…&#10;0xdef…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {invalid.length > 0 && (
        <p className="mt-2 text-xs text-red-700">Not valid addresses: {invalid.slice(0, 3).join(", ")}</p>
      )}
      {skipped.length > 0 && (
        <p className="mt-2 text-xs text-shed-600">
          Already on the roster, so they will be skipped: {skipped.map(shortAddress).join(", ")}
        </p>
      )}
      <div className="mt-3">
        <TxButton
          functionName="admitMembers"
          args={[valid]}
          disabled={valid.length === 0 || invalid.length > 0}
          pendingLabel="Admitting…"
          onDone={() => setText("")}
        >
          {valid.length === 0 ? "Admit members" : valid.length === 1 ? "Admit 1 member" : `Admit ${valid.length} members`}
        </TxButton>
      </div>
    </section>
  );
}

function Roster({
  rows,
  isLoading,
  error,
}: {
  rows: ReturnType<typeof useRoster>["rows"];
  isLoading: boolean;
  error: unknown;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Roster</h2>
      <p className="mb-3 text-sm text-shed-600">Sorted by track record, best first.</p>
      {isLoading && <p className="text-sm text-shed-600">Reading membership history…</p>}
      {!!error && (
        <p className="text-sm text-red-700">
          Could not read the roster from logs. Set NEXT_PUBLIC_DEPLOY_BLOCK, or use an RPC that serves event logs.
        </p>
      )}
      {!isLoading && !error && rows.length === 0 && (
        <p className="card p-4 text-sm text-shed-600">
          Nobody has been admitted yet. Paste the association&apos;s addresses above to start the roster. (If you know
          there are members, check that NEXT_PUBLIC_DEPLOY_BLOCK is not set past their admission.)
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.address} className="card flex flex-wrap items-center gap-3 p-3">
            <div className="flex-1">
              {/* Owner framing: on the roster a member's lending matters as much as their borrowing. */}
              <TrackRecordBadge record={row.record} address={row.address} as="owner" />
              {!row.active && <p className="mt-1 text-xs text-amber-800">Suspended</p>}
            </div>
            {row.active ? (
              <TxButton
                functionName="suspendMember"
                args={[row.address]}
                className="btn-secondary"
                pendingLabel="Suspending…"
              >
                Suspend
              </TxButton>
            ) : (
              <TxButton
                functionName="admitMember"
                args={[row.address]}
                className="btn-secondary"
                pendingLabel="Reinstating…"
              >
                Reinstate
              </TxButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResolveDispute() {
  const [loanId, setLoanId] = useState("");
  const [feeText, setFeeText] = useState("0");
  const [countLate, setCountLate] = useState(true);
  const [markUnreturned, setMarkUnreturned] = useState(false);

  const id = /^\d+$/.test(loanId.trim()) ? BigInt(loanId.trim()) : null;
  const loan = useReadContract({
    ...toolshed,
    functionName: "getLoan",
    args: [id ?? 0n],
    query: { enabled: id !== null && id > 0n },
  });
  const data = loan.data as Loan | undefined;

  let fee: bigint | null = null;
  try {
    fee = parseUsdc(feeText);
  } catch {
    fee = null;
  }

  const resolvable = !!data && OPEN_LOAN_STATUSES.includes(data.status as LoanStatus) && fee !== null;
  const tooMuch = !!data && fee !== null && fee > data.deposit;

  return (
    <section className="card p-4">
      <h2 className="mb-1 text-lg font-semibold">Resolve a dispute</h2>
      <p className="mb-3 text-sm text-shed-600">
        For the cases the contract cannot judge: the tool came back broken, the owner says it never arrived, or
        everyone agrees to forgive a late return. Splits that loan&apos;s deposit between its borrower and the tool
        owner — nothing can be sent anywhere else, and you cannot resolve a loan you are a party to.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Loan #</span>
          <input className="input" value={loanId} onChange={(e) => setLoanId(e.target.value)} placeholder="12" />
        </label>
        <label>
          <span className="label">To the owner (USDC)</span>
          <input className="input" value={feeText} onChange={(e) => setFeeText(e.target.value)} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={countLate}
            onChange={(e) => setCountLate(e.target.checked)}
          />
          Count as a late return
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4"
            checked={markUnreturned}
            onChange={(e) => {
              setMarkUnreturned(e.target.checked);
              if (e.target.checked) setCountLate(true);
            }}
          />
          The tool was never returned
        </label>
      </div>

      {data && (
        <p className="mt-3 text-sm text-shed-600">
          Loan #{loanId}: {LOAN_STATUS_LABEL[data.status as LoanStatus]} · {formatUsdc(data.deposit)} deposit ·
          borrower {shortAddress(data.borrower)} · tool #{data.toolId.toString()}
        </p>
      )}
      {tooMuch && <p className="mt-2 text-xs text-red-700">More than this loan&apos;s deposit.</p>}
      {data && !resolvable && !tooMuch && (
        <p className="mt-2 text-xs text-amber-800">Only an open loan can be resolved.</p>
      )}

      <div className="mt-3">
        <TxButton
          functionName="resolveLoan"
          args={[id ?? 0n, fee ?? 0n, countLate, markUnreturned]}
          disabled={!resolvable || tooMuch}
          pendingLabel="Resolving…"
        >
          Resolve and pay out
        </TxButton>
      </div>
    </section>
  );
}

function EmergencyStop({ paused }: { paused: boolean }) {
  return (
    <section className="card p-4">
      <h2 className="mb-1 text-lg font-semibold">Emergency stop</h2>
      <p className="mb-3 text-sm text-shed-600">
        Pausing blocks new listings, requests and approvals. Returns, refunds and dispute resolution keep working, so
        no deposit can ever be trapped by a pause.
      </p>
      <TxButton functionName="setPaused" args={[!paused]} className="btn-secondary" pendingLabel="Updating…">
        {paused ? "Resume normal service" : "Pause new activity"}
      </TxButton>
    </section>
  );
}

/**
 * The two levers that exist onchain but rarely get pulled: the deposit ceiling, and recovering
 * tokens someone sent to the contract by mistake. Sweeping can only ever move the surplus over
 * what the contract owes, so open deposits and unclaimed credits are out of reach.
 */
function Housekeeping() {
  const { address } = useAccount();
  const maxDeposit = useReadContract({ ...toolshed, functionName: "maxDeposit" });
  const escrowed = useReadContract({ ...toolshed, functionName: "totalEscrowed" });
  const credited = useReadContract({ ...toolshed, functionName: "totalCredited" });
  const [ceiling, setCeiling] = useState("");

  let parsed: bigint | null = null;
  try {
    parsed = ceiling.trim() === "" ? null : parseUsdc(ceiling);
  } catch {
    parsed = null;
  }

  return (
    <section className="card p-4">
      <h2 className="mb-1 text-lg font-semibold">Housekeeping</h2>
      <p className="mb-3 text-sm text-shed-600">
        Deposit ceiling is {maxDeposit.data !== undefined ? formatUsdc(maxDeposit.data as bigint) : "…"} · escrow holds{" "}
        {escrowed.data !== undefined ? formatUsdc(escrowed.data as bigint) : "…"} for open loans
        {credited.data !== undefined && (credited.data as bigint) > 0n && (
          <> · {formatUsdc(credited.data as bigint)} is waiting to be claimed by members</>
        )}
        .
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="w-48">
          <span className="label">New deposit ceiling (USDC)</span>
          <input className="input" value={ceiling} placeholder="2000" onChange={(e) => setCeiling(e.target.value)} />
        </label>
        <TxButton
          functionName="setMaxDeposit"
          args={[parsed ?? 0n]}
          disabled={parsed === null || parsed === 0n}
          className="btn-secondary"
          pendingLabel="Updating…"
          onDone={() => setCeiling("")}
        >
          Set ceiling
        </TxButton>
        <TxButton
          functionName="sweepStrayTokens"
          args={[address ?? "0x0000000000000000000000000000000000000000"]}
          disabled={!address}
          className="btn-secondary"
          pendingLabel="Recovering…"
        >
          Recover stray tokens
        </TxButton>
      </div>
      <p className="hint">
        Handing the steward role over (`transferOwnership`, two-step) is deliberately not a button — do it with
        `cast`, deliberately, from the Safe.
      </p>
    </section>
  );
}
