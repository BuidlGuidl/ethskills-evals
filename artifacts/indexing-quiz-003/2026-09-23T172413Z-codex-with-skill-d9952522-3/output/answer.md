The subgraph is overkill for this panel, and it is not the most accurate source
for this particular question.

The panel only needs current balances: "what does this wallet hold right now?"
That is current contract state, so the source of truth is each token contract's
`balanceOf(address)` result at the block being read. A subgraph is useful when we
need historical or derived data: feeds, activity, holder history, charts,
leaderboards, P&L, pagination over past transfers, or other queries that cannot
be answered cheaply from the current chain state. This panel does not need any of
that.

I would build it as a live read:

1. Keep the supported 40 Base ERC-20 token addresses in app/config.
2. When the connected user opens the portfolio panel, encode 40
   `balanceOf(userAddress)` calls.
3. Send those calls through Base's Multicall3 contract:
   `0xcA11bde05977b3631167028862bE2a173976CA11`.
4. Decode the 40 returned `uint256` balances and format them using known token
   decimals from config. If decimals are not already in config, fetch/cache them
   separately as token metadata, not as part of the balance refresh path.

That takes 1 RPC `eth_call` for the panel refresh. Inside that one call,
Multicall3 performs 40 read-only calls, one to each token's `balanceOf`. If we did
not use Multicall3, it would be 40 separate `eth_call`s, but I would not choose
that for this UI because one batched call is simpler to keep consistent and easier
on the RPC provider.

This stays accurate because `balanceOf` reads the token contract's live state.
Transfers, mints, burns, and other token-specific balance changes update the
contract storage that `balanceOf` reports. When the user closes and reopens the
panel, the app makes a fresh Multicall at the latest block, so the displayed
numbers reflect the chain state at that moment. If we want all 40 balances to be
from exactly the same point in time, the Multicall already gives us that: the
whole batch is evaluated against one block context.

The proposed subgraph would add operational burden without improving correctness:
we would need to backfill Transfer logs for 40 contracts, host or publish the
subgraph, maintain mappings, handle reorgs and indexing lag, add alerting, and
pay for/query an indexed service in production. It can also be less correct for
"right now" because an indexer is eventually consistent and can lag the head of
chain. It is also reconstructing balances from events, while `balanceOf` is the
canonical read.

Recommendation: do not spend a sprint building and operating a subgraph for this
panel. Use a single Multicall3 `eth_call` on panel open to fetch the 40
`balanceOf` values directly from Base.
