"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { formatUsdc } from "@/core/chain";
import type { Loan } from "@/core/loans";
import { LoanActions } from "@/components/LoanActions";

function dueLabel(loan: Loan): string {
  const now = Math.floor(Date.now() / 1000);

  if (loan.status === "settled") {
    if (loan.unreturned) return "Never returned — deposit kept";
    const late = loan.daysLate ?? 0;
    return late > 0 ? `Returned ${late} ${late === 1 ? "day" : "days"} late` : "Returned on time";
  }
  if (loan.status === "cancelled") return "Cancelled — deposit refunded";
  if (loan.status === "requested") return "Waiting on the owner";
  if (loan.status === "return_asserted") return "Return reported — settling";

  if (!loan.dueAt) return "Out";
  const remaining = loan.dueAt - now;
  if (remaining > 0) {
    const days = Math.ceil(remaining / 86_400);
    return `Due in ${days} ${days === 1 ? "day" : "days"}`;
  }
  return `${loan.projectedDaysLate} ${loan.projectedDaysLate === 1 ? "day" : "days"} late`;
}

export default function LoansPage() {
  const { address, isConnected } = useAccount();
  const [loans, setLoans] = useState<Loan[] | null>(null);

  useEffect(() => {
    if (!address) {
      setLoans(null);
      return;
    }
    fetch(`/api/loans?address=${address}`)
      .then((r) => r.json())
      .then((d) => setLoans(d.loans ?? []))
      .catch(() => setLoans([]));
  }, [address]);

  if (!isConnected) {
    return (
      <>
        <h1>My loans</h1>
        <p className="sub">Sign in to see what you have borrowed and lent.</p>
      </>
    );
  }

  if (loans === null) return <p className="sub">Loading…</p>;

  const borrowed = loans.filter((l) => l.borrowerAddress === address?.toLowerCase());
  const lent = loans.filter((l) => l.ownerAddress === address?.toLowerCase());

  return (
    <>
      <h1>My loans</h1>
      <p className="sub">Everything you have out, and everything of yours that is out with a neighbor.</p>

      <Section title="Tools I borrowed" loans={borrowed} empty="You haven't borrowed anything yet." />
      <Section title="My tools, lent out" loans={lent} empty="Nobody has borrowed your tools yet." />
    </>
  );
}

function Section({ title, loans, empty }: { title: string; loans: Loan[]; empty: string }) {
  return (
    <>
      <h2>{title}</h2>
      {loans.length === 0 ? (
        <p className="sub">{empty}</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {loans.map((loan) => (
            <div className="panel" key={loan.loanId}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>
                    {loan.listingId ? (
                      <Link href={`/listings/${loan.listingId}`}>{loan.listingTitle ?? "Tool"}</Link>
                    ) : (
                      (loan.listingTitle ?? `Loan #${loan.loanId}`)
                    )}
                  </strong>
                  <div className="card-meta">{dueLabel(loan)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="card-meta">${formatUsdc(loan.deposit)} deposit</div>
                  {loan.status === "settled" ? (
                    <div className="card-meta">
                      ${formatUsdc(loan.lateFeePaid ?? "0")} late fee · ${formatUsdc(loan.refund ?? "0")} refunded
                    </div>
                  ) : (
                    BigInt(loan.projectedLateFee) > 0n && (
                      <div className="card-meta">${formatUsdc(loan.projectedLateFee)} in late fees so far</div>
                    )
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <LoanActions loan={loan} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
