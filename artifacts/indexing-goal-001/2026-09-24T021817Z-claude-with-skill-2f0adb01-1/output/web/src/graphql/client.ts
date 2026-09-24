import "server-only";
import { subgraphUrl } from "@/config";

export class SubgraphError extends Error {}

/**
 * Minimal GraphQL client for the Streak subgraph. Server-only on purpose: the
 * gateway URL embeds an API key, so the browser never sees it — the feed polls
 * our own /api/feed route, which calls through to here.
 */
export async function query<T>(
  document: string,
  variables: Record<string, unknown> = {},
  init: { revalidate?: number } = {}
): Promise<T> {
  const response = await fetch(subgraphUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
    // Short cache so a burst of readers doesn't hammer the gateway, but the
    // feed still feels live. Screens that must be fresh pass revalidate: 0.
    next: { revalidate: init.revalidate ?? 10 },
  });

  if (!response.ok) {
    throw new SubgraphError(
      `Subgraph HTTP ${response.status}: ${await response.text().catch(() => "")}`
    );
  }

  const body = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };

  if (body.errors?.length) {
    throw new SubgraphError(body.errors.map((e) => e.message).join("; "));
  }
  if (!body.data) {
    throw new SubgraphError("Subgraph returned no data");
  }
  return body.data;
}

/**
 * How far behind the chain head the indexer is. Worth surfacing: a subgraph
 * that has fallen behind shows a stale feed, and silently stale is worse than
 * visibly stale.
 */
export async function indexingStatus(): Promise<{
  block: number;
  hasIndexingErrors: boolean;
}> {
  const data = await query<{
    _meta: { block: { number: number }; hasIndexingErrors: boolean };
  }>(`{ _meta { block { number } hasIndexingErrors } }`, {}, { revalidate: 10 });
  return {
    block: data._meta.block.number,
    hasIndexingErrors: data._meta.hasIndexingErrors,
  };
}
