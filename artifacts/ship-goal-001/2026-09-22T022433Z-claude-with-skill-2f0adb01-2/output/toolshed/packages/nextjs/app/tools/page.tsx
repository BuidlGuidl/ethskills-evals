"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Address as AddressDisplay } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { ActionButton } from "~~/components/toolshed/ActionButton";
import {
  EmptyState,
  LoadingBlock,
  LoanStateBadge,
  MemberLine,
  ReliabilityBadge,
  ToolPhoto,
  Usd,
} from "~~/components/toolshed/Bits";
import { DepositAction } from "~~/components/toolshed/DepositAction";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import {
  useChainNow,
  useLoanIdsByTool,
  useLoans,
  useRecords,
  useRoles,
  useToolMetadata,
  useTools,
} from "~~/hooks/toolshed";
import {
  LoanState,
  compareByReliability,
  formatDate,
  formatRelativeDays,
  lateDaysAt,
  lateFeeAt,
} from "~~/utils/toolshed";

/**
 * A tool's page is `/tools?id=3` rather than `/tools/3` so the whole frontend stays statically
 * exportable — that is what lets `yarn ipfs` publish it to IPFS, where it keeps working even if
 * nobody is paying a hosting bill.
 */
const ToolDetail = () => {
  const params = useSearchParams();
  const raw = params.get("id") ?? "0";
  const toolId = /^\d+$/.test(raw) ? BigInt(raw) : 0n;

  const { tools: rawTools, isLoading, refetch: refetchTools } = useTools();
  const tools = useToolMetadata(rawTools);
  const tool = tools.find(candidate => candidate.id === toolId);

  const { loanIds, refetch: refetchLoanIds } = useLoanIdsByTool(toolId);
  const { loans, refetch: refetchLoans } = useLoans(loanIds);
  const { address, isMember, isLoadingRoles } = useRoles();
  const now = useChainNow();

  const people = useMemo(() => [...loans.map(loan => loan.borrower), ...(tool ? [tool.owner] : [])], [loans, tool]);
  const { recordOf } = useRecords(people);

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });
  const { data: requestTtl } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "REQUEST_TTL" });
  const [days, setDays] = useState(3);

  /** A request the contract will no longer let the owner approve. */
  const isExpired = (requestedAt: bigint) => now > requestedAt + (requestTtl ?? 0n);

  const refresh = async () => {
    await Promise.all([refetchTools(), refetchLoanIds(), refetchLoans()]);
  };

  const isOwner = Boolean(address && tool && address.toLowerCase() === tool.owner.toLowerCase());
  const pending = loans.filter(loan => loan.state === LoanState.Requested);
  const open = loans.find(loan => [LoanState.Active, LoanState.ReturnClaimed, LoanState.Disputed].includes(loan.state));
  const myRequest = pending.find(loan => address && loan.borrower.toLowerCase() === address.toLowerCase());
  const history = loans.filter(loan => loan.state === LoanState.Closed).reverse();

  // The owner's queue is ranked by borrower track record — reliable neighbors get lent to first.
  const queue = [...pending].sort((a, b) => compareByReliability(recordOf(a.borrower), recordOf(b.borrower)));

  // Only claim a tool does not exist once we have actually looked. Rendering "No such tool" while
  // the first RPC call is still in flight makes every shared link look broken on a slow connection.
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <LoadingBlock className="h-96" />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <EmptyState
          title="No such tool"
          hint="Nothing is listed under that number. It may have been listed on a different network."
          action={
            <Link href="/" className="btn btn-primary btn-sm">
              Back to the shed
            </Link>
          }
        />
      </div>
    );
  }

  const name = tool.metadata?.name ?? "Loading…";
  const deposit = tool.deposit;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/" className="link text-sm">
        ← Back to the shed
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div>
          <ToolPhoto image={tool.metadata?.image} name={name} className="h-80" />
          <h1 className="mt-4 mb-1 text-3xl font-black tracking-tight">{name}</h1>
          <div className="text-sm">
            <span className="opacity-60">Owned by </span>
            <MemberLine address={tool.owner} record={recordOf(tool.owner)} />
          </div>

          {tool.metadata?.description && <p className="whitespace-pre-line">{tool.metadata.description}</p>}
          {tool.metadata?.condition && (
            <div className="border-l-4 border-base-300 pl-4">
              <p className="m-0 text-xs uppercase tracking-wide opacity-60">Condition notes</p>
              <p className="m-0 whitespace-pre-line">{tool.metadata.condition}</p>
            </div>
          )}
          {!tool.listed && (
            <p className="text-sm text-warning">
              This tool is currently delisted — the owner has taken it off the shed.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <section className="border border-base-300 bg-base-100 p-5">
            <h2 className="m-0 text-lg font-bold">Terms</h2>
            <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="opacity-60">Deposit</dt>
              <dd className="m-0 text-right font-bold">
                <Usd amount={deposit} />
              </dd>
              <dt className="opacity-60">Late fee</dt>
              <dd className="m-0 text-right">
                <Usd amount={tool.dailyLateFee} /> per day
              </dd>
              <dt className="opacity-60">Longest loan</dt>
              <dd className="m-0 text-right">{tool.maxDurationDays} days</dd>
            </dl>
            <p className="mt-3 mb-0 text-xs opacity-60">
              The deposit sits in escrow until the owner confirms the return. Late fees come out of it — a day started
              is a day charged — and anything left over comes back to you.
            </p>
          </section>

          {open && (
            <section className="border border-base-300 bg-base-100 p-5">
              <div className="flex items-center justify-between">
                <h2 className="m-0 text-lg font-bold">Currently out</h2>
                <LoanStateBadge state={open.state} outcome={open.outcome} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                <dt className="opacity-60">Borrower</dt>
                <dd className="m-0 text-right">
                  <AddressDisplay address={open.borrower} size="sm" />
                </dd>
                <dt className="opacity-60">Due</dt>
                <dd className="m-0 text-right">
                  {formatDate(open.dueAt)} <span className="opacity-60">({formatRelativeDays(open.dueAt, now)})</span>
                </dd>
                {lateDaysAt(open.dueAt, now) > 0 && open.state !== LoanState.ReturnClaimed && (
                  <>
                    <dt className="opacity-60">Late fees so far</dt>
                    <dd className="m-0 text-right text-warning">
                      <Usd amount={lateFeeAt(open, now)} />
                    </dd>
                  </>
                )}
              </dl>
              {(isOwner || (address && open.borrower.toLowerCase() === address.toLowerCase())) && (
                <Link href="/dashboard" className="link mt-3 inline-block text-sm">
                  Manage this loan →
                </Link>
              )}
            </section>
          )}

          {!isOwner && (
            <section className="border border-base-300 bg-base-100 p-5">
              <h2 className="m-0 text-lg font-bold">Borrow it</h2>
              {isLoadingRoles ? (
                <LoadingBlock className="mt-3 h-24" />
              ) : !isMember ? (
                <p className="mt-2 mb-0 text-sm opacity-70">
                  Borrowing is for association members. Ask the steward to add{" "}
                  {address ? "your address" : "your wallet address"} to the roll — they can do it in one transaction
                  from the Steward screen.
                </p>
              ) : myRequest ? (
                <div className="mt-3 flex flex-col gap-3">
                  <p className="m-0 text-sm">
                    You have asked for this one — <Usd amount={myRequest.deposit} /> is in escrow while the owner
                    decides.
                  </p>
                  <ActionButton
                    label="Withdraw request and take the deposit back"
                    className="btn btn-outline btn-sm"
                    onClick={async () => {
                      await writeContractAsync({ functionName: "cancelRequest", args: [myRequest.id] });
                      await refresh();
                    }}
                  />
                </div>
              ) : tool.activeLoanId !== 0n ? (
                <p className="mt-2 mb-0 text-sm opacity-70">
                  It is out on loan right now. You can still ask — the owner will see your request when it comes back.
                </p>
              ) : null}

              {isMember && !myRequest && (
                <div className="mt-3 flex flex-col gap-3">
                  <label className="form-control">
                    <span className="label-text text-xs uppercase tracking-wide opacity-60">
                      How many days do you need it?
                    </span>
                    <input
                      type="range"
                      className="range range-sm"
                      min={1}
                      max={tool.maxDurationDays}
                      value={Math.min(days, tool.maxDurationDays)}
                      onChange={event => setDays(Number(event.target.value))}
                    />
                    <span className="mt-1 text-sm">
                      <strong>{Math.min(days, tool.maxDurationDays)} days</strong> — back by{" "}
                      {formatDate(now + BigInt(Math.min(days, tool.maxDurationDays) * 86400))}
                    </span>
                  </label>

                  <div className="bg-base-200 p-3 text-sm">
                    <div className="flex justify-between">
                      <span>Deposit now</span>
                      <Usd amount={deposit} className="font-bold" />
                    </div>
                    <div className="flex justify-between opacity-70">
                      <span>Back on time</span>
                      <span>
                        <Usd amount={deposit} /> refunded
                      </span>
                    </div>
                    <div className="flex justify-between opacity-70">
                      <span>Two days late</span>
                      <span>
                        {/* The contract caps the fee at the deposit, so this line never goes negative. */}
                        <Usd
                          amount={deposit - (tool.dailyLateFee * 2n > deposit ? deposit : tool.dailyLateFee * 2n)}
                        />{" "}
                        refunded
                      </span>
                    </div>
                  </div>

                  <DepositAction
                    amount={deposit}
                    label={`Ask to borrow — ${Math.min(days, tool.maxDurationDays)} days`}
                    disabled={!tool.listed}
                    disabledReason={!tool.listed ? "This tool is delisted" : undefined}
                    onExecute={async () => {
                      await writeContractAsync({
                        functionName: "requestLoan",
                        args: [toolId, Math.min(days, tool.maxDurationDays)],
                      });
                      await refresh();
                    }}
                  />
                </div>
              )}
            </section>
          )}

          {isOwner && (
            <section className="border border-base-300 bg-base-100 p-5">
              <h2 className="m-0 text-lg font-bold">Requests ({queue.length})</h2>
              <p className="mt-1 text-xs opacity-60">Most reliable borrower first.</p>
              {queue.length === 0 ? (
                <p className="mb-0 text-sm opacity-70">Nobody has asked for this one yet.</p>
              ) : (
                <ul className="mt-2 flex list-none flex-col gap-3 p-0">
                  {queue.map(loan => (
                    <li key={loan.id.toString()} className="border-t border-base-300 pt-3">
                      <div className="flex flex-col gap-1">
                        <MemberLine address={loan.borrower} record={recordOf(loan.borrower)} />
                        <ReliabilityBadge record={recordOf(loan.borrower)} />
                        <span className="text-sm opacity-70">
                          {loan.durationDays} days · asked {formatRelativeDays(loan.requestedAt, now)}
                          {isExpired(loan.requestedAt) && " · expired"}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <ActionButton
                          label="Hand it over"
                          disabled={tool.activeLoanId !== 0n || isExpired(loan.requestedAt)}
                          disabledReason={
                            tool.activeLoanId !== 0n
                              ? "This tool is already out on loan"
                              : isExpired(loan.requestedAt)
                                ? "This request expired — decline it instead"
                                : undefined
                          }
                          onClick={async () => {
                            await writeContractAsync({ functionName: "approveLoan", args: [loan.id] });
                            await refresh();
                          }}
                        />
                        <ActionButton
                          label="Decline"
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            await writeContractAsync({ functionName: "declineLoan", args: [loan.id] });
                            await refresh();
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex gap-2 border-t border-base-300 pt-3">
                <Link href={`/list?edit=${toolId}`} className="btn btn-outline btn-sm">
                  Edit listing
                </Link>
                <ActionButton
                  label={tool.listed ? "Take off the shed" : "Put back on the shed"}
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await writeContractAsync({ functionName: "setToolListed", args: [toolId, !tool.listed] });
                    await refresh();
                  }}
                />
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="border-b border-base-300 pb-2 text-xl font-bold">Loan history</h2>
        {history.length === 0 ? (
          <p className="text-sm opacity-70">No completed loans yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Borrower</th>
                  <th>Out</th>
                  <th>Due</th>
                  <th>Outcome</th>
                  <th className="text-right">Late fee</th>
                </tr>
              </thead>
              <tbody>
                {history.map(loan => (
                  <tr key={loan.id.toString()}>
                    <td>
                      <AddressDisplay address={loan.borrower} size="sm" />
                    </td>
                    <td>{formatDate(loan.startedAt)}</td>
                    <td>{formatDate(loan.dueAt)}</td>
                    <td>
                      <LoanStateBadge state={loan.state} outcome={loan.outcome} />
                    </td>
                    <td className="text-right">
                      <Usd amount={loan.feeToOwner} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const ToolPage: NextPage = () => (
  <Suspense fallback={<div className="mx-auto h-96 w-full max-w-5xl animate-pulse bg-base-300" />}>
    <ToolDetail />
  </Suspense>
);

export default ToolPage;
