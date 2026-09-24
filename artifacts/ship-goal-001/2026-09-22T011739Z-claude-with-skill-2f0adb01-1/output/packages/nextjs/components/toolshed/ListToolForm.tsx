"use client";

import { useState } from "react";
import { TxButton } from "~~/components/toolshed/TxButton";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { formatUsdc, parseUsdc } from "~~/utils/toolshed/format";
import { ipfsConfigured, publishMetadata, uploadPhoto } from "~~/utils/toolshed/metadata";
import { Tool } from "~~/utils/toolshed/types";

type Props = {
  /** Present when editing an existing listing. */
  tool?: Tool;
  initialName?: string;
  initialPhoto?: string;
  initialCondition?: string;
  onDone?: () => void;
};

export const ListToolForm = ({ tool, initialName, initialPhoto, initialCondition, onDone }: Props) => {
  const [name, setName] = useState(initialName ?? "");
  const [condition, setCondition] = useState(initialCondition ?? "");
  const [photo, setPhoto] = useState(initialPhoto ?? "");
  const [deposit, setDeposit] = useState(tool ? formatUsdc(tool.deposit, false) : "60");
  const [feePerDay, setFeePerDay] = useState(tool ? formatUsdc(tool.feePerDay, false) : "2");
  const [maxDays, setMaxDays] = useState(tool ? tool.maxDays : 7);
  const [isUploading, setIsUploading] = useState(false);

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "Toolshed" });

  const depositUnits = parseUsdc(deposit);
  const feeUnits = parseUsdc(feePerDay);
  const problem = !name.trim()
    ? "Give the tool a name"
    : depositUnits === undefined || depositUnits <= 0n
      ? "Set a deposit, as a plain number of USDC"
      : feeUnits === undefined || feeUnits <= 0n
        ? "Set a daily late fee, as a plain number of USDC"
        : feeUnits > depositUnits
          ? "The daily late fee can't be bigger than the deposit"
          : maxDays < 1 || maxDays > 60
            ? "Loan length must be between 1 and 60 days"
            : undefined;

  // Not a blocker, just worth saying out loud before somebody signs it.
  const harshFee =
    !problem && depositUnits !== undefined && feeUnits !== undefined && feeUnits * 4n > depositUnits
      ? `At ${formatUsdc(feeUnits)} a day, the whole deposit is gone after ${Math.ceil(
          Number(depositUnits) / Number(feeUnits),
        )} late day(s).`
      : undefined;

  const submit = async () => {
    if (depositUnits === undefined || feeUnits === undefined) return;
    const metadataURI = await publishMetadata({ name: name.trim(), photo: photo.trim(), condition: condition.trim() });
    if (tool) {
      await writeContractAsync({
        functionName: "updateTool",
        args: [BigInt(tool.id), metadataURI, depositUnits, feeUnits, maxDays],
      });
    } else {
      await writeContractAsync({
        functionName: "listTool",
        args: [metadataURI, depositUnits, feeUnits, maxDays],
      });
    }
    onDone?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col">
        <span className="label-text mb-1">What is it?</span>
        <input
          className="input input-bordered"
          placeholder="Cordless drill, 18V"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </label>

      <label className="flex flex-col">
        <span className="label-text mb-1">Condition notes</span>
        <textarea
          className="textarea textarea-bordered"
          rows={3}
          placeholder="Battery holds about 40 minutes. Chuck sticks if you overtighten it."
          value={condition}
          onChange={e => setCondition(e.target.value)}
        />
      </label>

      <label className="flex flex-col">
        <span className="label-text mb-1">Photo</span>
        {ipfsConfigured ? (
          <input
            type="file"
            accept="image/*"
            className="file-input file-input-bordered"
            disabled={isUploading}
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              setIsUploading(true);
              try {
                setPhoto(await uploadPhoto(file));
                notification.success("Photo uploaded to IPFS");
              } catch (error) {
                console.error(error);
                notification.error("Photo upload failed — check NEXT_PUBLIC_IPFS_API_URL");
              } finally {
                setIsUploading(false);
              }
            }}
          />
        ) : (
          <>
            <input
              className="input input-bordered"
              placeholder="https://… or ipfs://…"
              value={photo}
              onChange={e => setPhoto(e.target.value)}
            />
            <span className="text-xs opacity-60 mt-1">
              Paste a link to a photo. Set NEXT_PUBLIC_IPFS_API_URL to upload files directly instead.
            </span>
          </>
        )}
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col">
          <span className="label-text mb-1">Deposit</span>
          <input
            className="input input-bordered"
            inputMode="decimal"
            value={deposit}
            onChange={e => setDeposit(e.target.value)}
          />
          <span className="text-xs opacity-60 mt-1">USDC</span>
        </label>
        <label className="flex flex-col">
          <span className="label-text mb-1">Late fee / day</span>
          <input
            className="input input-bordered"
            inputMode="decimal"
            value={feePerDay}
            onChange={e => setFeePerDay(e.target.value)}
          />
          <span className="text-xs opacity-60 mt-1">USDC</span>
        </label>
        <label className="flex flex-col">
          <span className="label-text mb-1">Max loan</span>
          <input
            className="input input-bordered"
            type="number"
            min={1}
            max={60}
            value={maxDays}
            onChange={e => setMaxDays(Number(e.target.value) || 1)}
          />
          <span className="text-xs opacity-60 mt-1">days</span>
        </label>
      </div>

      <p className="text-xs opacity-60 m-0">
        Pick a deposit that would cover replacing the tool: it&apos;s the most a late or lost loan can ever pay you.
      </p>

      {problem && <div className="text-sm text-warning">{problem}</div>}
      {harshFee && <div className="text-sm opacity-70">{harshFee}</div>}

      <TxButton className="btn btn-primary self-start" disabled={Boolean(problem) || isUploading} onClick={submit}>
        {tool ? "Save changes" : "List this tool"}
      </TxButton>
    </div>
  );
};
