"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { EmptyState } from "~~/components/toolshed/Bits";
import { ToolCard } from "~~/components/toolshed/ToolCard";
import { useRecords, useRoles, useToolMetadata, useTools } from "~~/hooks/toolshed";
import { compareByReliability } from "~~/utils/toolshed";

type SortMode = "reliability" | "newest" | "cheapest";

const SORT_LABEL: { [key in SortMode]: string } = {
  reliability: "Owner track record",
  newest: "Recently listed",
  cheapest: "Lowest deposit",
};

const Browse: NextPage = () => {
  const { tools: rawTools, isLoading: toolsLoading } = useTools();
  const tools = useToolMetadata(rawTools);
  const owners = useMemo(() => tools.map(tool => tool.owner), [tools]);
  const { recordOf, isLoading: recordsLoading } = useRecords(owners);
  const { isMember } = useRoles();
  // Ranking by track record means waiting for the records: rendering first and reordering under the
  // reader's cursor a moment later is worse than a beat of skeleton.
  const isLoading = toolsLoading || recordsLoading;

  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [sort, setSort] = useState<SortMode>("reliability");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = tools.filter(tool => {
      if (!tool.listed) return false;
      if (availableOnly && tool.activeLoanId !== 0n) return false;
      if (!needle) return true;
      const haystack = [tool.metadata?.name, tool.metadata?.description, tool.metadata?.condition, tool.owner]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });

    // The default order is the whole point of the track record: neighbors who have lent and
    // borrowed reliably surface first, so newcomers browse toward the people most likely to say yes.
    return [...filtered].sort((a, b) => {
      if (sort === "newest") return Number(b.id - a.id);
      if (sort === "cheapest") return Number(a.deposit - b.deposit);
      const byOwner = compareByReliability(recordOf(a.owner), recordOf(b.owner));
      return byOwner !== 0 ? byOwner : Number(b.id - a.id);
    });
  }, [tools, query, availableOnly, sort, recordOf]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-2 border-b border-base-300 pb-6">
        <h1 className="m-0 text-3xl font-black tracking-tight">The shed</h1>
        <p className="m-0 max-w-2xl opacity-80">
          Tools your neighbors are willing to lend. Put down the deposit in USDC, bring it back by the due date, get
          every cent back. Come back late and the daily fee comes out of the deposit and goes to the owner.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="form-control grow">
          <span className="label-text text-xs uppercase tracking-wide opacity-60">Search</span>
          <input
            className="input input-bordered w-full"
            placeholder="drill, ladder, wheelbarrow…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>

        <label className="form-control">
          <span className="label-text text-xs uppercase tracking-wide opacity-60">Sort by</span>
          <select
            className="select select-bordered"
            value={sort}
            onChange={event => setSort(event.target.value as SortMode)}
          >
            {Object.entries(SORT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="label cursor-pointer gap-2 pb-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={availableOnly}
            onChange={event => setAvailableOnly(event.target.checked)}
          />
          <span className="label-text">Available now</span>
        </label>

        {isMember && (
          <Link href="/list" className="btn btn-primary ml-auto">
            List a tool
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(key => (
            <div key={key} className="h-72 animate-pulse bg-base-300" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          hint={
            tools.length === 0
              ? "No tools have been listed. If you are a member, you can be the first."
              : "Nothing matches that filter. Try turning off “Available now”."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(tool => (
            <ToolCard key={tool.id.toString()} tool={tool} ownerRecord={recordOf(tool.owner)} />
          ))}
        </div>
      )}

      {sort === "reliability" && visible.length > 0 && (
        <p className="mt-6 text-sm opacity-60">
          Sorted by each owner&apos;s track record — on-time returns and loans given, smoothed so a neighbor with one
          perfect loan doesn&apos;t outrank one with forty. See{" "}
          <Link href="/members" className="link">
            the member directory
          </Link>{" "}
          for the numbers.
        </p>
      )}
    </div>
  );
};

export default Browse;
