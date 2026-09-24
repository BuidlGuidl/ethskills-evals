"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ToolCard } from "@/components/ToolCard";
import { ConfigWarning } from "@/components/ConfigWarning";
import { useMembership, useTools } from "@/hooks/useToolshed";
import { byLenderStanding } from "@/lib/reputation";

type Sort = "reliable" | "newest" | "cheapest";

const SORTS: { key: Sort; label: string; hint: string }[] = [
  { key: "reliable", label: "Best track records", hint: "Owners who lend well, and whose tools come back" },
  { key: "newest", label: "Just added", hint: "Newest listings first" },
  { key: "cheapest", label: "Smallest deposit", hint: "Least money tied up while you borrow" },
];

export default function BrowsePage() {
  const { items, total, isLoading, error } = useTools();
  const { isMember } = useMembership();
  const [sort, setSort] = useState<Sort>("reliable");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = items.filter((i) => i.tool.listed);
    if (availableOnly) {
      rows = rows.filter((i) => i.tool.activeLoanId === 0n && i.ownerRecord.active);
    }
    if (needle) {
      rows = rows.filter((i) =>
        `${i.metadata?.name ?? ""} ${i.metadata?.condition ?? ""}`.toLowerCase().includes(needle),
      );
    }
    const sorted = [...rows];
    if (sort === "reliable") {
      // Track record first, so the neighbours who look after their tools surface at the top.
      sorted.sort((a, b) => byLenderStanding(a.ownerRecord, b.ownerRecord) || Number(b.id - a.id));
    } else if (sort === "newest") {
      sorted.sort((a, b) => Number(b.id - a.id));
    } else {
      sorted.sort((a, b) => Number(a.tool.deposit - b.tool.deposit));
    }
    return sorted;
  }, [items, sort, availableOnly, query]);

  return (
    <div className="flex flex-col gap-5">
      <ConfigWarning />

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">The shed</h1>
        <p className="text-sm text-shed-600">
          {visible.length} of {total} {total === 1 ? "tool" : "tools"} shown. Put down the deposit, bring it back on
          time, get it all back.
        </p>
      </header>

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-40 flex-1">
          <span className="label">Search</span>
          <input
            className="input"
            placeholder="drill, ladder, mower…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          <span className="label">Sort by</span>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="size-4"
          />
          Available now
        </label>
      </div>

      <p className="text-xs text-shed-600">{SORTS.find((s) => s.key === sort)?.hint}</p>

      {error && <p className="text-sm text-red-700">Could not read the shed: {error.message}</p>}
      {isLoading && <p className="text-sm text-shed-600">Loading the shed…</p>}

      {!isLoading && !error && visible.length === 0 && (
        <div className="card p-6 text-center text-sm text-shed-600">
          Nothing here yet. If you own a tool the street could use, list it on{" "}
          <Link className="underline" href="/lend">
            My tools
          </Link>
          .
        </div>
      )}

      {total > items.length && (
        <p className="text-xs text-shed-600">
          Showing the first {items.length} of {total} tools ever listed. Past this many, the browse screen wants an
          indexer — see the README.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <ToolCard key={item.id.toString()} item={item} isMember={isMember} />
        ))}
      </div>
    </div>
  );
}
