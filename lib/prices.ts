// codex exec reports tokens and never a price, so a codex run's dollars are derived here: the
// run's own token split times OpenAI's published list price for the model that ran. claude
// reports its own cost and never comes through this table.
//
// The figure is what the run would have cost on the API at standard-tier list price, which is
// not what the operator paid — a ChatGPT-login codex is not billed per token at all. It is
// still the one number that puts a codex arm and a claude arm in the same unit, and the record
// says which kind of cost it holds (usage.cost_source).
//
// Two things it cannot see, both of which make it an underestimate: the long-context surcharge
// (2x input and 1.5x output on any single request over 272K input tokens, and codex reports one
// sum per turn, not per request) and any non-standard service tier.
//
// The same table, arithmetic and six-decimal rounding as agents-arena-backend's
// packages/backend/src/pricing.ts, so a codex run costs the same in both repos. That table
// read its rates on 2026-09-08; PRICES_CHECKED below is when they were last checked against
// the pricing page from here, which is the date a transcript footer cites. Two differences, both on rows that never meet: this table prices cache writes
// at their own rate where the page lists one (the backend folds them into fresh input), and it
// carries the older gpt-5.x rows from the pricing page. Change a rate in both places.
//
// A model missing from the table records cost_usd: null rather than a guess. When a new model
// shows up in a run, add its row from the pricing page and move PRICES_CHECKED; do not change
// an existing row's numbers for runs already recorded — their cost_usd is already written.
export const PRICES_SOURCE = "https://developers.openai.com/api/docs/pricing";
export const PRICES_CHECKED = "2026-09-15";

// USD per 1M tokens. cache_write null means the page lists no separate rate, and cache writes
// (always zero on the runs seen so far) are charged as ordinary input.
export type TokenPrice = {
  input: number;
  cached_input: number;
  cache_write: number | null;
  output: number;
};

export const CODEX_PRICES: Record<string, TokenPrice> = {
  "gpt-6-astra": { input: 10, cached_input: 1, cache_write: 12.5, output: 50 },
  "gpt-5.6-sol": { input: 4, cached_input: 0.4, cache_write: 5, output: 20 },
  "gpt-5.6-terra": { input: 2, cached_input: 0.2, cache_write: 2.5, output: 12 },
  "gpt-5.6-luna": { input: 0.2, cached_input: 0.02, cache_write: 0.25, output: 1.2 },
  "gpt-5.5": { input: 5, cached_input: 0.5, cache_write: null, output: 30 },
  "gpt-5.4": { input: 2.5, cached_input: 0.25, cache_write: null, output: 15 },
  "gpt-5.4-mini": { input: 0.75, cached_input: 0.075, cache_write: null, output: 4.5 },
  // From agents-arena-backend's table; the current pricing page no longer lists it.
  "gpt-5-codex": { input: 1.25, cached_input: 0.125, cache_write: null, output: 10 },
  "gpt-5.3-codex": { input: 1.75, cached_input: 0.175, cache_write: null, output: 14 },
  "gpt-5.2": { input: 1.75, cached_input: 0.175, cache_write: null, output: 14 },
  "gpt-5.1": { input: 1.25, cached_input: 0.125, cache_write: null, output: 10 },
  "gpt-5": { input: 1.25, cached_input: 0.125, cache_write: null, output: 10 },
  "gpt-5-mini": { input: 0.25, cached_input: 0.025, cache_write: null, output: 2 },
};

// Asked before a run rather than after it: runs are append-only, so a model missing from the
// table cannot be priced later — the tokens it would have been priced from are the only record
// and the cost field stays null for good.
export const hasCodexPrice = (model: string | null) => model !== null && CODEX_PRICES[model] !== undefined;

export type PricedTokens = {
  uncachedInput: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
};

export const codexListPrice = (model: string | null, tokens: PricedTokens): number | null => {
  const price = model === null ? undefined : CODEX_PRICES[model];

  if (price === undefined) {
    return null;
  }

  const dollars = tokens.uncachedInput * price.input
    + tokens.cacheWrite * (price.cache_write ?? price.input)
    + tokens.cacheRead * price.cached_input
    + tokens.output * price.output;

  // Rounded to a millionth of a dollar, the precision claude reports its own cost at; the raw
  // product prints as 0.21430800000000003.
  return Math.round(dollars) / 1_000_000;
};
