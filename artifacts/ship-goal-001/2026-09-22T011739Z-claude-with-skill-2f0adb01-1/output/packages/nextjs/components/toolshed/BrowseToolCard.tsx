"use client";

import { useState } from "react";
import { Address } from "@scaffold-ui/components";
import { useAccount } from "wagmi";
import { DepositAction } from "~~/components/toolshed/DepositAction";
import { ToolPhoto } from "~~/components/toolshed/ToolPhoto";
import { TrackRecordBadge } from "~~/components/toolshed/TrackRecordBadge";
import { TxButton } from "~~/components/toolshed/TxButton";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useToolMetadata } from "~~/hooks/toolshed/useToolshed";
import { formatUsdc } from "~~/utils/toolshed/format";
import { MemberStats, Tool } from "~~/utils/toolshed/types";

type Props = {
  tool: Tool;
  ownerStats: MemberStats;
  canBorrow: boolean;
  /** Whatever is holding this tool, if anything — a tool can only be out once at a time. */
  hold?: { reason: string; expirableLoanId?: number };
};

export const BrowseToolCard = ({ tool, ownerStats, canBorrow, hold }: Props) => {
  const { address } = useAccount();
  const { data: metadata, isLoading, isError } = useToolMetadata(tool.metadataURI);
  const [days, setDays] = useState(Math.min(3, tool.maxDays));
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });

  const isOwn = address?.toLowerCase() === tool.owner.toLowerCase();
  const maxFee = BigInt(days) * tool.feePerDay;

  return (
    <div className="card bg-base-100 border border-base-300 overflow-hidden">
      <ToolPhoto src={metadata?.photo} alt={metadata?.name ?? "Tool"} className="h-44 w-full" />

      <div className="card-body gap-3 p-5">
        <div>
          <h3 className="font-bold text-lg leading-tight m-0">
            {isLoading ? <span className="loading loading-dots loading-xs" /> : (metadata?.name ?? "Unnamed tool")}
          </h3>
          <p className="text-sm opacity-70 m-0 mt-1 line-clamp-3">
            {isError ? "Listing details could not be loaded." : metadata?.condition}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex flex-col gap-1">
            <Address address={tool.owner} size="xs" onlyEnsOrAddress />
            <TrackRecordBadge stats={ownerStats} showCounts={false} />
          </div>
          <div className="text-right">
            <div className="font-semibold">{formatUsdc(tool.deposit)}</div>
            <div className="text-xs opacity-60">deposit</div>
          </div>
        </div>

        <div className="text-xs opacity-70 border-t border-base-300 pt-2">
          Late fee {formatUsdc(tool.feePerDay)}/day · up to {tool.maxDays} days
        </div>

        {hold ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm opacity-60">{hold.reason}</span>
            {hold.expirableLoanId !== undefined && (
              <TxButton
                className="btn btn-sm btn-ghost self-start"
                onClick={async () => {
                  await writeContractAsync({
                    functionName: "expireRequest",
                    args: [BigInt(hold.expirableLoanId as number)],
                  });
                }}
              >
                Free it up (refunds the deposit)
              </TxButton>
            )}
          </div>
        ) : isOwn ? (
          <div className="text-sm opacity-60">This is your tool.</div>
        ) : !canBorrow ? (
          <div className="text-sm opacity-60">Only members can borrow — ask the steward to add you.</div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="whitespace-nowrap">Borrow for</span>
              <input
                type="number"
                min={1}
                max={tool.maxDays}
                value={days}
                onChange={e => setDays(Math.max(1, Math.min(tool.maxDays, Number(e.target.value) || 1)))}
                className="input input-sm input-bordered w-20"
              />
              <span>days</span>
            </label>
            <p className="text-xs opacity-60 m-0">
              You escrow {formatUsdc(tool.deposit)} now and get it back on return. Bring it back late and up to{" "}
              {formatUsdc(maxFee)} of it goes to {isOwn ? "you" : "the owner"} for {days} day
              {days === 1 ? "" : "s"}.
            </p>
            <DepositAction
              amount={tool.deposit}
              label="Ask to borrow"
              onExecute={async () => {
                await writeContractAsync({ functionName: "requestLoan", args: [BigInt(tool.id), days] });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
