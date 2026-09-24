"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {useAccount, usePublicClient, useWriteContract} from "wagmi";

import {Empty} from "@/components/ui.tsx";
import {Erc20Abi, ToolshedEscrowAbi} from "@/contracts/config.ts";
import {deserialiseTerms} from "@/core/eip712.ts";
import type {BorrowRequest} from "@/server/requests.ts";

/**
 * The borrower's side: what I have asked for, and the one button that actually starts a loan.
 *
 * Collecting the tool is two transactions — approve the escrow to move the deposit, then open the
 * loan. The second one carries the owner's signature, so the whole handover settles in a single
 * onchain interaction from the owner's point of view: they signed, and never touched the chain.
 */
export function OutgoingList({requests}: {requests: BorrowRequest[]}) {
  if (requests.length === 0) {
    return <Empty>You have not asked to borrow anything yet.</Empty>;
  }
  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <OutgoingCard key={request.id} request={request} />
      ))}
    </ul>
  );
}

function OutgoingCard({request}: {request: BorrowRequest}) {
  const router = useRouter();
  const {address, chainId} = useAccount();
  const publicClient = usePublicClient();
  const {writeContractAsync} = useWriteContract();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expired =
    request.offerExpiry !== null ? request.offerExpiry * 1000 < Date.now() : false;

  async function collect() {
    if (!request.terms || !request.ownerSignature || !publicClient) return;
    setError(null);
    try {
      const escrow = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`;
      const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
      const configuredChain = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
      if (chainId !== configuredChain) {
        throw new Error(`Switch your wallet to chain ${configuredChain} first.`);
      }

      const terms = deserialiseTerms(request.terms);

      // Only approve if the existing allowance is short — a member who borrows regularly should
      // not be asked to sign an approval every single time.
      setStep("Checking your USDC allowance…");
      const allowance = (await publicClient.readContract({
        address: usdc,
        abi: Erc20Abi,
        functionName: "allowance",
        args: [address as `0x${string}`, escrow],
      })) as bigint;

      if (allowance < terms.deposit) {
        setStep("Approving the deposit…");
        const approveHash = await writeContractAsync({
          address: usdc,
          abi: Erc20Abi,
          functionName: "approve",
          args: [escrow, terms.deposit],
        });
        await publicClient.waitForTransactionReceipt({hash: approveHash});
      }

      setStep("Opening the loan…");
      const hash = await writeContractAsync({
        address: escrow,
        abi: ToolshedEscrowAbi,
        functionName: "openLoan",
        args: [terms, request.ownerSignature as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({hash});

      setStep("Done — the indexer will pick it up in a few seconds.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the loan.");
      setStep(null);
    }
  }

  return (
    <li className="card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">
          <Link href={`/tools/${request.listingId}`} className="hover:underline">
            {request.listingTitle}
          </Link>{" "}
          <span className="font-normal text-stone-600">· {request.days} days</span>
        </p>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
          {request.status}
        </span>
      </div>

      {request.status === "pending" ? (
        <p className="text-sm text-stone-600">Waiting for the owner to approve.</p>
      ) : null}

      {request.status === "declined" ? (
        <p className="text-sm text-stone-600">The owner passed on this one.</p>
      ) : null}

      {request.status === "opened" ? (
        <p className="text-sm text-stone-600">
          Collected. <Link href="/loans" className="underline">Track it on your loans page.</Link>
        </p>
      ) : null}

      {request.status === "approved" ? (
        expired ? (
          <p className="text-sm text-stone-600">
            Approved, but you did not collect it in time and the offer has expired. Ask again.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">
              Approved. Pay the deposit to start the loan — the clock is already running, so
              collect it soon.
            </p>
            {step ? <p className="text-sm text-stone-500">{step}</p> : null}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button className="btn-primary" disabled={Boolean(step) && !error} onClick={() => void collect()}>
              Pay deposit and collect
            </button>
          </div>
        )
      ) : null}
    </li>
  );
}
