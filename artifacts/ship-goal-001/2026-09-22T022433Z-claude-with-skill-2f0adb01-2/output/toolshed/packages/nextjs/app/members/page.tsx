"use client";

import { useMemo, useState } from "react";
import { Address as AddressDisplay } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { EmptyState, ReliabilityBadge, Usd } from "~~/components/toolshed/Bits";
import { useMembers, useRecords, useTools } from "~~/hooks/toolshed";
import { PRIOR_RATE, PRIOR_WEIGHT, compareByReliability, onTimeCount, reliabilityScore } from "~~/utils/toolshed";

const Members: NextPage = () => {
  const { members, isLoading } = useMembers();
  const { tools } = useTools();
  const { recordOf } = useRecords(useMemo(() => members.map(member => member.address), [members]));
  const [includeFormer, setIncludeFormer] = useState(false);

  const rows = useMemo(() => {
    const toolsOwned = new Map<string, number>();
    tools.forEach(tool => {
      const key = tool.owner.toLowerCase();
      toolsOwned.set(key, (toolsOwned.get(key) ?? 0) + 1);
    });

    return members
      .filter(member => includeFormer || member.active)
      .map(member => ({
        ...member,
        record: recordOf(member.address),
        toolsOwned: toolsOwned.get(member.address.toLowerCase()) ?? 0,
      }))
      .sort((a, b) => compareByReliability(a.record, b.record));
  }, [members, recordOf, tools, includeFormer]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6 border-b border-base-300 pb-6">
        <h1 className="m-0 text-3xl font-black tracking-tight">Neighbors</h1>
        <p className="m-0 max-w-2xl opacity-80">
          Everyone on the roll, ranked the same way the browse screen ranks tools. The counts are onchain — anyone can
          check them. The score smooths the on-time rate toward {Math.round(PRIOR_RATE * 100)}% with a weight of{" "}
          {PRIOR_WEIGHT} loans, so a single loan doesn&apos;t make or break anyone, and a tool that never came back
          counts three times as heavily as a late return.
        </p>
      </header>

      <label className="label mb-4 w-fit cursor-pointer gap-2">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={includeFormer}
          onChange={event => setIncludeFormer(event.target.checked)}
        />
        <span className="label-text">Show former members</span>
      </label>

      {isLoading ? (
        <div className="h-64 animate-pulse bg-base-300" />
      ) : rows.length === 0 ? (
        <EmptyState title="Nobody on the roll yet" hint="The steward adds member addresses." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Standing</th>
                <th className="text-right">Borrowed</th>
                <th className="text-right">On time</th>
                <th className="text-right">Late</th>
                <th className="text-right">Never returned</th>
                <th className="text-right">Lent</th>
                <th className="text-right">Tools</th>
                <th className="text-right">Late fees paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ address, active, record, toolsOwned }) => (
                <tr key={address} className={active ? "" : "opacity-50"}>
                  <td>
                    <AddressDisplay address={address} size="sm" />
                    {!active && <span className="badge badge-ghost badge-xs ml-2">former</span>}
                  </td>
                  <td>
                    <ReliabilityBadge record={record} showCounts={false} />
                  </td>
                  <td className="text-right tabular-nums">{record.loansBorrowed}</td>
                  <td className="text-right tabular-nums">{onTimeCount(record)}</td>
                  <td className="text-right tabular-nums">{record.lateReturns - record.defaults}</td>
                  <td className="text-right tabular-nums">{record.defaults}</td>
                  <td className="text-right tabular-nums">{record.loansLent}</td>
                  <td className="text-right tabular-nums">{toolsOwned}</td>
                  <td className="text-right tabular-nums">
                    <Usd amount={record.lateFeesPaid} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <p className="mt-4 text-sm opacity-60">
          Top of the list right now: {rows[0].address.slice(0, 8)}… at {reliabilityScore(rows[0].record)}.
        </p>
      )}
    </div>
  );
};

export default Members;
