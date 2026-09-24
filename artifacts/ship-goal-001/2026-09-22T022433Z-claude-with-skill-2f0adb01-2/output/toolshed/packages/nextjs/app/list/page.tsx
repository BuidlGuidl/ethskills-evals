"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { NextPage } from "next";
import { ActionButton } from "~~/components/toolshed/ActionButton";
import { ConnectPrompt, EmptyState, ToolPhoto } from "~~/components/toolshed/Bits";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useRoles, useToolMetadata, useTools } from "~~/hooks/toolshed";
import { notification } from "~~/utils/scaffold-eth";
import { type ToolMetadata, parseUsdc, pinFile, pinJson, pinningConfigured, usdcInputValue } from "~~/utils/toolshed";

/**
 * Listings are JSON: name, description, condition notes, photo. With a pinning service configured
 * it goes to IPFS and the contract stores `ipfs://CID`. Without one, the same JSON is inlined as a
 * `data:` URI — a few hundred bytes of calldata, no external dependency, and the listing survives
 * this frontend. Either way the contract only ever sees a string.
 */
const buildMetadataUri = async (metadata: ToolMetadata, canPin: boolean) => {
  if (canPin) {
    const { uri } = await pinJson(metadata);
    return uri;
  }
  return `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
};

const ListToolForm = () => {
  const router = useRouter();
  const params = useSearchParams();
  // A hand-typed or stale ?edit= must not take the whole app down with a BigInt SyntaxError.
  const editParam = params.get("edit");
  const editId = editParam && /^\d+$/.test(editParam) ? editParam : null;
  const { isMember, address } = useRoles();

  const { tools: rawTools } = useTools();
  const tools = useToolMetadata(rawTools);
  const editing = editId ? tools.find(tool => tool.id === BigInt(editId)) : undefined;

  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "Toolshed" });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [image, setImage] = useState("");
  const [deposit, setDeposit] = useState("60");
  const [dailyLateFee, setDailyLateFee] = useState("2");
  const [maxDurationDays, setMaxDurationDays] = useState("7");
  const [canPin, setCanPin] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    pinningConfigured().then(setCanPin);
  }, []);

  useEffect(() => {
    if (!editing || prefilled || !editing.metadata) return;
    setName(editing.metadata.name ?? "");
    setDescription(editing.metadata.description ?? "");
    setCondition(editing.metadata.condition ?? "");
    setImage(editing.metadata.image ?? "");
    // Exact values, not display formatting: `formatUsdc` groups thousands with commas (which do not
    // parse back) and rounds to cents (which would silently rewrite the terms on save).
    setDeposit(usdcInputValue(editing.deposit));
    setDailyLateFee(usdcInputValue(editing.dailyLateFee));
    setMaxDurationDays(String(editing.maxDurationDays));
    setPrefilled(true);
  }, [editing, prefilled]);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const { uri } = await pinFile(file);
      setImage(uri);
    } catch (error) {
      notification.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const submit = async () => {
    try {
      const depositUnits = parseUsdc(deposit);
      const feeUnits = parseUsdc(dailyLateFee);
      const days = Number(maxDurationDays);

      if (!name.trim()) return notification.error("Give it a name so neighbors know what it is");
      if (depositUnits < 1_000000n) return notification.error("The deposit has to be at least $1");
      if (feeUnits <= 0n) return notification.error("Set a daily late fee — it is what brings tools back");
      if (feeUnits * 7n > depositUnits) {
        return notification.error(
          `At that rate the deposit would be gone in under a week. Keep the daily fee at or below $${
            Number(depositUnits / 7n) / 1e6
          }.`,
        );
      }
      if (!Number.isInteger(days) || days < 1 || days > 90) {
        return notification.error("Loans run between 1 and 90 days");
      }

      const uri = await buildMetadataUri(
        { name: name.trim(), description: description.trim(), condition: condition.trim(), image: image.trim() },
        canPin,
      );

      if (editing) {
        await writeContractAsync({
          functionName: "updateTool",
          args: [editing.id, uri, depositUnits, feeUnits, days],
        });
        router.push(`/tools?id=${editing.id}`);
      } else {
        await writeContractAsync({ functionName: "listTool", args: [uri, depositUnits, feeUnits, days] });
        router.push("/dashboard");
      }
    } catch (error) {
      notification.error(error instanceof Error ? error.message : "Could not save the listing");
    }
  };

  if (!address) {
    return <ConnectPrompt title="Connect your wallet" hint="You need a member wallet to list a tool." />;
  }
  if (!isMember) {
    return (
      <EmptyState
        title="Members only"
        hint="Ask the association steward to add your address to the roll, then come back."
      />
    );
  }
  if (editing && address.toLowerCase() !== editing.owner.toLowerCase()) {
    return <EmptyState title="That's not your tool" hint="Only the owner can edit a listing." />;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-4">
        <label className="form-control">
          <span className="label-text">What is it?</span>
          <input
            className="input input-bordered"
            placeholder="Cordless hammer drill"
            value={name}
            onChange={event => setName(event.target.value)}
          />
        </label>

        <label className="form-control">
          <span className="label-text">Description</span>
          <textarea
            className="textarea textarea-bordered"
            rows={3}
            placeholder="18V, comes with two batteries and a charger in a hard case."
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </label>

        <label className="form-control">
          <span className="label-text">Condition notes</span>
          <textarea
            className="textarea textarea-bordered"
            rows={2}
            placeholder="Chuck sticks a little. Second battery holds about half a charge."
            value={condition}
            onChange={event => setCondition(event.target.value)}
          />
          <span className="label-text-alt opacity-60">
            Be honest about the wear — it is what keeps disputes from happening later.
          </span>
        </label>

        <div className="form-control">
          <span className="label-text">Photo</span>
          {canPin ? (
            <input
              type="file"
              accept="image/*"
              className="file-input file-input-bordered"
              disabled={isUploading}
              onChange={event => onPickFile(event.target.files?.[0])}
            />
          ) : (
            <input
              className="input input-bordered"
              placeholder="https://… or ipfs://… or a bare CID"
              value={image}
              onChange={event => setImage(event.target.value)}
            />
          )}
          <span className="label-text-alt mt-1 opacity-60">
            {canPin
              ? isUploading
                ? "Pinning to IPFS…"
                : "Uploads straight to IPFS."
              : "No pinning service configured, so paste a link. See the README to enable uploads."}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="form-control">
            <span className="label-text">Deposit ($)</span>
            <input
              className="input input-bordered"
              inputMode="decimal"
              value={deposit}
              onChange={event => setDeposit(event.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Late fee ($/day)</span>
            <input
              className="input input-bordered"
              inputMode="decimal"
              value={dailyLateFee}
              onChange={event => setDailyLateFee(event.target.value)}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Longest loan (days)</span>
            <input
              className="input input-bordered"
              inputMode="numeric"
              value={maxDurationDays}
              onChange={event => setMaxDurationDays(event.target.value)}
            />
          </label>
        </div>

        <ActionButton
          className="btn btn-primary self-start"
          label={editing ? "Save changes" : "List it on the shed"}
          disabled={isUploading || isMining}
          disabledReason={isUploading ? "Waiting for the photo to finish uploading…" : undefined}
          onClick={submit}
        />
        {editing && (
          <p className="m-0 text-sm opacity-60">
            New terms only apply to new requests. Anything already out keeps the terms it was agreed under.
          </p>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="border border-base-300 bg-base-100">
          <ToolPhoto image={image} name={name || "Preview"} className="h-56" />
          <div className="p-4">
            <h3 className="m-0 text-lg font-bold">{name || "Your tool"}</h3>
            <p className="m-0 text-sm opacity-70">{condition || "Condition notes show up here."}</p>
          </div>
        </div>

        <div className="border border-base-300 bg-base-100 p-4 text-sm">
          <h3 className="m-0 text-base font-bold">How the money works</h3>
          <p className="mt-2 mb-0">
            A borrower escrows <strong>${deposit || "0"}</strong> before you hand it over. Return it on time and they
            get all of it back. Every late day — a day started is a day charged — moves{" "}
            <strong>${dailyLateFee || "0"}</strong> from their deposit to you, up to the whole deposit. After that the
            loan can be written off by anyone and you keep the lot.
          </p>
          {image && !/^(https?:\/\/|ipfs:\/\/|data:|Qm|b[a-z2-7]{20})/.test(image.trim()) && (
            <p className="text-warning">
              That photo link doesn&apos;t look like a URL, an ipfs:// URI, or a CID — the listing will show a
              placeholder.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
};

const ListToolPage: NextPage = () => (
  <div className="mx-auto w-full max-w-5xl px-4 py-8">
    <h1 className="m-0 text-3xl font-black tracking-tight">Lend something</h1>
    <p className="mb-8 opacity-80">Set the deposit and the daily late fee, and it goes up on the shed.</p>
    <Suspense fallback={<div className="h-64 animate-pulse bg-base-300" />}>
      <ListToolForm />
    </Suspense>
  </div>
);

export default ListToolPage;
