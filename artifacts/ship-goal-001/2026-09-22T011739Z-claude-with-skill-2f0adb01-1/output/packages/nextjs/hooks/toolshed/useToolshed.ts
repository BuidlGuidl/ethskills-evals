"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Address, keccak256, toHex } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { fetchMetadata } from "~~/utils/toolshed/metadata";
import { EMPTY_STATS, Loan, LoanStatus, MemberStats, Tool } from "~~/utils/toolshed/types";

/**
 * A neighbourhood association is a few hundred people and a few hundred tools, so the whole
 * state fits in one call per collection. Past that we read the most recent PAGE entries rather
 * than the oldest, so the app degrades into "recent history only" instead of going stale. If it
 * ever really outgrows this, the contract emits an event for every state change — point an
 * indexer at it rather than raising the limit.
 */
const PAGE = 1000n;

/** Offset of the last PAGE entries of a collection of `total` items. */
const lastPageOffset = (total: bigint | undefined) =>
  total === undefined ? undefined : total > PAGE ? total - PAGE : 0n;

const STEWARD_ROLE = keccak256(toHex("STEWARD_ROLE"));

export const useTools = () => {
  const { data: total } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "toolCount" });
  const offset = lastPageOffset(total);
  const { data, isLoading } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getTools",
    args: [offset, PAGE],
  });

  const tools = useMemo<Tool[]>(
    () =>
      (data ?? []).map((tool, i) => ({
        id: Number(offset ?? 0n) + i,
        owner: tool.owner as Address,
        deposit: tool.deposit,
        feePerDay: tool.feePerDay,
        maxDays: Number(tool.maxDays),
        activeLoanId: tool.activeLoanId,
        available: tool.available,
        retired: tool.retired,
        metadataURI: tool.metadataURI,
      })),
    [data, offset],
  );

  return { tools, isLoading };
};

export const useLoans = () => {
  const { data: total } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "loanCount" });
  const offset = lastPageOffset(total);
  const { data, isLoading } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getLoans",
    args: [offset, PAGE],
  });

  const loans = useMemo<Loan[]>(
    () =>
      (data ?? [])
        .map((loan, i) => ({
          id: Number(offset ?? 0n) + i,
          borrower: loan.borrower as Address,
          toolId: Number(loan.toolId),
          status: loan.status as LoanStatus,
          disputed: loan.disputed,
          deposit: loan.deposit,
          feePerDay: loan.feePerDay,
          durationDays: Number(loan.durationDays),
          requestedAt: Number(loan.requestedAt),
          startedAt: Number(loan.startedAt),
          dueAt: Number(loan.dueAt),
          returnedAt: Number(loan.returnedAt),
        }))
        .filter(loan => loan.status !== LoanStatus.None), // index 0 is the burnt sentinel
    [data, offset],
  );

  return { loans, isLoading };
};

export const useMembers = () => {
  const { data: total } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "memberCount" });
  const { data, isLoading } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getMembers",
    args: [lastPageOffset(total), PAGE],
  });

  return useMemo(() => {
    const addresses = (data?.[0] ?? []) as readonly Address[];
    const rows = (data?.[1] ?? []) as readonly MemberStats[];
    const statsByAddress = new Map<string, MemberStats>();
    addresses.forEach((address, i) => {
      const row = rows[i];
      statsByAddress.set(address.toLowerCase(), {
        active: row.active,
        joinedAt: Number(row.joinedAt),
        loansBorrowed: Number(row.loansBorrowed),
        lateReturns: Number(row.lateReturns),
        totalLateDays: Number(row.totalLateDays),
        defaults: Number(row.defaults),
        loansLent: Number(row.loansLent),
        openBorrows: Number(row.openBorrows),
      });
    });

    return {
      addresses: [...addresses],
      statsByAddress,
      statsFor: (address?: string) => (address && statsByAddress.get(address.toLowerCase())) || { ...EMPTY_STATS },
      isLoading,
    };
  }, [data, isLoading]);
};

/** Is the connected wallet on the roster? Drives the "you can't do this yet" messaging. */
export const useIsMember = () => {
  const { address } = useAccount();
  const { data } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getMember",
    args: [address],
  });
  return Boolean(data?.active);
};

export const useIsSteward = () => {
  const { address } = useAccount();
  const { data } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "hasRole",
    args: [STEWARD_ROLE, address],
  });
  return Boolean(data);
};

/** Listing content lives offchain, so it's a plain fetch keyed by URI. */
export const useToolMetadata = (uri?: string) =>
  useQuery({
    queryKey: ["tool-metadata", uri],
    queryFn: () => fetchMetadata(uri as string),
    enabled: Boolean(uri),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
