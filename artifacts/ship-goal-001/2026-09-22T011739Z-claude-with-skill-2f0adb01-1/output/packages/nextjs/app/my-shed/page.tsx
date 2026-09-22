"use client";

import { useMemo, useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { CreditBanner } from "~~/components/toolshed/CreditBanner";
import { ListToolForm } from "~~/components/toolshed/ListToolForm";
import { LoanCard } from "~~/components/toolshed/LoanCard";
import { MyToolRow } from "~~/components/toolshed/MyToolRow";
import { useIsMember, useLoans, useMembers, useTools } from "~~/hooks/toolshed/useToolshed";
import { trackRecord } from "~~/utils/toolshed/reputation";
import { LoanStatus } from "~~/utils/toolshed/types";

const MyShed: NextPage = () => {
  const { address } = useAccount();
  const { tools } = useTools();
  const { loans } = useLoans();
  const { statsFor } = useMembers();
  const isMember = useIsMember();
  const [isListing, setIsListing] = useState(false);

  const mine = useMemo(
    () => tools.filter(tool => tool.owner.toLowerCase() === address?.toLowerCase()),
    [tools, address],
  );
  const myToolIds = useMemo(() => new Set(mine.map(tool => tool.id)), [mine]);
  const toolById = useMemo(() => new Map(tools.map(tool => [tool.id, tool])), [tools]);

  const onMyTools = useMemo(() => loans.filter(loan => myToolIds.has(loan.toolId)), [loans, myToolIds]);

  // Requests are sorted by the borrower's track record: the neighbours who bring things back
  // on time get lent to first.
  const requests = useMemo(
    () =>
      onMyTools
        .filter(loan => loan.status === LoanStatus.Requested)
        .sort((a, b) => trackRecord(statsFor(b.borrower)).score - trackRecord(statsFor(a.borrower)).score),
    [onMyTools, statsFor],
  );

  const out = useMemo(
    () =>
      onMyTools
        .filter(loan => loan.status === LoanStatus.Active || loan.status === LoanStatus.ReturnDeclared)
        .sort((a, b) => a.dueAt - b.dueAt),
    [onMyTools],
  );

  const settled = useMemo(
    () =>
      onMyTools
        .filter(loan => loan.status === LoanStatus.Completed || loan.status === LoanStatus.Defaulted)
        .sort((a, b) => b.id - a.id)
        .slice(0, 10),
    [onMyTools],
  );

  if (!address) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 flex flex-col items-center gap-4">
        <p className="opacity-70 m-0">Connect your wallet to see your shed.</p>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 flex flex-col gap-10">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold m-0">My shed</h1>
          <p className="opacity-70 m-0 mt-1">What you lend out, and who&apos;s asking for it.</p>
        </div>
        {isMember && (
          <button className="btn btn-primary" onClick={() => setIsListing(listing => !listing)}>
            {isListing ? "Close" : "List a tool"}
          </button>
        )}
      </header>

      <CreditBanner />

      {!isMember && (
        <div className="alert alert-warning">
          You&apos;re not on the roster yet, so you can&apos;t list tools. Ask the steward to add your address.
        </div>
      )}

      {isListing && (
        <section className="border border-base-300 bg-base-100 rounded-box p-5">
          <h2 className="text-lg font-semibold mt-0 mb-3">List a tool</h2>
          <ListToolForm onDone={() => setIsListing(false)} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold m-0">
          Asking to borrow {requests.length > 0 && <span className="badge badge-primary">{requests.length}</span>}
        </h2>
        {requests.length === 0 ? (
          <p className="opacity-60 m-0">Nobody&apos;s waiting on you.</p>
        ) : (
          <>
            <p className="text-sm opacity-60 m-0">Sorted by track record — the most reliable borrowers first.</p>
            {requests.map(loan => (
              <LoanCard
                key={loan.id}
                loan={loan}
                tool={toolById.get(loan.toolId)}
                perspective="owner"
                counterparty={statsFor(loan.borrower)}
              />
            ))}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold m-0">Out on loan</h2>
        {out.length === 0 ? (
          <p className="opacity-60 m-0">Everything&apos;s home.</p>
        ) : (
          out.map(loan => (
            <LoanCard
              key={loan.id}
              loan={loan}
              tool={toolById.get(loan.toolId)}
              perspective="owner"
              counterparty={statsFor(loan.borrower)}
            />
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold m-0">My listings</h2>
        {mine.length === 0 ? (
          <p className="opacity-60 m-0">Nothing listed yet.</p>
        ) : (
          mine.filter(tool => !tool.retired).map(tool => <MyToolRow key={tool.id} tool={tool} />)
        )}
      </section>

      {settled.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold m-0">Recently settled</h2>
          {settled.map(loan => (
            <LoanCard
              key={loan.id}
              loan={loan}
              tool={toolById.get(loan.toolId)}
              perspective="owner"
              counterparty={statsFor(loan.borrower)}
            />
          ))}
        </section>
      )}
    </div>
  );
};

export default MyShed;
