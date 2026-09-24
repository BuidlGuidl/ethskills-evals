"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import type { Address } from "viem";
import { ActionButton } from "~~/components/toolshed/ActionButton";
import { ConnectPrompt, EmptyState, ReliabilityBadge, SectionHeading, Usd } from "~~/components/toolshed/Bits";
import { LoanCard } from "~~/components/toolshed/LoanCard";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import {
  useDepositToken,
  useLoanIdsByBorrower,
  useLoanIdsByOwner,
  useLoans,
  useOwedBalance,
  useRecord,
  useRecords,
  useRoles,
  useToolMetadata,
  useTools,
} from "~~/hooks/toolshed";
import { LoanState, compareByReliability } from "~~/utils/toolshed";

const OPEN_STATES = [LoanState.Requested, LoanState.Active, LoanState.ReturnClaimed, LoanState.Disputed];

const Dashboard: NextPage = () => {
  const { address, isMember } = useRoles();
  const { tools: rawTools, refetch: refetchTools } = useTools();
  const tools = useToolMetadata(rawTools);
  const { balance, symbol } = useDepositToken();
  const { owed, refetch: refetchOwed } = useOwedBalance(address);
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });
  const myRecord = useRecord(address);

  const myTools = useMemo(
    () => tools.filter(tool => address && tool.owner.toLowerCase() === address.toLowerCase()),
    [tools, address],
  );

  // Loans where I am the borrower.
  const { loanIds: borrowedIds, refetch: refetchBorrowedIds } = useLoanIdsByBorrower(address);
  const { loans: borrowed, refetch: refetchBorrowed } = useLoans(borrowedIds);

  // Loans on tools I own, straight from the contract's owner index.
  const { loanIds: lentIds, refetch: refetchLentIds } = useLoanIdsByOwner(address);
  const { loans: lent, refetch: refetchLent } = useLoans(lentIds);

  // Everyone whose standing is shown on this screen: the neighbors borrowing my tools, and the
  // owners of the tools I have out. Miss the latter and every lender renders as a stranger.
  const people = useMemo(() => {
    const owners = borrowed
      .map(loan => tools.find(tool => tool.id === loan.toolId)?.owner)
      .filter(Boolean) as Address[];
    return [
      ...borrowed.map(loan => loan.borrower),
      ...lent.map(loan => loan.borrower),
      ...owners,
      ...myTools.map(t => t.owner),
    ];
  }, [borrowed, lent, myTools, tools]);

  const { recordOf } = useRecords(people);

  const refresh = async () => {
    await Promise.all([refetchTools(), refetchBorrowedIds(), refetchBorrowed(), refetchLentIds(), refetchLent()]);
  };

  const toolById = (id: bigint) => tools.find(tool => tool.id === id);

  const openBorrowed = borrowed.filter(loan => OPEN_STATES.includes(loan.state));
  const pastBorrowed = borrowed.filter(loan => loan.state === LoanState.Closed).reverse();
  const openLent = useMemo(
    () =>
      lent
        .filter(loan => OPEN_STATES.includes(loan.state))
        // Requests first, and within them the most reliable borrower first — the queue an owner
        // actually works through.
        .sort((a, b) => {
          const aPending = a.state === LoanState.Requested ? 0 : 1;
          const bPending = b.state === LoanState.Requested ? 0 : 1;
          if (aPending !== bPending) return aPending - bPending;
          return compareByReliability(recordOf(a.borrower), recordOf(b.borrower));
        }),
    [lent, recordOf],
  );

  if (!address) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <ConnectPrompt title="Connect your wallet" hint="Your loans, your tools, and your track record live here." />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-base-300 pb-6">
        <div>
          <h1 className="m-0 text-3xl font-black tracking-tight">Your shed</h1>
          <div className="mt-2">
            <ReliabilityBadge record={myRecord} />
          </div>
          {!isMember && (
            <p className="mt-2 mb-0 text-sm text-warning">
              This wallet is not on the member roll, so you cannot list or borrow. Open loans still settle normally.
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          <div className="opacity-60">Wallet balance</div>
          <div className="text-xl font-bold">
            <Usd amount={balance} /> {symbol}
          </div>
          <div className="opacity-60">
            lent out: <Usd amount={myRecord.lateFeesEarned} /> earned in late fees
          </div>
        </div>
      </header>

      {owed > 0n && (
        <section className="mb-8 border border-warning bg-base-100 p-4">
          <h2 className="m-0 text-lg font-bold">
            <Usd amount={owed} /> is waiting for you
          </h2>
          <p className="mt-1 text-sm opacity-80">
            A settlement could not pay you at the time — USDC transfers to your address were being refused, which
            usually means the token itself blocked or paused them. The money was kept for you instead of the loan
            failing.
          </p>
          <ActionButton
            label="Collect it"
            onClick={async () => {
              await writeContractAsync({ functionName: "withdraw" });
              await refetchOwed();
            }}
          />
        </section>
      )}

      <section className="mb-10 flex flex-col gap-3">
        <SectionHeading
          title={`Tools you are lending (${openLent.length} open)`}
          hint="Requests come ranked by the borrower's track record."
          href="/list"
          hrefLabel="List another tool →"
        />
        {openLent.length === 0 ? (
          <EmptyState
            title={myTools.length === 0 ? "You haven't listed anything yet" : "No open requests or loans"}
            hint={
              myTools.length === 0
                ? "A drill that sits in a cupboard 364 days a year is exactly what this is for."
                : undefined
            }
          />
        ) : (
          openLent.map(loan => (
            <LoanCard
              key={loan.id.toString()}
              loan={loan}
              tool={toolById(loan.toolId)}
              role="owner"
              counterpartyRecord={recordOf(loan.borrower)}
              onDone={refresh}
            />
          ))
        )}
        {myTools.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {myTools.map(tool => (
              <Link key={tool.id.toString()} href={`/tools?id=${tool.id}`} className="btn btn-ghost btn-xs">
                {tool.metadata?.name ?? `Tool #${tool.id}`}
                {tool.activeLoanId !== 0n && " · out"}
                {!tool.listed && " · delisted"}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10 flex flex-col gap-3">
        <SectionHeading
          title={`Tools you have borrowed (${openBorrowed.length} open)`}
          href="/"
          hrefLabel="Browse the shed →"
        />
        {openBorrowed.length === 0 ? (
          <EmptyState title="Nothing out at the moment" />
        ) : (
          openBorrowed.map(loan => (
            <LoanCard
              key={loan.id.toString()}
              loan={loan}
              tool={toolById(loan.toolId)}
              role="borrower"
              counterpartyRecord={recordOf(toolById(loan.toolId)?.owner)}
              onDone={refresh}
            />
          ))
        )}
      </section>

      {pastBorrowed.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeading title="Your borrowing history" hint="This is what the browse screen ranks you by." />
          {pastBorrowed.map(loan => (
            <LoanCard
              key={loan.id.toString()}
              loan={loan}
              tool={toolById(loan.toolId)}
              role="borrower"
              counterpartyRecord={recordOf(toolById(loan.toolId)?.owner)}
              onDone={refresh}
            />
          ))}
        </section>
      )}
    </div>
  );
};

export default Dashboard;
