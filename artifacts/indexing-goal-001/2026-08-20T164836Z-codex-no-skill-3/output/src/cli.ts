import { loadConfig } from "./config.js";
import { StreakIndexer } from "./indexer.js";
import { StreakStore } from "./store.js";

const config = loadConfig();
const result = await new StreakIndexer(new StreakStore(config.databasePath), config).sync();
console.log(JSON.stringify(result));
