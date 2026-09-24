"use client";

import { useState } from "react";
import { ListToolForm } from "~~/components/toolshed/ListToolForm";
import { ToolPhoto } from "~~/components/toolshed/ToolPhoto";
import { TxButton } from "~~/components/toolshed/TxButton";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useToolMetadata } from "~~/hooks/toolshed/useToolshed";
import { formatUsdc } from "~~/utils/toolshed/format";
import { Tool } from "~~/utils/toolshed/types";

export const MyToolRow = ({ tool }: { tool: Tool }) => {
  const { data: metadata } = useToolMetadata(tool.metadataURI);
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });
  const [isEditing, setIsEditing] = useState(false);

  const isOut = tool.activeLoanId !== 0n;

  return (
    <div className="border border-base-300 bg-base-100 rounded-box p-4 flex flex-col gap-3">
      <div className="flex gap-4">
        <ToolPhoto src={metadata?.photo} alt={metadata?.name ?? "Tool"} className="h-20 w-20 rounded-box shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{metadata?.name ?? `Tool #${tool.id}`}</div>
          <div className="text-sm opacity-70 line-clamp-2">{metadata?.condition}</div>
          <div className="text-xs opacity-60 mt-1">
            {formatUsdc(tool.deposit)} deposit · {formatUsdc(tool.feePerDay)}/day late · up to {tool.maxDays} days
          </div>
        </div>
        <div className="text-right">
          <span className={`badge ${isOut ? "badge-warning" : tool.available ? "badge-success" : "badge-ghost"}`}>
            {isOut ? "Out" : tool.available ? "On the shelf" : "Shelved"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TxButton
          className="btn btn-sm btn-ghost"
          disabled={isOut}
          onClick={async () => {
            await writeContractAsync({
              functionName: "setToolAvailability",
              args: [BigInt(tool.id), !tool.available],
            });
          }}
        >
          {tool.available ? "Take off the shelf" : "Put back on the shelf"}
        </TxButton>
        <button className="btn btn-sm btn-ghost" onClick={() => setIsEditing(editing => !editing)}>
          {isEditing ? "Close" : "Edit"}
        </button>
        <TxButton
          className="btn btn-sm btn-ghost text-error"
          disabled={isOut}
          onClick={async () => {
            await writeContractAsync({ functionName: "retireTool", args: [BigInt(tool.id)] });
          }}
        >
          Retire
        </TxButton>
      </div>

      {isEditing && (
        <div className="border-t border-base-300 pt-3">
          <ListToolForm
            tool={tool}
            initialName={metadata?.name}
            initialPhoto={metadata?.photo}
            initialCondition={metadata?.condition}
            onDone={() => setIsEditing(false)}
          />
        </div>
      )}
    </div>
  );
};
