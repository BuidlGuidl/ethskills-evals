"use client";

import { useMemo, useState } from "react";
import { Address, AddressInput } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { isAddress } from "viem";
import { TrackRecordBadge } from "~~/components/toolshed/TrackRecordBadge";
import { TxButton } from "~~/components/toolshed/TxButton";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useNow } from "~~/hooks/toolshed/useNow";
import { useIsSteward, useLoans, useMembers, useTools } from "~~/hooks/toolshed/useToolshed";
import { formatUsdc, lateDays } from "~~/utils/toolshed/format";
import { LoanStatus } from "~~/utils/toolshed/types";

const Steward: NextPage = () => {
  const isSteward = useIsSteward();
  const { addresses, statsFor } = useMembers();
  const { loans } = useLoans();
  const { tools } = useTools();
  const now = useNow();
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });

  const [newMember, setNewMember] = useState("");
  const [lateDaysByLoan, setLateDaysByLoan] = useState<Record<number, string>>({});

  const toolById = useMemo(() => new Map(tools.map(tool => [tool.id, tool])), [tools]);
  const disputed = useMemo(
    () =>
      loans.filter(
        loan => loan.disputed && (loan.status === LoanStatus.Active || loan.status === LoanStatus.ReturnDeclared),
      ),
    [loans],
  );

  if (!isSteward) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center opacity-70">
        This page is for the association&apos;s steward account.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 flex flex-col gap-10">
      <header>
        <h1 className="text-3xl font-bold m-0">Steward</h1>
        <p className="opacity-70 m-0 mt-1">
          Keep the roster, and settle the returns neighbours can&apos;t agree on. You can never take more than the
          deposit, and you can&apos;t touch a loan nobody has disputed.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold m-0">Admit a neighbour</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex-1">
            <AddressInput value={newMember} onChange={setNewMember} placeholder="0x… or ENS name" />
          </div>
          <TxButton
            className="btn btn-primary"
            disabled={!isAddress(newMember)}
            onClick={async () => {
              await writeContractAsync({ functionName: "admitMember", args: [newMember] });
              setNewMember("");
            }}
          >
            Add to the roster
          </TxButton>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold m-0">Disputed returns</h2>
        {disputed.length === 0 ? (
          <p className="opacity-60 m-0">Nothing to arbitrate.</p>
        ) : (
          disputed.map(loan => {
            const tool = toolById.get(loan.toolId);
            const accrued = lateDays(loan.dueAt, now);
            const entered = lateDaysByLoan[loan.id] ?? String(accrued);
            // Whole days only: the input is free text and the contract takes a uint32.
            const days = BigInt(Math.max(0, Math.floor(Number(entered)) || 0));
            const fee = days * loan.feePerDay;
            const capped = fee > loan.deposit ? loan.deposit : fee;

            return (
              <div key={loan.id} className="border border-base-300 bg-base-100 rounded-box p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-semibold">Loan #{loan.id}</div>
                    <div className="flex items-center gap-2 opacity-70">
                      <span>owner</span>
                      <Address address={tool?.owner} size="xs" onlyEnsOrAddress />
                      <span>borrower</span>
                      <Address address={loan.borrower} size="xs" onlyEnsOrAddress />
                    </div>
                  </div>
                  <TrackRecordBadge stats={statsFor(loan.borrower)} />
                </div>

                <div className="text-sm opacity-70">
                  {formatUsdc(loan.deposit)} deposit · {formatUsdc(loan.feePerDay)}/day · {accrued} days late so far
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col">
                    <span className="label-text mb-1">Late days to charge</span>
                    <input
                      type="number"
                      min={0}
                      className="input input-bordered input-sm w-28"
                      value={entered}
                      onChange={e => setLateDaysByLoan(prev => ({ ...prev, [loan.id]: e.target.value }))}
                    />
                  </label>
                  <div className="text-sm opacity-70">
                    {formatUsdc(capped)} to the owner, {formatUsdc(loan.deposit - capped)} back to the borrower
                  </div>
                  <TxButton
                    onClick={async () => {
                      await writeContractAsync({
                        functionName: "resolveDispute",
                        args: [BigInt(loan.id), Number(days)],
                      });
                    }}
                  >
                    Settle it
                  </TxButton>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold m-0">Roster</h2>
        <div className="overflow-x-auto border border-base-300 rounded-box bg-base-100">
          <table className="table table-sm">
            <tbody>
              {addresses.map(member => {
                const stats = statsFor(member);
                return (
                  <tr key={member}>
                    <td>
                      <Address address={member} size="sm" onlyEnsOrAddress />
                    </td>
                    <td>
                      <TrackRecordBadge stats={stats} showCounts={false} />
                    </td>
                    <td className="text-right">
                      {stats.active ? (
                        <TxButton
                          className="btn btn-xs btn-ghost text-error"
                          onClick={async () => {
                            await writeContractAsync({ functionName: "removeMember", args: [member] });
                          }}
                        >
                          Remove
                        </TxButton>
                      ) : (
                        <TxButton
                          className="btn btn-xs btn-ghost"
                          onClick={async () => {
                            await writeContractAsync({ functionName: "admitMember", args: [member] });
                          }}
                        >
                          Re-admit
                        </TxButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs opacity-60 m-0">
          Removing somebody stops them listing or borrowing. Loans already running settle normally — removal never traps
          a deposit.
        </p>
      </section>
    </div>
  );
};

export default Steward;
