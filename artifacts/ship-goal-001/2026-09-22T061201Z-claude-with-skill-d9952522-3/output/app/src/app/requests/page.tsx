import {currentMember} from "@/server/members.ts";
import {pendingRequestsForOwner, requestsByBorrower} from "@/server/requests.ts";
import {getListing} from "@/server/listings.ts";
import {migrate} from "@/server/db.ts";
import {Empty} from "@/components/ui.tsx";
import {IncomingQueue} from "./incoming.tsx";
import {OutgoingList} from "./outgoing.tsx";

export const dynamic = "force-dynamic";

/**
 * Requests, both directions.
 *
 * The incoming queue is the other half of "reliable people get lent to first": an owner with one
 * drill and four people asking for it sees them ranked by the same track record the browse screen
 * uses, so the decision is easy and the good borrowers are rewarded for being good borrowers.
 */
export default async function RequestsPage() {
  migrate();
  const member = await currentMember();

  if (!member) {
    return <Empty>Sign in with your wallet to see your requests.</Empty>;
  }

  const incoming = pendingRequestsForOwner(member.address).map((request) => {
    const listing = getListing(request.listingId);
    return {
      ...request,
      deposit: listing?.deposit ?? 0n,
      dailyLateFee: listing?.dailyLateFee ?? 0n,
      maxDays: listing?.maxDays ?? 0,
    };
  });

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">People asking to borrow</h1>
          <p className="mt-1 text-sm text-stone-600">
            Ranked by track record. Approving signs the loan terms with your wallet — it costs no
            gas and moves no money. The borrower pays the deposit when they collect the tool.
          </p>
        </div>
        {incoming.length === 0 ? (
          <Empty>Nobody has asked to borrow anything yet.</Empty>
        ) : (
          <IncomingQueue requests={incoming} />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">What you have asked for</h2>
        <OutgoingList requests={requestsByBorrower(member.address)} />
      </section>
    </div>
  );
}
