"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Address as AddressDisplay } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { type Address, isAddress } from "viem";
import { ActionButton } from "~~/components/toolshed/ActionButton";
import {
  ConnectPrompt,
  EmptyState,
  LoadingBlock,
  LoanStateBadge,
  MemberLine,
  SectionHeading,
  Usd,
} from "~~/components/toolshed/Bits";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useLoanCount, useLoans, useMembers, useRecords, useRoles, useToolMetadata, useTools } from "~~/hooks/toolshed";
import { notification } from "~~/utils/scaffold-eth";
import {
  type Loan,
  LoanState,
  type Record,
  formatDate,
  lateFeeAt,
  parseUsdcSafe,
  usdcInputValue,
} from "~~/utils/toolshed";

/**
 * The steward console. Two jobs, and deliberately no more: keep the member roll current, and
 * arbitrate the loans an owner has disputed. A steward cannot pause the shed, cannot touch an
 * undisputed deposit, and cannot award more than the disputed loan's own escrow.
 */
const Steward: NextPage = () => {
  const { address, isSteward, isLoadingRoles } = useRoles();
  const { members, refetch: refetchMembers } = useMembers();
  const { tools: rawTools } = useTools();
  const tools = useToolMetadata(rawTools);
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });

  // Disputes are rare and there is no index for them, so the console reads every loan and filters.
  // One batched call, and a 300-household shed will not have enough loans for that to matter.
  const loanCount = useLoanCount();
  const allLoanIds = useMemo(
    () => Array.from({ length: Number(loanCount) }, (_, index) => BigInt(index + 1)),
    [loanCount],
  );
  const { loans, refetch: refetchLoans } = useLoans(allLoanIds);
  const disputed = loans.filter(loan => loan.state === LoanState.Disputed);
  const { recordOf } = useRecords(useMemo(() => disputed.map(loan => loan.borrower), [disputed]));

  const [roster, setRoster] = useState("");

  if (!address) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <ConnectPrompt
          title="Connect the steward wallet"
          hint="This screen is for the association's steward multisig: the member roll and disputed loans."
        />
      </div>
    );
  }

  if (isLoadingRoles) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <LoadingBlock className="h-40" />
      </div>
    );
  }

  if (!isSteward) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <EmptyState
          title="This wallet is not the steward"
          hint="The member roll and dispute rulings are handled by the association's steward multisig. If that is you, connect that wallet instead."
        />
      </div>
    );
  }

  const addMembers = async () => {
    const addresses = roster
      .split(/[\s,]+/)
      .map(entry => entry.trim())
      .filter(Boolean);
    if (addresses.length === 0) return notification.error("Paste one or more addresses");
    const bad = addresses.filter(entry => !isAddress(entry));
    if (bad.length > 0) {
      // Name every bad line, not just the first — re-checking a 300-address paste one error at a
      // time is not a reasonable way to spend a Sunday.
      return notification.error(
        `${bad.length} of ${addresses.length} lines are not addresses: ${bad.slice(0, 3).join(", ")}${
          bad.length > 3 ? ` and ${bad.length - 3} more` : ""
        }`,
      );
    }
    if (addresses.length > 150) {
      return notification.error("Add them in batches of 150 or fewer so the transaction stays comfortably in a block");
    }

    await writeContractAsync({ functionName: "addMembers", args: [addresses as Address[]] });
    setRoster("");
    await refetchMembers();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="m-0 text-3xl font-black tracking-tight">Steward</h1>
      <p className="mb-8 opacity-80">The member roll, and the disputes that need a human.</p>

      <section className="mb-10 flex flex-col gap-3">
        <SectionHeading
          title={`Disputed loans (${disputed.length})`}
          hint="Decide how much of the escrow the owner keeps. The rest goes back to the borrower."
        />
        {disputed.length === 0 ? (
          <EmptyState title="Nothing disputed" hint="Loans are settling on their own, which is the idea." />
        ) : (
          disputed.map(loan => (
            <DisputeCard
              key={loan.id.toString()}
              loan={loan}
              toolName={tools.find(tool => tool.id === loan.toolId)?.metadata?.name}
              borrowerRecord={recordOf(loan.borrower)}
              onResolve={async award => {
                await writeContractAsync({ functionName: "resolveDispute", args: [loan.id, award] });
                await refetchLoans();
              }}
            />
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title={`Member roll (${members.filter(member => member.active).length} active)`}
          href="/members"
          hrefLabel="See track records →"
        />
        <div className="border border-base-300 bg-base-100 p-4">
          <label className="form-control">
            <span className="label-text">Add members — one address per line, or comma separated</span>
            <textarea
              className="textarea textarea-bordered font-mono text-xs"
              rows={4}
              placeholder="0xabc…&#10;0xdef…"
              value={roster}
              onChange={event => setRoster(event.target.value)}
            />
          </label>
          <ActionButton className="btn btn-primary btn-sm mt-3" label="Add to the roll" onClick={addMembers} />
          <p className="mt-2 mb-0 text-xs opacity-60">
            One transaction for the whole batch — adding 300 households costs a few cents on Base.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <tbody>
              {members.map(member => (
                <tr key={member.address} className={member.active ? "" : "opacity-50"}>
                  <td>
                    <AddressDisplay address={member.address} size="sm" />
                  </td>
                  <td className="text-right">
                    {member.active ? (
                      <ActionButton
                        className="btn btn-ghost btn-xs"
                        label="Remove"
                        onClick={async () => {
                          await writeContractAsync({ functionName: "removeMember", args: [member.address] });
                          await refetchMembers();
                        }}
                      />
                    ) : (
                      <ActionButton
                        className="btn btn-ghost btn-xs"
                        label="Re-add"
                        onClick={async () => {
                          await writeContractAsync({ functionName: "addMembers", args: [[member.address]] });
                          await refetchMembers();
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const minOf = (a: bigint, b: bigint) => (a < b ? a : b);

const DisputeCard = ({
  loan,
  toolName,
  borrowerRecord,
  onResolve,
}: {
  loan: Loan & { id: bigint };
  toolName?: string;
  borrowerRecord?: Record;
  onResolve: (award: bigint) => Promise<void>;
}) => {
  const byTheBook = lateFeeAt(loan, loan.returnedAt);
  // Raw value, not display formatting: a "1,500" default would parse back as zero and silently
  // award the owner nothing.
  const [award, setAward] = useState(usdcInputValue(byTheBook));
  const awarded = parseUsdcSafe(award);

  return (
    <div className="border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/tools?id=${loan.toolId}`} className="text-lg font-bold hover:underline">
            {toolName ?? `Tool #${loan.toolId}`}
          </Link>
          <div className="text-sm">
            <span className="opacity-60">borrowed by </span>
            <MemberLine address={loan.borrower} record={borrowerRecord} />
          </div>
        </div>
        <LoanStateBadge state={loan.state} outcome={loan.outcome} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase opacity-60">Escrow</dt>
          <dd className="m-0">
            <Usd amount={loan.deposit} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase opacity-60">Due</dt>
          <dd className="m-0">{formatDate(loan.dueAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase opacity-60">Return claimed</dt>
          <dd className="m-0">{formatDate(loan.returnedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase opacity-60">By the ordinary rule</dt>
          <dd className="m-0">
            <Usd amount={byTheBook} /> to the owner
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="form-control">
          <span className="label-text text-xs uppercase opacity-60">Award to the owner ($)</span>
          <input
            className="input input-bordered input-sm w-32"
            inputMode="decimal"
            value={award}
            onChange={event => setAward(event.target.value)}
          />
        </label>
        <ActionButton
          label="Rule on it"
          onClick={async () => {
            const units = parseUsdcSafe(award);
            if (units > loan.deposit) return notification.error("The award cannot exceed the escrow");
            await onResolve(units);
          }}
        />
        <span className="text-xs opacity-60">
          <Usd amount={loan.deposit - minOf(awarded, loan.deposit)} /> goes back to the borrower. The track record
          follows the money:{" "}
          {awarded >= loan.deposit
            ? "the whole escrow means the tool never came back"
            : awarded > 0n
              ? "a part of it means it came back late"
              : "nothing means the borrower was in the right"}
          .
        </span>
      </div>
    </div>
  );
};

export default Steward;
