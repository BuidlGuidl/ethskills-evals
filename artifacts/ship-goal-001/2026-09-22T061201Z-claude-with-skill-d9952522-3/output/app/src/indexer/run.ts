/**
 * Indexer entrypoint: `npm run indexer`.
 *
 * Runs as its own process, separate from the web server, so that restarting the site does not
 * interrupt indexing and a stuck RPC cannot take the site down with it.
 */
import {run} from "./index.ts";

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
