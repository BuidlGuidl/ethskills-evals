"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";

import {Usdc} from "@/components/ui.tsx";
import type {Listing} from "@/server/listings.ts";

type Row = Omit<Listing, "deposit" | "dailyLateFee"> & {
  deposit: bigint | string;
  dailyLateFee: bigint | string;
};

const NEXT_STATUS: Record<Listing["status"], {label: string; status: Listing["status"]}[]> = {
  available: [
    {label: "Pause", status: "paused"},
    {label: "Retire", status: "retired"},
  ],
  paused: [
    {label: "List again", status: "available"},
    {label: "Retire", status: "retired"},
  ],
  retired: [{label: "List again", status: "available"}],
};

export function MineList({listings}: {listings: Row[]}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: Listing["status"]) {
    setBusy(id);
    await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({status}),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <ul className="space-y-3">
      {listings.map((listing) => (
        <li key={listing.id} className="card flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href={`/tools/${listing.id}`} className="font-medium hover:underline">
              {listing.title}
            </Link>
            <p className="mt-1 text-sm text-stone-600">
              <Usdc amount={BigInt(listing.deposit)} /> deposit ·{" "}
              <Usdc amount={BigInt(listing.dailyLateFee)} />/day late · up to {listing.maxDays} days
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
              {listing.status}
            </span>
            {NEXT_STATUS[listing.status].map((action) => (
              <button
                key={action.status}
                className="btn-secondary"
                disabled={busy === listing.id}
                onClick={() => void setStatus(listing.id, action.status)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
