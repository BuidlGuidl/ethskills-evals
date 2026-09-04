import Fastify from "fastify";
import { getAddress, isAddress } from "viem";
import { loadConfig } from "./config.js";
import { StreakIndexer } from "./indexer.js";
import { StreakStore } from "./store.js";

const config = loadConfig();
const store = new StreakStore(config.databasePath);
const indexer = new StreakIndexer(store, config);
const app = Fastify({ logger: true });

let syncing: Promise<unknown> | undefined;
async function syncNow() {
  if (!syncing) syncing = indexer.sync().finally(() => { syncing = undefined; });
  return syncing;
}

app.get("/health", async () => ({ lastSyncedBlock: store.getLastSyncedBlock() ?? null }));

app.get("/feed", async (request, reply) => {
  const { limit = "50" } = request.query as { limit?: string };
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return reply.code(400).send({ error: "limit must be an integer from 1 through 100" });
  await syncNow();
  return { checkIns: store.feed(parsed), lastSyncedBlock: store.getLastSyncedBlock() };
});

app.get("/members/:address", async (request, reply) => {
  const { address } = request.params as { address: string };
  if (!isAddress(address)) return reply.code(400).send({ error: "address must be a valid EVM address" });
  await syncNow();
  return { ...store.profile(getAddress(address), Math.floor(Date.now() / 1_000)), lastSyncedBlock: store.getLastSyncedBlock() };
});

app.get("/leaderboard/month", async (request, reply) => {
  const { limit = "100" } = request.query as { limit?: string };
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return reply.code(400).send({ error: "limit must be an integer from 1 through 100" });
  await syncNow();
  return { members: store.leaderboard(Math.floor(Date.now() / 1_000), parsed), lastSyncedBlock: store.getLastSyncedBlock() };
});

await syncNow();
setInterval(() => { void syncNow(); }, 15_000).unref();
await app.listen({ port: config.port, host: "0.0.0.0" });
