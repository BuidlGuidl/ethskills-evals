import "dotenv/config";
import { createServer } from "node:http";
import { isAddress, type Address } from "viem";
import { openDatabase } from "./database.js";
import { createIndexer } from "./indexer.js";
import { memberProfile, monthlyLeaderboard, recentFeed } from "./queries.js";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const rpcUrl = required("RPC_URL");
const contractAddress = required("CONTRACT_ADDRESS");
if (!isAddress(contractAddress)) throw new Error("CONTRACT_ADDRESS is invalid");
const { db, getCursor, setCursor } = openDatabase(process.env.DATABASE_PATH ?? "./streak.sqlite");
const indexer = createIndexer({ rpcUrl, contractAddress: contractAddress as Address, deploymentBlock: BigInt(required("DEPLOYMENT_BLOCK")), confirmations: BigInt(process.env.CONFIRMATIONS ?? "10"), db, getCursor, setCursor });

await indexer.sync(); // Blocks startup until the full historical backfill is complete.
setInterval(() => indexer.sync().catch(console.error), 15_000).unref();

const respond = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};
createServer((req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const limit = Number(url.searchParams.get("limit") ?? 30);
    if (url.pathname === "/v1/feed") return respond(res, 200, recentFeed(db, limit, url.searchParams.get("before") ? Number(url.searchParams.get("before")) : undefined));
    if (url.pathname === "/v1/leaderboard") return respond(res, 200, monthlyLeaderboard(db, limit));
    const member = url.pathname.match(/^\/v1\/members\/(0x[a-fA-F0-9]{40})$/)?.[1];
    if (member) return respond(res, 200, memberProfile(db, member));
    respond(res, 404, { error: "not found" });
  } catch (error) { respond(res, 400, { error: error instanceof Error ? error.message : "bad request" }); }
}).listen(Number(process.env.PORT ?? 3000), () => console.log("Streak read API listening"));
