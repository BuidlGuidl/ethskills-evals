import { indexingStatus } from "@/graphql/client";

/**
 * Tells the reader when the indexer has fallen behind or hit an error, instead
 * of quietly serving a stale feed as if it were live.
 */
export async function SubgraphWarning() {
  let status: { block: number; hasIndexingErrors: boolean };
  try {
    status = await indexingStatus();
  } catch {
    return (
      <div className="banner">
        Can&rsquo;t reach the subgraph. The data below may be missing or stale.
      </div>
    );
  }

  if (status.hasIndexingErrors) {
    return (
      <div className="banner">
        The subgraph reported an indexing error — history may be incomplete.
      </div>
    );
  }

  return null;
}
