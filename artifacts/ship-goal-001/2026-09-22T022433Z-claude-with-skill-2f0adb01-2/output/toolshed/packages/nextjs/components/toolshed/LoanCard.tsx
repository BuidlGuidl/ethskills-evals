"use client";

import Link from "next/link";
import { ActionButton } from "./ActionButton";
import { LoanStateBadge, MemberLine, Usd } from "./Bits";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useChainNow } from "~~/hooks/toolshed";
import {
  type Loan,
  LoanState,
  type Record,
  type ToolWithId,
  defaultTime,
  feesPausedPendingFlag,
  formatDate,
  formatRelativeDays,
  lateDaysAt,
  lateFeeAt,
} from "~~/utils/toolshed";

export type LoanWithId = Loan & { id: bigint };

/** Every one of these contract calls takes exactly one argument, the loan id. */
type LoanAction =
  | "cancelRequest"
  | "declineLoan"
  | "approveLoan"
  | "reportReturn"
  | "confirmReturn"
  | "settleUnconfirmed"
  | "disputeReturn"
  | "settleStaleDispute"
  | "flagMissing"
  | "claimDefault";

/**
 * One loan, from the point of view of whoever is looking at it. Every button here is a state
 * transition on the contract, and each is only offered to the party the contract will accept it
 * from — except the settle-by-timeout buttons, which anyone may call once the window passes.
 */
export const LoanCard = ({
  loan,
  tool,
  role,
  counterpartyRecord,
  onDone,
}: {
  loan: LoanWithId;
  tool?: ToolWithId;
  role: "borrower" | "owner";
  counterpartyRecord?: Record;
  onDone: () => Promise<unknown> | void;
}) => {
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });
  const { data: confirmWindow } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "CONFIRM_WINDOW" });
  const { data: disputeWindow } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "DISPUTE_WINDOW" });
  const { data: requestTtl } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "REQUEST_TTL" });

  const now = useChainNow();
  const counterparty = role === "borrower" ? tool?.owner : loan.borrower;
  const name = tool?.metadata?.name ?? `Tool #${loan.toolId}`;

  const settledAt = loan.state === LoanState.Active ? now : loan.returnedAt || now;
  const lateDays = lateDaysAt(loan.dueAt, settledAt);
  const runningFee = lateFeeAt(loan, settledAt);
  const feesPaused = loan.state === LoanState.Active && feesPausedPendingFlag(loan, now);
  const claimableAt = loan.missingFlaggedAt + (confirmWindow ?? 0n);
  const feeCapAt = defaultTime(loan);
  const defaultsAt = claimableAt > feeCapAt ? claimableAt : feeCapAt;
  const settleUnconfirmedAt = loan.returnedAt + (confirmWindow ?? 0n);
  const settleStaleAt = loan.returnedAt + (confirmWindow ?? 0n) + (disputeWindow ?? 0n);
  const requestExpired = loan.state === LoanState.Requested && now > loan.requestedAt + (requestTtl ?? 0n);

  const act = (functionName: LoanAction) => async () => {
    await writeContractAsync({ functionName, args: [loan.id] });
    await onDone();
  };

  return (
    <div className="border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/tools?id=${loan.toolId}`} className="text-lg font-bold hover:underline">
            {name}
          </Link>
          <div className="text-sm">
            <span className="opacity-60">{role === "borrower" ? "from " : "to "}</span>
            <MemberLine address={counterparty} record={counterpartyRecord} />
          </div>
        </div>
        <LoanStateBadge state={loan.state} outcome={loan.outcome} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase opacity-60">Deposit</dt>
          <dd className="m-0">
            <Usd amount={loan.deposit} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase opacity-60">Late fee</dt>
          <dd className="m-0">
            <Usd amount={loan.dailyLateFee} />
            /day
          </dd>
        </div>
        {/* A request nobody has approved has no due date and no fee. Showing "$60 so far" there
            would tell a borrower their escrow had already been eaten. */}
        {loan.dueAt > 0n && (
          <>
            <div>
              <dt className="text-xs uppercase opacity-60">Due</dt>
              <dd className="m-0">
                {formatDate(loan.dueAt)}{" "}
                {loan.state !== LoanState.Closed && (
                  <span className={lateDays > 0 ? "text-warning" : "opacity-60"}>
                    ({formatRelativeDays(loan.dueAt, now)})
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase opacity-60">
                {loan.state === LoanState.Closed ? "Fee charged" : "Fee so far"}
              </dt>
              <dd
                className={`m-0 ${(loan.state === LoanState.Closed ? loan.feeToOwner : runningFee) > 0n ? "text-warning" : ""}`}
              >
                <Usd amount={loan.state === LoanState.Closed ? loan.feeToOwner : runningFee} />
                {lateDays > 0 &&
                  loan.state !== LoanState.Closed &&
                  ` (${lateDays} late day${lateDays === 1 ? "" : "s"})`}
              </dd>
            </div>
          </>
        )}
      </dl>

      {loan.state === LoanState.Requested && (
        <p className="mt-2 mb-0 text-sm opacity-70">
          Asked for {loan.durationDays} day{loan.durationDays === 1 ? "" : "s"},{" "}
          {formatRelativeDays(loan.requestedAt, now)}. <Usd amount={loan.deposit} /> is in escrow and comes straight
          back if this is declined or withdrawn.
          {requestExpired && " This one has expired — decline it to return the deposit."}
        </p>
      )}

      {loan.state === LoanState.Active && lateDays > 0 && role === "borrower" && (
        <p className="mt-2 mb-0 text-sm text-warning">
          {feesPaused ? (
            <>
              Late fees have paused at <Usd amount={runningFee} /> until the owner reports the tool missing. Returning
              it now still costs that much.
            </>
          ) : loan.missingFlaggedAt > 0n ? (
            <>
              The owner has reported this one missing. Every further day costs another{" "}
              <Usd amount={loan.dailyLateFee} />, and if you do not tap “I&apos;ve returned it” by{" "}
              {formatDate(defaultsAt)} the whole deposit goes to them.
            </>
          ) : (
            <>
              Every further day costs another <Usd amount={loan.dailyLateFee} />.
            </>
          )}
        </p>
      )}

      {loan.state === LoanState.Active && loan.missingFlaggedAt > 0n && role === "owner" && (
        <p className="mt-2 mb-0 text-sm opacity-70">
          You reported this missing {formatRelativeDays(loan.missingFlaggedAt, now)}. If it does not come back it can be
          written off from {formatDate(defaultsAt)}.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {role === "borrower" && loan.state === LoanState.Requested && (
          <ActionButton label="Withdraw request" className="btn btn-outline btn-sm" onClick={act("cancelRequest")} />
        )}

        {role === "borrower" && loan.state === LoanState.Active && (
          <ActionButton label="I've returned it" onClick={act("reportReturn")} />
        )}

        {role === "borrower" && loan.state === LoanState.ReturnClaimed && (
          <>
            <span className="text-sm opacity-70">
              Waiting for the owner to confirm — you can settle it yourself{" "}
              {formatRelativeDays(settleUnconfirmedAt, now)}.
            </span>
            {now >= settleUnconfirmedAt && (
              <ActionButton label="Settle and refund my deposit" onClick={act("settleUnconfirmed")} />
            )}
          </>
        )}

        {loan.state === LoanState.Disputed && (
          <>
            <span className="text-sm opacity-70">
              With the steward. If nobody rules on it, anyone can split the escrow down the middle{" "}
              {formatRelativeDays(settleStaleAt, now)}.
            </span>
            {now >= settleStaleAt && (
              <ActionButton
                label="Split it down the middle"
                className="btn btn-outline btn-sm"
                onClick={act("settleStaleDispute")}
              />
            )}
          </>
        )}

        {role === "owner" && loan.state === LoanState.Requested && (
          <>
            <ActionButton
              label="Hand it over"
              disabled={requestExpired || (tool?.activeLoanId ?? 0n) !== 0n}
              disabledReason={
                requestExpired
                  ? "This request expired — decline it instead"
                  : (tool?.activeLoanId ?? 0n) !== 0n
                    ? "This tool is already out on loan"
                    : undefined
              }
              onClick={act("approveLoan")}
            />
            <ActionButton label="Decline" className="btn btn-ghost btn-sm" onClick={act("declineLoan")} />
          </>
        )}

        {role === "owner" && (loan.state === LoanState.Active || loan.state === LoanState.ReturnClaimed) && (
          <ActionButton onClick={act("confirmReturn")}>
            Confirm I have it back
            {runningFee > 0n && (
              <>
                {" "}
                · keep <Usd amount={runningFee} />
              </>
            )}
          </ActionButton>
        )}

        {role === "owner" && loan.state === LoanState.Active && lateDays > 0 && loan.missingFlaggedAt === 0n && (
          <ActionButton label="It hasn't come back" className="btn btn-outline btn-sm" onClick={act("flagMissing")} />
        )}

        {role === "owner" && loan.state === LoanState.ReturnClaimed && now < settleUnconfirmedAt && (
          <ActionButton
            label="I don't have it back"
            className="btn btn-outline btn-error btn-sm"
            onClick={act("disputeReturn")}
          />
        )}

        {loan.state === LoanState.Active && loan.missingFlaggedAt > 0n && now >= defaultsAt && (
          <ActionButton
            label="Write it off — pay the full deposit to the owner"
            className="btn btn-error btn-sm"
            onClick={act("claimDefault")}
          />
        )}
      </div>
    </div>
  );
};
