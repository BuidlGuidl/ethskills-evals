"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Address, erc20Abi } from "viem";
import { useAccount, useBlock, useReadContract } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import {
  EMPTY_RECORD,
  type Loan,
  type Record,
  type Tool,
  type ToolWithId,
  fetchToolMetadata,
  nowSeconds,
} from "~~/utils/toolshed";

/**
 * "Now" as the contract sees it: the latest block's timestamp, not the browser's clock.
 *
 * Late fees are charged against `block.timestamp`, so every countdown and running-fee figure in the
 * UI has to be measured the same way. On a live chain the two agree within a block; on a local chain
 * whose clock has been jumped forward by a seed script they do not, and a due date would otherwise
 * read as days in the future while the contract already considers it overdue.
 */
export const useChainNow = () => {
  const { data: block } = useBlock({ watch: true });
  return block?.timestamp ?? nowSeconds();
};

/** One page is plenty for a 300-household association; raise it if a shed gets big. */
const TOOL_PAGE_SIZE = 250n;

/** Every tool ever listed, newest first, with ids attached. */
export const useTools = () => {
  const { data, isLoading, refetch } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getTools",
    args: [0n, TOOL_PAGE_SIZE],
  });

  const tools = useMemo<ToolWithId[]>(() => {
    if (!data) return [];
    const [rows, ids] = data as readonly [readonly Tool[], readonly bigint[]];
    return rows.map((tool, index) => ({ ...tool, id: ids[index] })).reverse();
  }, [data]);

  return { tools, isLoading, refetch };
};

/** Resolves the IPFS metadata for a list of tools, filling it in as each one arrives. */
export const useToolMetadata = (tools: ToolWithId[]) => {
  const [metadata, setMetadata] = useState<globalThis.Record<string, ToolWithId["metadata"]>>({});
  const uris = useMemo(() => tools.map(tool => tool.metadataURI).join("|"), [tools]);

  useEffect(() => {
    let cancelled = false;
    const missing = uris.split("|").filter(uri => uri && !(uri in metadata));
    if (missing.length === 0) return;
    (async () => {
      const resolved = await Promise.all(missing.map(async uri => [uri, await fetchToolMetadata(uri)] as const));
      if (cancelled) return;
      setMetadata(current => ({ ...current, ...Object.fromEntries(resolved) }));
    })();
    return () => {
      cancelled = true;
    };
    // `metadata` is deliberately not a dependency: it is the accumulator this effect writes into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uris]);

  return useMemo(() => tools.map(tool => ({ ...tool, metadata: metadata[tool.metadataURI] })), [tools, metadata]);
};

/** Track records for a set of members, in one batched call. */
export const useRecords = (members: Address[]) => {
  const unique = useMemo(() => Array.from(new Set(members.map(m => m.toLowerCase()))) as Address[], [members]);
  const { data, isLoading } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getRecords",
    args: [unique],
  });

  const byMember = useMemo(() => {
    const map = new Map<string, Record>();
    (data as readonly Record[] | undefined)?.forEach((record, index) => map.set(unique[index], record));
    return map;
  }, [data, unique]);

  // Memoized: callers use it inside their own useMemo, so a fresh identity every render would
  // silently defeat their memoization (and the React compiler complains about it).
  const recordOf = useCallback(
    (member: Address | undefined) => (member && byMember.get(member.toLowerCase() as Address)) || EMPTY_RECORD,
    [byMember],
  );

  return { recordOf, isLoading };
};

export const useRecord = (member: Address | undefined) => {
  const { data } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getRecord",
    args: [member],
  });
  return (data as Record | undefined) ?? EMPTY_RECORD;
};

export const useLoans = (loanIds: readonly bigint[]) => {
  const ids = useMemo(() => [...loanIds], [loanIds]);
  const { data, isLoading, refetch } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getLoans",
    args: [ids],
  });

  const loans = useMemo(
    () => ((data as readonly Loan[] | undefined) ?? []).map((loan, index) => ({ ...loan, id: ids[index] })),
    [data, ids],
  );

  return { loans, isLoading, refetch };
};

/**
 * The id lists are paginated onchain (anyone can append to another member's list by requesting one
 * of their tools). These read the most recent page; `total` is there so a screen can say "showing
 * the last 100 of 340" rather than silently truncating.
 */
const ID_PAGE_SIZE = 200n;

const useIdPage = (
  functionName: "getLoanIdsByBorrower" | "getLoanIdsByOwner" | "getToolIdsByOwner",
  who: Address | undefined,
) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName,
    args: [who, 0n, ID_PAGE_SIZE],
  });
  const [ids, total] = (data as readonly [readonly bigint[], bigint] | undefined) ?? [[], 0n];
  return { ids, total, refetch };
};

export const useLoanIdsByBorrower = (borrower: Address | undefined) => {
  const { ids, total, refetch } = useIdPage("getLoanIdsByBorrower", borrower);
  return { loanIds: ids, total, refetch };
};

export const useLoanIdsByOwner = (owner: Address | undefined) => {
  const { ids, total, refetch } = useIdPage("getLoanIdsByOwner", owner);
  return { loanIds: ids, total, refetch };
};

export const useToolIdsByOwner = (owner: Address | undefined) => {
  const { ids, total, refetch } = useIdPage("getToolIdsByOwner", owner);
  return { toolIds: ids, total, refetch };
};

export const useLoanIdsByTool = (toolId: bigint | undefined) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getLoanIdsByTool",
    args: [toolId, 0n, ID_PAGE_SIZE],
  });
  const [loanIds, total] = (data as readonly [readonly bigint[], bigint] | undefined) ?? [[], 0n];
  return { loanIds, total, refetch };
};

/** USDC a settlement could not deliver (a paused or blocklisted token), claimable with `withdraw`. */
export const useOwedBalance = (member: Address | undefined) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "owed",
    args: [member],
  });
  return { owed: (data as bigint | undefined) ?? 0n, refetch };
};

export const useLoanCount = () => {
  const { data } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "loanCount" });
  return (data as bigint | undefined) ?? 0n;
};

export const useMembers = () => {
  const { data, isLoading, refetch } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "getMembers",
  });
  const [addresses, active] = (data as readonly [readonly Address[], readonly boolean[]] | undefined) ?? [[], []];
  return {
    members: addresses.map((address, index) => ({ address, active: active[index] })),
    isLoading,
    refetch,
  };
};

/** Roles, so screens can show what the connected wallet is actually allowed to do. */
export const useRoles = () => {
  const { address } = useAccount();
  const { data: memberRole } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "MEMBER_ROLE" });
  const { data: stewardRole } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "STEWARD_ROLE" });
  const { data: isMember, isLoading: memberLoading } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "hasRole",
    args: [memberRole, address],
  });
  const { data: isSteward, isLoading: stewardLoading } = useScaffoldReadContract({
    contractName: "Toolshed",
    functionName: "hasRole",
    args: [stewardRole, address],
  });
  return {
    address,
    isMember: Boolean(isMember),
    isSteward: Boolean(isSteward),
    // So screens can hold off on "members only" until they actually know. Nothing is loading when
    // there is no wallet to check.
    isLoadingRoles: Boolean(address) && (memberLoading || stewardLoading),
  };
};

/** The deployed Toolshed address — the spender for USDC approvals. */
export const useToolshedAddress = () => {
  const { data } = useDeployedContractInfo({ contractName: "Toolshed" });
  return data?.address as Address | undefined;
};

/**
 * The deposit token, read off the contract rather than hardcoded: the same frontend then works
 * against Base USDC, Base Sepolia USDC, or the local MockUSDC without a config switch.
 */
export const useDepositToken = () => {
  const { address: account } = useAccount();
  const { data: token } = useScaffoldReadContract({ contractName: "Toolshed", functionName: "depositToken" });
  const shedAddress = useToolshedAddress();

  const { data: symbol } = useReadContract({
    address: token as Address | undefined,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(token) },
  });
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: token as Address | undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account as Address],
    query: { enabled: Boolean(token && account) },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token as Address | undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account as Address, shedAddress as Address],
    query: { enabled: Boolean(token && account && shedAddress) },
  });

  return {
    token: token as Address | undefined,
    spender: shedAddress,
    symbol: (symbol as string | undefined) ?? "USDC",
    balance: (balance as bigint | undefined) ?? 0n,
    allowance: (allowance as bigint | undefined) ?? 0n,
    refetchBalance,
    refetchAllowance,
  };
};
