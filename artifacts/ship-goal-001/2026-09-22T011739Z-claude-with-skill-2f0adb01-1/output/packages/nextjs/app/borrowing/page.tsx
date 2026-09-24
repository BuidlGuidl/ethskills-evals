"use client";

import { useMemo } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { CreditBanner } from "~~/components/toolshed/CreditBanner";
import { LoanCard } from "~~/components/toolshed/LoanCard";
import { TrackRecordBadge } from "~~/components/toolshed/TrackRecordBadge";
import { useLoans, useMembers, useTools } from "~~/hooks/toolshed/useToolshed";
import { isOpen } from "~~/utils/toolshed/loans";
import { LoanStatus } from "~~/utils/toolshed/types";

const Borrowing: NextPage = () => {
  const { address } = useAccount();
  const { tools } = useTools();
  const { loans } = useLoans();
  const { statsFor } = useMembers();

  const toolById = useMemo(() => new Map(tools.map(tool => [tool.id, tool])), [tools]);
  const mine = useMemo(
    () => loans.filter(loan => loan.borrower.toLowerCase() === address?.toLowerCase()),
    [loans, address],
  );
  const open = useMemo(() => mine.filter(isOpen).sort((a, b) => a.dueAt - b.dueAt), [mine]);
  const past = useMemo(() => mine.filter(loan => !isOpen(loan)).sort((a, b) => b.id - a.id), [mine]);

  if (!address) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 flex flex-col items-center gap-4">
        <p className="opacity-70 m-0">Connect your wallet to see what you&apos;ve borrowed.</p>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold m-0">Borrowing</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="opacity-70">Your track record:</span>
          <TrackRecordBadge stats={statsFor(address)} />
        </div>
      </header>

      <CreditBanner />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold m-0">Open</h2>
        {open.length === 0 ? (
          <p className="opacity-60 m-0">Nothing out at the moment.</p>
        ) : (
          open.map(loan => (
            <LoanCard
              key={loan.id}
              loan={loan}
              tool={toolById.get(loan.toolId)}
              perspective="borrower"
              counterparty={statsFor(toolById.get(loan.toolId)?.owner)}
            />
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold m-0">History</h2>
          <p className="text-sm opacity-60 m-0">
            {past.filter(loan => loan.status === LoanStatus.Completed).length} returned ·{" "}
            {past.filter(loan => loan.status === LoanStatus.Defaulted).length} written off
          </p>
          {past.slice(0, 20).map(loan => (
            <LoanCard
              key={loan.id}
              loan={loan}
              tool={toolById.get(loan.toolId)}
              perspective="borrower"
              counterparty={statsFor(toolById.get(loan.toolId)?.owner)}
            />
          ))}
        </section>
      )}
    </div>
  );
};

export default Borrowing;
