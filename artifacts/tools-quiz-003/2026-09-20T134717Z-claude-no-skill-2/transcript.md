# Executor transcript — 2026-09-20T134717Z-claude-no-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals/2026-09-20T134717Z-claude-no-skill-2/tools-quiz-003

## assistant
- **Bash** `cat > /home/damu/.cache/ethskills-evals/2026-09-20T134717Z-claude-no-skill-2/tools-quiz-003/answer.md <<'EOF'
# Giving a wallet-Q&A agent clean on-chain data

## Short answer

Wire the agent to the ** … [5461 more chars]`

  > done

## assistant
Wrote `answer.md`. The recommendation:

**Etherscan V2 multichain API** — `https://api.etherscan.io/v2/api`, one key and one base URL for 60+ chains, with the chain selected by a `chainid` query param.

Why it fits your two constraints:
- **No scraping** — it's the same company's JSON API behind the explorer UI.
- **No hand-decoding** — unlike raw JSON-RPC, it returns decoded records with `tokenSymbol`, `tokenDecimal`, `functionName`, `timeStamp`. RPC has no address-history method at all; that's an indexer feature.

The endpoints the agent needs map 1:1 to your three capabilities: `account&action=txlist` (transactions), `tokentx` / `tokennfttx` (transfers), `balance` / `balancemulti` / `tokenbalance` (balances).

On *how the agent addresses it*, the answer argues against exposing a generic HTTP tool — define narrow tools (`get_wallet_transactions(address, chain, limit)`, etc.) with a name→chainid map, and put a normalization layer underneath: convert wei and token decimals before the model sees values, ISO-ify `timeStamp`, strip `input` calldata, cap `offset`. Also flagged two gotchas that bite in practice: `status:"0"` + "No transactions found" is a normal empty result rather than an error, and the free tier's 5 calls/sec needs a limiter since the agent will fan out in parallel.

One scope note: for LP shares, staking positions, or USD pricing you'd need a portfolio API (Zerion/Zapper) on top — Etherscan covers exactly the transactions/transfers/balances you asked for, not derived DeFi state.

## run stats
- turns: 2
- duration: 44s
- cost: $0.18788049999999998
- tokens in/out: 36370/3217
- of which cache write/read: 9395/26971
