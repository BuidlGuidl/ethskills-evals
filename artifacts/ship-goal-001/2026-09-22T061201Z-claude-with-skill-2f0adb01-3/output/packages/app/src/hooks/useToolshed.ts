"use client";

import { useMemo } from "react";
import { useAccount, useBlock, useReadContract, useReadContracts } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { LoanStatus, OPEN_LOAN_STATUSES, toolshed, usdc, type Loan, type MemberRecord, type Tool } from "@/lib/contracts";
import { fetchToolMetadata, type ToolMetadata } from "@/lib/metadata";
import { byTrackRecord, trackRecord, type TrackRecord } from "@/lib/reputation";

export type ToolWithRecord = {
  id: bigint;
  tool: Tool;
  ownerRecord: TrackRecord;
  metadata?: ToolMetadata;
};

/** How many tools we pull in one read. A 300-member association is nowhere near this. */
const PAGE = 500n;

/**
 * Everything the browse screen needs, in three contract reads: the tool count, the tools, and
 * one batched read of their owners' track records. At this size that beats running an indexer —
 * see the README's "Why no subgraph" note.
 */
export function useTools() {
  const count = useReadContract({ ...toolshed, functionName: "toolCount" });

  const page = useReadContract({
    ...toolshed,
    functionName: "getTools",
    args: [1n, PAGE],
    query: { enabled: count.data !== undefined && count.data > 0n },
  });

  const [tools, ids] = (page.data as [Tool[], bigint[]] | undefined) ?? [[], []];

  const owners = useMemo(() => Array.from(new Set(tools.map((t) => t.owner))), [tools]);

  const records = useReadContract({
    ...toolshed,
    functionName: "getMembers",
    args: [owners as Address[]],
    query: { enabled: owners.length > 0 },
  });

  const recordByOwner = useMemo(() => {
    const map = new Map<Address, TrackRecord>();
    const rows = (records.data as MemberRecord[] | undefined) ?? [];
    owners.forEach((owner, i) => map.set(owner, trackRecord(rows[i])));
    return map;
  }, [owners, records.data]);

  const metadata = useToolMetadata(ids, tools);

  const items: ToolWithRecord[] = useMemo(
    () =>
      tools.map((tool, i) => ({
        id: ids[i],
        tool,
        ownerRecord: recordByOwner.get(tool.owner) ?? trackRecord(undefined),
        metadata: metadata.get(ids[i]?.toString() ?? ""),
      })),
    [tools, ids, recordByOwner, metadata],
  );

  return {
    items,
    total: Number(count.data ?? 0n),
    isLoading: count.isLoading || page.isLoading,
    error: count.error ?? page.error ?? records.error ?? null,
  };
}

/** Offchain metadata fetch, cached by URI so a re-render does not re-hit the gateway. */
function useToolMetadata(ids: bigint[], tools: Tool[]) {
  const key = tools.map((t, i) => `${ids[i]}:${t.metadataURI}`).join("|");
  const { data } = useQuery({
    queryKey: ["tool-metadata", key],
    enabled: tools.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        tools.map(async (tool, i) => {
          const id = ids[i];
          return [id.toString(), await fetchToolMetadata(tool.metadataURI, id)] as const;
        }),
      );
      return new Map(entries);
    },
  });
  return data ?? new Map<string, ToolMetadata>();
}

export type LoanWithContext = {
  id: bigint;
  loan: Loan;
  tool?: Tool;
  metadata?: ToolMetadata;
  borrowerRecord: TrackRecord;
};

/** The connected member's own borrowings, newest first. */
export function useMyLoans() {
  const { address } = useAccount();
  const ids = useReadContract({
    ...toolshed,
    functionName: "loansOfBorrower",
    args: [address as Address],
    query: { enabled: !!address },
  });
  const loanIds = ((ids.data as bigint[] | undefined) ?? []).slice().reverse();
  return useLoansById(loanIds);
}

export function useLoansById(loanIds: bigint[]) {
  const loans = useReadContract({
    ...toolshed,
    functionName: "getLoans",
    args: [loanIds],
    query: { enabled: loanIds.length > 0 },
  });
  const rows = (loans.data as Loan[] | undefined) ?? [];

  const toolIds = useMemo(() => Array.from(new Set(rows.map((l) => l.toolId))), [rows]);
  const tools = useReadContracts({
    contracts: toolIds.map((id) => ({ ...toolshed, functionName: "getTool" as const, args: [id] })),
    query: { enabled: toolIds.length > 0 },
  });

  const borrowers = useMemo(() => Array.from(new Set(rows.map((l) => l.borrower))), [rows]);
  const records = useReadContract({
    ...toolshed,
    functionName: "getMembers",
    args: [borrowers as Address[]],
    query: { enabled: borrowers.length > 0 },
  });

  const items = useMemo(() => {
    const toolById = new Map<string, Tool>();
    toolIds.forEach((id, i) => {
      const result = tools.data?.[i];
      if (result?.status === "success") toolById.set(id.toString(), result.result as Tool);
    });
    const recordByAddress = new Map<Address, TrackRecord>();
    const memberRows = (records.data as MemberRecord[] | undefined) ?? [];
    borrowers.forEach((who, i) => recordByAddress.set(who, trackRecord(memberRows[i])));

    return rows.map((loan, i) => ({
      id: loanIds[i],
      loan,
      tool: toolById.get(loan.toolId.toString()),
      borrowerRecord: recordByAddress.get(loan.borrower) ?? trackRecord(undefined),
    }));
  }, [rows, loanIds, toolIds, tools.data, borrowers, records.data]);

  const withMetadata = useLoanMetadata(items);

  return { items: withMetadata, isLoading: loans.isLoading || tools.isLoading };
}

function useLoanMetadata(items: Omit<LoanWithContext, "metadata">[]): LoanWithContext[] {
  const key = items.map((i) => `${i.loan.toolId}:${i.tool?.metadataURI ?? ""}`).join("|");
  const { data } = useQuery({
    queryKey: ["loan-tool-metadata", key],
    enabled: items.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        items.map(async (item) => {
          const meta = await fetchToolMetadata(item.tool?.metadataURI ?? "", item.loan.toolId);
          return [item.loan.toolId.toString(), meta] as const;
        }),
      );
      return new Map(entries);
    },
  });
  return items.map((item) => ({ ...item, metadata: data?.get(item.loan.toolId.toString()) }));
}

/**
 * Requests waiting on the connected member, as a tool owner — sorted with the most reliable
 * borrowers first, which is the whole point of keeping a track record.
 */
export function useIncomingRequests() {
  const { address } = useAccount();
  const myTools = useReadContract({
    ...toolshed,
    functionName: "toolsOfOwner",
    args: [address as Address],
    query: { enabled: !!address },
  });
  const toolIds = (myTools.data as bigint[] | undefined) ?? [];

  const loanIdsPerTool = useReadContracts({
    contracts: toolIds.map((id) => ({ ...toolshed, functionName: "loansOfTool" as const, args: [id] })),
    query: { enabled: toolIds.length > 0 },
  });

  const candidateIds = useMemo(() => {
    const out: bigint[] = [];
    for (const result of loanIdsPerTool.data ?? []) {
      if (result.status === "success") out.push(...(result.result as bigint[]));
    }
    return out;
  }, [loanIdsPerTool.data]);

  const { items, isLoading } = useLoansById(candidateIds);

  const pending = useMemo(
    () =>
      items
        .filter((i) => i.loan.status === LoanStatus.Requested)
        .sort((a, b) => byTrackRecord(a.borrowerRecord, b.borrowerRecord)),
    [items],
  );

  const open = useMemo(
    () => items.filter((i) => OPEN_LOAN_STATUSES.includes(i.loan.status as LoanStatus)),
    [items],
  );

  return { pending, open, myToolIds: toolIds, isLoading: myTools.isLoading || isLoading };
}

export function useMembership(who?: Address) {
  const { address } = useAccount();
  const target = who ?? address;
  const record = useReadContract({
    ...toolshed,
    functionName: "getMember",
    args: [target as Address],
    query: { enabled: !!target },
  });
  const steward = useReadContract({ ...toolshed, functionName: "owner" });
  const data = record.data as MemberRecord | undefined;
  return {
    address: target,
    isMember: !!data?.active,
    record: trackRecord(data),
    raw: data,
    steward: steward.data as Address | undefined,
    isSteward: !!target && !!steward.data && target.toLowerCase() === (steward.data as string).toLowerCase(),
    isLoading: record.isLoading,
  };
}

export function useUsdcBalance() {
  const { address } = useAccount();
  return useReadContract({
    ...usdc,
    functionName: "balanceOf",
    args: [address as Address],
    query: { enabled: !!address },
  });
}

export function useUsdcAllowance() {
  const { address } = useAccount();
  return useReadContract({
    ...usdc,
    functionName: "allowance",
    args: [address as Address, toolshed.address],
    query: { enabled: !!address },
  });
}

/**
 * "Now" as the contract sees it: the latest block's timestamp. Due dates and late fees are
 * judged onchain, so the UI has to quote the same clock — otherwise a member with a skewed
 * system clock (or a developer on a time-warped local chain) reads a fee the chain won't charge.
 * Falls back to the browser clock before the first block arrives.
 */
export function useChainNow(): number {
  const { data } = useBlock({ query: { refetchInterval: 30_000 } });
  return data ? Number(data.timestamp) : Math.floor(Date.now() / 1000);
}

/** Payouts that could not be pushed to the connected member (a frozen token address). */
export function useMyCredits() {
  const { address } = useAccount();
  return useReadContract({
    ...toolshed,
    functionName: "credits",
    args: [address as Address],
    query: { enabled: !!address },
  });
}

/** After a write lands, every contract read on the page is stale. */
export function useRefreshAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}
