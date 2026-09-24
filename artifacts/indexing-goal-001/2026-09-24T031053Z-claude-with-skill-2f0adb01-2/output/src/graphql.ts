import type { StreakConfig } from "./config.js";

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export class SubgraphError extends Error {}

/**
 * Minimal GraphQL client — the read side needs no framework, just fetch.
 * Retries once on a transient 429/5xx, which The Graph's gateway does return
 * under load.
 */
export async function query<T>(
  config: StreakConfig,
  document: string,
  variables: Record<string, unknown> = {},
  attempt = 0,
): Promise<T> {
  const res = await fetch(config.subgraphUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });

  if (!res.ok) {
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      return query<T>(config, document, variables, attempt + 1);
    }
    throw new SubgraphError(`subgraph HTTP ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new SubgraphError(body.errors.map((e) => e.message).join("; "));
  }
  if (!body.data) throw new SubgraphError("subgraph returned no data");
  return body.data;
}

/** How far behind the chain head the subgraph currently is. */
export async function indexingStatus(config: StreakConfig): Promise<{
  block: number;
  hasIndexingErrors: boolean;
}> {
  const data = await query<{ _meta: { block: { number: number }; hasIndexingErrors: boolean } }>(
    config,
    `query Meta { _meta { block { number } hasIndexingErrors } }`,
  );
  return { block: data._meta.block.number, hasIndexingErrors: data._meta.hasIndexingErrors };
}
