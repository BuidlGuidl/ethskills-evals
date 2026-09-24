"use client";

import { useMemo, useState } from "react";
import type { NextPage } from "next";
import { BrowseToolCard } from "~~/components/toolshed/BrowseToolCard";
import { useNow } from "~~/hooks/toolshed/useNow";
import { useIsMember, useLoans, useMembers, useTools } from "~~/hooks/toolshed/useToolshed";
import { canExpireRequest } from "~~/utils/toolshed/loans";
import { trackRecord } from "~~/utils/toolshed/reputation";
import { LoanStatus } from "~~/utils/toolshed/types";

type SortKey = "reliability" | "deposit" | "newest";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "reliability", label: "Most reliable owners" },
  { key: "deposit", label: "Smallest deposit" },
  { key: "newest", label: "Recently listed" },
];

const Browse: NextPage = () => {
  const { tools, isLoading } = useTools();
  const { loans } = useLoans();
  const { statsFor } = useMembers();
  const isMember = useIsMember();
  const now = useNow();
  const [sort, setSort] = useState<SortKey>("reliability");
  const [showUnavailable, setShowUnavailable] = useState(false);

  // A tool is held by whichever loan is currently attached to it. A request nobody answered
  // holds it too — but that one anybody can clear, so the card offers a button instead of a
  // dead end.
  const holdByTool = useMemo(() => {
    const holds = new Map<number, { reason: string; expirableLoanId?: number }>();
    for (const loan of loans) {
      if (loan.status === LoanStatus.Requested) {
        holds.set(
          loan.toolId,
          canExpireRequest(loan, now)
            ? { reason: "An unanswered request is still holding this one.", expirableLoanId: loan.id }
            : { reason: "A neighbour has already asked for this one." },
        );
      }
      if (loan.status === LoanStatus.Active || loan.status === LoanStatus.ReturnDeclared) {
        holds.set(loan.toolId, { reason: "Out on loan right now." });
      }
    }
    return holds;
  }, [loans, now]);

  const visible = useMemo(() => {
    const shelf = tools.filter(
      tool => !tool.retired && (showUnavailable || (tool.available && tool.activeLoanId === 0n)),
    );

    return [...shelf].sort((a, b) => {
      if (sort === "deposit") return Number(a.deposit - b.deposit);
      if (sort === "newest") return b.id - a.id;
      // Reliability of the owner, so the neighbours who look after the shed come first.
      const diff = trackRecord(statsFor(b.owner)).lenderScore - trackRecord(statsFor(a.owner)).lenderScore;
      return diff !== 0 ? diff : b.id - a.id;
    });
  }, [tools, sort, showUnavailable, statsFor]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold m-0">The shed</h1>
        <p className="opacity-70 m-0">
          Borrow a neighbour&apos;s tool, leave a USDC deposit, get it back when you return it. Return it late and a
          daily fee comes out of the deposit and goes to the owner.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-4">
        <div className="join">
          {SORTS.map(option => (
            <button
              key={option.key}
              className={`btn btn-sm join-item ${sort === option.key ? "btn-active" : ""}`}
              onClick={() => setSort(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={showUnavailable}
            onChange={e => setShowUnavailable(e.target.checked)}
          />
          <span className="label-text">Show tools that are out</span>
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 opacity-70">
          Nothing on the shelf yet. List the first tool from <span className="font-semibold">My shed</span>.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(tool => (
            <BrowseToolCard
              key={tool.id}
              tool={tool}
              ownerStats={statsFor(tool.owner)}
              canBorrow={isMember}
              hold={holdByTool.get(tool.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Browse;
