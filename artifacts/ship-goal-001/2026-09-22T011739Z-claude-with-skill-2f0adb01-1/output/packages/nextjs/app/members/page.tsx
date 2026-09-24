"use client";

import { useMemo } from "react";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { TrackRecordBadge } from "~~/components/toolshed/TrackRecordBadge";
import { useMembers } from "~~/hooks/toolshed/useToolshed";
import { formatDate } from "~~/utils/toolshed/format";
import { trackRecord } from "~~/utils/toolshed/reputation";

const Members: NextPage = () => {
  const { address } = useAccount();
  const { addresses, statsFor, isLoading } = useMembers();

  const rows = useMemo(
    () =>
      addresses
        .map(member => ({ member, stats: statsFor(member), record: trackRecord(statsFor(member)) }))
        .sort((a, b) => b.record.score - a.record.score),
    [addresses, statsFor],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold m-0">Neighbours</h1>
        <p className="opacity-70 m-0 mt-1">
          Everyone on the roster, ranked by track record. A new member starts unranked and earns a record by returning
          things on time.
        </p>
        <p className="text-sm opacity-60 m-0 mt-2">
          Worth knowing: this table, and every loan behind it, is public and permanent on the blockchain. Anyone can
          look up who borrows what and who brings it back late.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <div className="overflow-x-auto border border-base-300 rounded-box bg-base-100">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Track record</th>
                <th className="text-right">Borrowed</th>
                <th className="text-right">Late</th>
                <th className="text-right">Lent out</th>
                <th className="text-right">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, stats, record }) => (
                <tr
                  key={member}
                  className={member.toLowerCase() === address?.toLowerCase() ? "bg-base-200" : undefined}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <Address address={member} size="sm" onlyEnsOrAddress />
                      {!stats.active && <span className="badge badge-ghost badge-xs">removed</span>}
                    </div>
                  </td>
                  <td>
                    <TrackRecordBadge stats={stats} showCounts={false} />
                  </td>
                  <td className="text-right">{record.loans}</td>
                  <td className="text-right">
                    {record.lateReturns}
                    {record.defaults > 0 && <span className="text-error"> +{record.defaults} lost</span>}
                  </td>
                  <td className="text-right">{record.lent}</td>
                  <td className="text-right opacity-60">{formatDate(stats.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Members;
