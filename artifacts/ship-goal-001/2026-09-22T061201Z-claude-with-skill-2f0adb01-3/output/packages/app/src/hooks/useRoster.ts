"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useReadContract } from "wagmi";
import { parseAbiItem, type Address } from "viem";
import { toolshed, type MemberRecord } from "@/lib/contracts";
import { trackRecord, byTrackRecord, type TrackRecord } from "@/lib/reputation";

const MEMBER_ADMITTED = parseAbiItem("event MemberAdmitted(address indexed member)");

/**
 * The roster, rebuilt from MemberAdmitted logs. The contract does not keep an array of members
 * — nothing onchain needs to iterate them, and an append-only array that only the steward's
 * admin screen reads would be paid for by every member who joins. For ~300 members one log
 * query is plenty; see the README on when to swap this for an indexer.
 *
 * Set NEXT_PUBLIC_DEPLOY_BLOCK so this does not scan from genesis on a public RPC.
 */
export function useRoster() {
  const client = usePublicClient();
  const fromBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "0");

  const addresses = useQuery({
    queryKey: ["roster", toolshed.address, fromBlock.toString()],
    enabled: !!client,
    staleTime: 60_000,
    queryFn: async () => {
      const logs = await client!.getLogs({
        address: toolshed.address,
        event: MEMBER_ADMITTED,
        fromBlock,
        toBlock: "latest",
      });
      const seen = new Set<string>();
      const out: Address[] = [];
      for (const log of logs) {
        const member = log.args.member;
        if (member && !seen.has(member.toLowerCase())) {
          seen.add(member.toLowerCase());
          out.push(member);
        }
      }
      return out;
    },
  });

  const list = addresses.data ?? [];

  const records = useReadContract({
    ...toolshed,
    functionName: "getMembers",
    args: [list],
    query: { enabled: list.length > 0 },
  });

  const rows: { address: Address; record: TrackRecord; active: boolean }[] = list.map((address, i) => {
    const raw = (records.data as MemberRecord[] | undefined)?.[i];
    return { address, record: trackRecord(raw), active: !!raw?.active };
  });

  rows.sort((a, b) => byTrackRecord(a.record, b.record));

  return { rows, isLoading: addresses.isLoading || records.isLoading, error: addresses.error };
}
