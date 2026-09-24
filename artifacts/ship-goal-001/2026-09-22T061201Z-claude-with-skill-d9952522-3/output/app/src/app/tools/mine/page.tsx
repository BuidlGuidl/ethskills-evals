import Link from "next/link";

import {currentMember} from "@/server/members.ts";
import {listingsByOwner} from "@/server/listings.ts";
import {migrate} from "@/server/db.ts";
import {Empty, Usdc} from "@/components/ui.tsx";
import {MineList} from "./mine-list.tsx";

export const dynamic = "force-dynamic";

export default async function MyToolsPage() {
  migrate();
  const member = await currentMember();
  if (!member) return <Empty>Sign in with your wallet to see your tools.</Empty>;

  const listings = listingsByOwner(member.address);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your tools</h1>
          <p className="mt-1 text-sm text-stone-600">
            Pause a listing while a tool is away being repaired; retire it when you no longer want
            to lend it. Neither touches any loan already running.
          </p>
        </div>
        <Link href="/tools/new" className="btn-primary">
          List another
        </Link>
      </div>

      {listings.length === 0 ? (
        <Empty>
          You have not listed anything yet. <Link className="underline" href="/tools/new">List a tool.</Link>
        </Empty>
      ) : (
        <MineList listings={listings} />
      )}

      <p className="text-sm text-stone-500">
        Total deposits you are currently asking for:{" "}
        <Usdc
          amount={listings
            .filter((listing) => listing.status === "available")
            .reduce((total, listing) => total + BigInt(listing.deposit), 0n)}
        />
      </p>
    </div>
  );
}
