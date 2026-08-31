import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { createIndexer } from "./indexer.js";
import { ReadModel } from "./read-model.js";
import { createApi } from "./server.js";

const config = loadConfig();
const db = openDatabase(config.dbPath);
const indexer = createIndexer(db, config);

let syncing = false;
async function sync() {
  if (syncing) return;
  syncing = true;
  try {
    await indexer.sync();
  } catch (error) {
    console.error("indexing failed", error);
  } finally {
    syncing = false;
  }
}

await sync();
const server = createApi(new ReadModel(db));
server.listen(config.port, () => console.log(`Streak API listening on http://localhost:${config.port}`));
const timer = setInterval(sync, config.pollIntervalMs);

function shutdown() {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

