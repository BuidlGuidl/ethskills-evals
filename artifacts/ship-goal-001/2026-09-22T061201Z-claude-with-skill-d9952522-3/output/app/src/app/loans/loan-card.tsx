"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useAccount, usePublicClient, useSignTypedData, useWriteContract} from "wagmi";

import {MemberLink, Usdc} from "@/components/ui.tsx";
import {ToolshedEscrowAbi, explorerTxUrl} from "@/contracts/config.ts";
import {RECEIPT_TYPES, eip712Domain} from "@/core/eip712.ts";
import {forfeitableAt, relativeTime, settle} from "@/core/loan.ts";
import type {Loan} from "@/server/loans.ts";

/** Serialised form of `Loan` — bigints arrive from the server as decimal strings. */
type LoanProp = Omit<Loan, "deposit" | "dailyLateFee" | "ownerAmount" | "borrowerAmount"> & {
  deposit: bigint | string;
  dailyLateFee: bigint | string;
  ownerAmount: bigint | string | null;
  borrowerAmount: bigint | string | null;
};

/**
 * One loan, with whichever actions are actually available to this member right now.
 *
 * Every button here is a direct call to the escrow. The server is never in the path of the money:
 * if this app disappeared tomorrow, a member could still settle their loan from a block explorer.
 */
export function LoanCard({loan, me}: {loan: LoanProp; me: string}) {
  const router = useRouter();
  const {chainId} = useAccount();
  const publicClient = usePublicClient();
  const {writeContractAsync} = useWriteContract();
  const {signTypedDataAsync} = useSignTypedData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowSeconds, setNowSeconds] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  // Late fees tick in whole days, but the countdown to the next day is what makes someone walk
  // the drill back round tonight rather than tomorrow. Refresh it every second.
  useEffect(() => {
    const timer = setInterval(() => setNowSeconds(BigInt(Math.floor(Date.now() / 1000))), 1_000);
    return () => clearInterval(timer);
  }, []);

  const deposit = BigInt(loan.deposit);
  const dailyLateFee = BigInt(loan.dailyLateFee);
  const terms = {deposit, dailyLateFee, dueAt: BigInt(loan.dueAt)};

  const isOwner = loan.ownerAddress === me;
  const isBorrower = loan.borrowerAddress === me;
  const escrow = process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`;
  const configuredChain = Number(process.env.NEXT_PUBLIC_CHAIN_ID);

  const live = settle(terms, nowSeconds);
  const overdue = nowSeconds > terms.dueAt;
  const forfeitAt = forfeitableAt(terms);

  async function send(label: string, functionName: string, args: readonly unknown[]) {
    setError(null);
    setBusy(label);
    try {
      if (chainId !== configuredChain) {
        throw new Error(`Switch your wallet to chain ${configuredChain} first.`);
      }
      const hash = await writeContractAsync({
        address: escrow,
        abi: ToolshedEscrowAbi,
        functionName,
        args,
      });
      await publicClient?.waitForTransactionReceipt({hash});
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transaction failed.");
    } finally {
      setBusy(null);
    }
  }

  /**
   * The owner signs a receipt saying the tool came back at this moment. Costs no gas, and lets
   * the borrower close the loan themselves — the fee clock stops at the time on the receipt, not
   * whenever the owner gets round to confirming.
   */
  async function signReceipt() {
    setError(null);
    setBusy("receipt");
    try {
      const returnedAt = BigInt(Math.floor(Date.now() / 1000));
      const signature = await signTypedDataAsync({
        domain: eip712Domain(configuredChain, escrow),
        types: RECEIPT_TYPES,
        primaryType: "Receipt",
        message: {loanId: loan.loanId as `0x${string}`, returnedAt},
      });
      const response = await fetch(`/api/loans/${loan.loanId}/receipt`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({returnedAt: Number(returnedAt), signature}),
      });
      if (!response.ok) {
        const {error: reason} = (await response.json()) as {error: string};
        throw new Error(reason);
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign the receipt.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          {loan.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={loan.photoPath} alt="" className="h-16 w-16 rounded-md object-cover" />
          ) : null}
          <div>
            <p className="font-medium">{loan.listingTitle ?? "Tool"}</p>
            <p className="text-sm text-stone-600">
              {isOwner ? "Lent to " : "Borrowed from "}
              <MemberLink
                address={isOwner ? loan.borrowerAddress : loan.ownerAddress}
                name={isOwner ? loan.borrowerName : loan.ownerName}
              />
            </p>
          </div>
        </div>

        <div className="text-right text-sm">
          {loan.status === "closed" ? (
            <ClosedSummary loan={loan} />
          ) : (
            <>
              <p className={overdue ? "font-medium text-red-700" : "text-stone-700"}>
                {overdue ? "Overdue — due " : "Due "}
                {relativeTime(terms.dueAt, nowSeconds)}
              </p>
              <p className="mt-1 text-stone-600">
                Deposit <Usdc amount={deposit} />
              </p>
            </>
          )}
        </div>
      </div>

      {loan.status !== "closed" ? (
        <div className="rounded-md bg-stone-50 p-3 text-sm">
          {overdue ? (
            <p>
              <strong>{live.lateDays.toString()}</strong> day
              {live.lateDays === 1n ? "" : "s"} late — <Usdc amount={live.ownerAmount} /> of the
              deposit has moved to the owner, <Usdc amount={live.borrowerAmount} /> would come
              back to the borrower.
            </p>
          ) : (
            <p className="text-stone-600">
              On time. The whole <Usdc amount={deposit} /> deposit comes back if it is returned by
              the due date. After that it is <Usdc amount={dailyLateFee} /> per started day.
            </p>
          )}
          {live.borrowerAmount === 0n && overdue ? (
            <p className="mt-1 text-red-700">
              Late fees have reached the whole deposit. The owner can now claim all of it and
              close the loan.
            </p>
          ) : overdue ? (
            <p className="mt-1 text-stone-500">
              The owner can claim the entire deposit from {relativeTime(forfeitAt, nowSeconds)}.
            </p>
          ) : null}
        </div>
      ) : null}

      {loan.status === "disputed" ? (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Escalated to the committee. Nobody can settle this unilaterally now — the arbiter will
          split the deposit.
        </p>
      ) : null}

      {loan.receipt && loan.status === "active" ? (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          The owner signed a return receipt dated{" "}
          {new Date(loan.receipt.returnedAt * 1000).toLocaleString()}. The borrower can close the
          loan at that time, whatever the clock says now.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {loan.status === "active" ? (
        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <>
              <button
                className="btn-primary"
                disabled={Boolean(busy)}
                onClick={() => void send("confirm", "confirmReturn", [loan.loanId])}
              >
                {busy === "confirm" ? "Confirming…" : "I got it back"}
              </button>
              <button className="btn-secondary" disabled={Boolean(busy)} onClick={() => void signReceipt()}>
                {busy === "receipt" ? "Signing…" : "Sign a return receipt"}
              </button>
              {live.borrowerAmount === 0n && overdue ? (
                <button
                  className="btn-danger"
                  disabled={Boolean(busy)}
                  onClick={() => void send("forfeit", "claimForfeit", [loan.loanId])}
                >
                  Claim the whole deposit
                </button>
              ) : null}
            </>
          ) : null}

          {isBorrower && loan.receipt ? (
            <button
              className="btn-primary"
              disabled={Boolean(busy)}
              onClick={() =>
                void send("close", "closeWithReceipt", [
                  loan.loanId,
                  BigInt(loan.receipt!.returnedAt),
                  loan.receipt!.signature,
                ])
              }
            >
              {busy === "close" ? "Closing…" : "Close with the receipt"}
            </button>
          ) : null}

          <button
            className="btn-secondary"
            disabled={Boolean(busy)}
            onClick={() => void send("dispute", "dispute", [loan.loanId])}
          >
            Escalate to the committee
          </button>
        </div>
      ) : null}

      <p className="text-xs text-stone-400">
        <a
          className="hover:underline"
          href={explorerTxUrl(configuredChain, loan.closedTx ?? loan.openedTx)}
          target="_blank"
          rel="noreferrer"
        >
          View onchain
        </a>
      </p>
    </li>
  );
}

function ClosedSummary({loan}: {loan: LoanProp}) {
  const ownerAmount = loan.ownerAmount === null ? 0n : BigInt(loan.ownerAmount);
  const borrowerAmount = loan.borrowerAmount === null ? 0n : BigInt(loan.borrowerAmount);

  const headline =
    loan.outcome === "forfeited"
      ? "Never came back"
      : loan.outcome === "arbitrated"
        ? "Settled by the committee"
        : (loan.lateDays ?? 0) > 0
          ? `${loan.lateDays} day${loan.lateDays === 1 ? "" : "s"} late`
          : "Returned on time";

  return (
    <>
      <p className="font-medium text-stone-800">{headline}</p>
      <p className="mt-1 text-stone-600">
        <Usdc amount={ownerAmount} /> to the owner, <Usdc amount={borrowerAmount} /> back to the
        borrower
      </p>
    </>
  );
}
