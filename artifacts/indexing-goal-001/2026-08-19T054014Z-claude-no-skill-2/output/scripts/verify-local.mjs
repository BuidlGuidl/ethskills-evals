/**
 * Checks the read side against the chain it was built from.
 *
 * The indexer's whole job is to be a faithful, complete replay of the contract's
 * history, so the useful test is a comparison against the source of truth:
 *
 *   1. paging the feed to its end returns exactly the CheckedIn logs the chain
 *      has, with no gaps, no duplicates, and in newest-first order;
 *   2. every member's totals and streaks match the contract's own view
 *      functions, including the streak-has-lapsed rule.
 *
 * Usage:
 *   node scripts/verify-local.mjs [--api http://localhost:42069] [--rpc http://127.0.0.1:8545]
 *
 * Reads STREAK_ADDRESS from indexer/.env.local unless --address is given.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http } from "viem";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function envLocal(key) {
  try {
    const file = readFileSync(join(root, "indexer", ".env.local"), "utf8");
    const line = file.split("\n").find((l) => l.trim().startsWith(`${key}=`));
    return line?.split("=").slice(1).join("=").trim();
  } catch {
    return undefined;
  }
}

const API = flag("api", process.env.API_URL ?? "http://localhost:42069").replace(/\/$/, "");
const RPC = flag("rpc", process.env.RPC_URL ?? envLocal("PONDER_RPC_URL") ?? "http://127.0.0.1:8545");
const ADDRESS = flag("address", envLocal("STREAK_ADDRESS"));

if (!ADDRESS) {
  console.error("No contract address. Pass --address, or set STREAK_ADDRESS in indexer/.env.local.");
  process.exit(1);
}

const abi = JSON.parse(
  readFileSync(join(root, "contracts", "out", "Streak.sol", "Streak.json"), "utf8"),
).abi;

const publicClient = createPublicClient({ transport: http(RPC) });

let failures = 0;
function check(ok, label, detail = "") {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

/** Every CheckedIn log the chain has, straight from the node. */
async function chainLogs() {
  const logs = await publicClient.getLogs({
    address: ADDRESS,
    event: abi.find((item) => item.type === "event" && item.name === "CheckedIn"),
    fromBlock: 0n,
    toBlock: "latest",
  });
  return logs;
}

/** Walk the feed to its end, using a deliberately awkward page size. */
async function fullFeed() {
  const items = [];
  let cursor = null;
  let pages = 0;
  do {
    const query = new URLSearchParams({ limit: "37" });
    if (cursor) query.set("cursor", cursor);
    const page = await getJson(`/feed?${query}`);
    items.push(...page.items);
    cursor = page.nextCursor;
    pages++;
    if (pages > 10_000) throw new Error("feed pagination did not terminate");
  } while (cursor);
  return { items, pages };
}

async function main() {
  console.log(`API ${API}\nRPC ${RPC}\nStreak ${ADDRESS}\n`);

  const [logs, { items, pages }] = await Promise.all([chainLogs(), fullFeed()]);

  console.log("Feed vs. chain");
  check(items.length === logs.length, "every log appears in the feed", `${items.length}/${logs.length}`);
  check(new Set(items.map((i) => i.id)).size === items.length, "no duplicates across page boundaries");

  let ordered = true;
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const cur = items[i];
    if (cur.blockNumber > prev.blockNumber) ordered = false;
  }
  check(ordered, "newest first", `${pages} pages`);

  const chainNotes = new Set(logs.map((l) => `${l.blockNumber}-${l.logIndex}:${l.args.note}`));
  const feedNotes = items.every((i) => chainNotes.has(`${i.id}:${i.note}`));
  check(feedNotes, "notes match the logs they came from");

  console.log("\nProfiles vs. contract");
  const members = [...new Set(logs.map((l) => l.args.member))];
  for (const address of members) {
    const [profile, onchain, onchainStreak] = await Promise.all([
      getJson(`/members/${address}`),
      publicClient.readContract({ address: ADDRESS, abi, functionName: "members", args: [address] }),
      publicClient.readContract({
        address: ADDRESS,
        abi,
        functionName: "currentStreakOf",
        args: [address],
      }),
    ]);
    const [, , , longestStreak, total] = onchain;
    const ok =
      profile.totalCheckIns === total &&
      profile.longestStreak === longestStreak &&
      profile.currentStreak === onchainStreak;
    check(
      ok,
      `${address.slice(0, 10)}…`,
      `total ${profile.totalCheckIns}/${total}, longest ${profile.longestStreak}/${longestStreak}, current ${profile.currentStreak}/${onchainStreak}`,
    );
  }

  console.log("\nLeaderboard");
  const leaderboard = await getJson("/leaderboard?limit=100");
  const expected = new Map();
  for (const log of logs) {
    const month = new Date(Number(log.args.day) * 86_400 * 1000).toISOString().slice(0, 7);
    if (month !== leaderboard.month) continue;
    expected.set(log.args.member, (expected.get(log.args.member) ?? 0) + 1);
  }
  const counted = leaderboard.entries.every(
    (e) => expected.get(members.find((m) => m.toLowerCase() === e.member.toLowerCase())) === e.checkIns,
  );
  check(counted, `counts for ${leaderboard.month} match a recount of the logs`);
  const descending = leaderboard.entries.every(
    (e, i) => i === 0 || leaderboard.entries[i - 1].checkIns >= e.checkIns,
  );
  check(descending, "ranked by check-ins, descending");

  console.log(
    failures === 0
      ? "\nThe read side matches the chain."
      : `\n${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
