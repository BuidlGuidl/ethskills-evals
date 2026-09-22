"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { toolshedAbi } from "@/core/abi";
import { toolshedAddress } from "@/core/chain";
import type { Loan } from "@/core/loans";

/**
 * Every button here maps to exactly one contract call, and which buttons you
 * see depends on which side of the loan you are on — see the state-transition
 * table in the README.
 */

type Action = {
  fn:
    | "approve"
    | "decline"
    | "withdrawRequest"
    | "expireRequest"
    | "confirmReturn"
    | "assertReturn"
    | "objectToReturn"
    | "settleUnchallenged"
    | "claimUnreturned";
  label: string;
  hint?: string;
  secondary?: boolean;
};

const REQUEST_TTL = 3 * 86_400;

function actionsFor(loan: Loan, viewer: string | undefined): Action[] {
  if (!viewer) return [];
  const isOwner = viewer === loan.ownerAddress.toLowerCase();
  const isBorrower = viewer === loan.borrowerAddress.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const out: Action[] = [];

  switch (loan.status) {
    case "requested": {
      const expired = now > loan.requestedAt + REQUEST_TTL;
      if (isOwner && !expired) {
        out.push({ fn: "approve", label: "Hand it over" });
        out.push({ fn: "decline", label: "Decline", secondary: true });
      }
      if (isBorrower) out.push({ fn: "withdrawRequest", label: "Withdraw request", secondary: true });
      if (expired) {
        out.push({
          fn: "expireRequest",
          label: "Refund the deposit",
          hint: "The owner never answered, so the deposit can go back.",
          secondary: true,
        });
      }
      break;
    }

    case "active": {
      if (isOwner) {
        out.push({ fn: "confirmReturn", label: "I have it back" });
        if (BigInt(loan.projectedLateFee) >= BigInt(loan.deposit)) {
          out.push({
            fn: "claimUnreturned",
            label: "Write it off and take the deposit",
            hint: "Late fees have used up the whole deposit.",
            secondary: true,
          });
        }
      }
      if (isBorrower) {
        out.push({
          fn: "assertReturn",
          label: "I returned it",
          hint: "Stops the late-fee clock now. The owner has 3 days to disagree.",
        });
      }
      break;
    }

    case "return_asserted": {
      if (isOwner) {
        out.push({ fn: "confirmReturn", label: "Confirm and settle" });
        if (!loan.objected) {
          out.push({
            fn: "objectToReturn",
            label: "I don't have it",
            hint: "Restarts the clock. You can only say this once.",
            secondary: true,
          });
        }
      }
      if (loan.challengeEndsAt && now >= loan.challengeEndsAt) {
        out.push({
          fn: "settleUnchallenged",
          label: "Settle now",
          hint: "The owner's 3 days are up.",
        });
      }
      break;
    }
  }

  return out;
}

export function LoanActions({ loan }: { loan: Loan }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = actionsFor(loan, address?.toLowerCase());
  if (actions.length === 0) return null;

  async function run(action: Action) {
    setBusy(action.fn);
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: toolshedAddress,
        abi: toolshedAbi,
        functionName: action.fn,
        args: [BigInt(loan.loanId)],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      // The indexer picks the new state up within a few seconds.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : "Transaction failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="actions">
        {actions.map((action) => (
          <button
            key={action.fn}
            className={action.secondary ? "secondary" : undefined}
            disabled={busy !== null}
            onClick={() => run(action)}
          >
            {busy === action.fn ? "Confirming…" : action.label}
          </button>
        ))}
      </div>
      {actions.filter((a) => a.hint).map((a) => (
        <p className="hint" key={a.fn}>
          {a.hint}
        </p>
      ))}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
