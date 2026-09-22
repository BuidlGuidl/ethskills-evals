"use client";

import Link from "next/link";
import { MemberLineStatic, ToolPhoto, Usd } from "./Bits";
import type { Record, ToolWithId } from "~~/utils/toolshed";

export const ToolCard = ({ tool, ownerRecord }: { tool: ToolWithId; ownerRecord?: Record }) => {
  const onLoan = tool.activeLoanId !== 0n;
  const name = tool.metadata?.name ?? "Loading…";

  return (
    <Link
      href={`/tools?id=${tool.id}`}
      className="group flex flex-col border border-base-300 bg-base-100 transition-shadow hover:shadow-center"
    >
      <div className="relative">
        <ToolPhoto image={tool.metadata?.image} name={name} />
        <span className={`badge badge-sm absolute right-2 top-2 ${onLoan ? "badge-warning" : "badge-success"}`}>
          {onLoan ? "Out on loan" : "On the shelf"}
        </span>
      </div>

      <div className="flex grow flex-col gap-2 p-4">
        <h3 className="m-0 text-lg font-bold leading-tight group-hover:underline">{name}</h3>
        {tool.metadata?.condition && <p className="m-0 line-clamp-2 text-sm opacity-70">{tool.metadata.condition}</p>}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-2 text-sm">
          <span>
            <Usd amount={tool.deposit} className="font-bold" /> deposit
          </span>
          <span className="opacity-70">
            <Usd amount={tool.dailyLateFee} />
            /day late
          </span>
        </div>
        <div className="text-xs">
          <span className="opacity-60">Owner </span>
          <MemberLineStatic address={tool.owner} record={ownerRecord} />
        </div>
      </div>
    </Link>
  );
};
