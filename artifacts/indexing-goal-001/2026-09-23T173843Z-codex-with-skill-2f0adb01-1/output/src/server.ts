import { createApp } from "./api.js";
import { loadConfig } from "./config.js";
import { StreakIndexer } from "./indexer.js";
import { StreakStore } from "./store.js";

const config = loadConfig();
const store = new StreakStore(config.DATABASE_PATH);
const indexer = new StreakIndexer(config, store);
const app = createApp(store);

const server = app.listen(config.PORT, () => {
  console.log(`Streak API listening on http://localhost:${config.PORT}`);
});

void indexer.startPolling();

process.on("SIGINT", () => {
  indexer.stop();
  server.close();
  store.close();
});
