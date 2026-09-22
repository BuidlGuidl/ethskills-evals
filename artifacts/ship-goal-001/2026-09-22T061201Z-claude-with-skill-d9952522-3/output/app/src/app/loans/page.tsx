import {currentMember} from "@/server/members.ts";
import {loansForMember} from "@/server/loans.ts";
import {migrate} from "@/server/db.ts";
import {Empty} from "@/components/ui.tsx";
import {LoanCard} from "./loan-card.tsx";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  migrate();
  const member = await currentMember();
  if (!member) return <Empty>Sign in with your wallet to see your loans.</Empty>;

  const loans = loansForMember(member.address);
  const open = loans.filter((loan) => loan.status !== "closed");
  const settled = loans.filter((loan) => loan.status === "closed");

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Open loans</h1>
          <p className="mt-1 text-sm text-stone-600">
            Late fees come out of the deposit automatically when the loan settles. Nobody has to
            chase anybody for money.
          </p>
        </div>
        {open.length === 0 ? (
          <Empty>Nothing out at the moment.</Empty>
        ) : (
          <ul className="space-y-4">
            {open.map((loan) => (
              <LoanCard key={loan.loanId} loan={loan} me={member.address} />
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Settled</h2>
        {settled.length === 0 ? (
          <Empty>Nothing settled yet.</Empty>
        ) : (
          <ul className="space-y-4">
            {settled.map((loan) => (
              <LoanCard key={loan.loanId} loan={loan} me={member.address} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
