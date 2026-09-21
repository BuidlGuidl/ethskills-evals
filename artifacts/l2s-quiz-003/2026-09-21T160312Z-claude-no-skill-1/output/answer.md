# Cross-chain layer for the game token (Base + OP Mainnet)

## TL;DR

- **Build one token contract, deployed to the same address on both chains.** It uses burn/mint: a transfer burns tokens on the source chain and mints them on the destination. It exposes the ERC-7802 `crosschainMint` / `crosschainBurn` interface. Only allowlisted bridges can call it, and each bridge gets its own rate limit.
- **Q4 commitment:** move tokens with an established third-party messaging network that already runs its own delivery infrastructure on Base and OP Mainnet. I recommend LayerZero OFT with a pinned multi-DVN config. Chainlink CCIP is the alternative if you care more about security posture than latency. Either way, **we don't run a relayer.** The game calls one function on the source chain, and the network delivers to the destination.
- **The bet:** native Superchain interop (`SuperchainTokenBridge` + `L2ToL2CrossDomainMessenger`) between Base and OP Mainnet. The token is built so this can be switched on later as a second allowlisted bridge, with no migration. Don't put it on the Q4 critical path. It depends on things Optimism, Base and their governance control, not us.
- **Not an option for in-game moves:** the canonical OP Stack bridge. Going L2 → L1 → L2 means a withdrawal proof plus a ~7-day challenge window. That's fine for a treasury, but not for a player.

---

## 1. What we deploy on each chain

The same set of contracts goes on Base (chain id 8453) and OP Mainnet (chain id 10).

| Contract | Purpose | Notes |
|---|---|---|
| `GameToken` (ERC-20 + ERC-7802) | The token | Same address on both chains: deploy via CREATE2/CREATE3 with the same salt and init code, e.g. through the OP Stack `Create2Deployer` preinstall or a CREATE3 factory present on both. Keep constructor args chain-independent. The same address is required for Superchain interop later and makes client code simpler now. |
| Bridge allowlist + rate limits (inside the token, xERC20 / ERC-7281 style) | Controls who may mint and burn | `bridges[addr] = {mintLimit, burnLimit, refillPerSec}`. Only allowlisted bridges can call `crosschainMint` / `crosschainBurn`. This caps the damage if any one bridge is compromised. |
| `GameTokenBridgeAdapter` (LayerZero OFT adapter/mint-burn OApp, or CCIP BurnMint token pool) | Sends and receives messages for the Q4 path | Its peer is set to exactly one address: the adapter on the other chain, at the other chain's endpoint ID. It burns on send and mints on receive by calling the token. |
| Admin: Safe multisig + timelock on each chain | Owns the allowlist, limits, peers, DVN config and pause | Any change that adds a bridge or raises a limit goes through the timelock. Pausing is immediate and can be done by a smaller guardian set. |
| (Optional) paymaster / smart-account setup | Gas sponsorship | Lets players move tokens without holding ETH on the source chain. The messaging fee is ETH on the source chain; the game can cover it. |

**The supply model is "one supply", enforced by burn/mint.** The genesis mint happens on one chain only. After that, the invariant is:

`supply(Base) + supply(OP) + in-flight(burned, not yet minted) == TOTAL_SUPPLY`

There is no lockbox and no "home chain" vault, so there's no big honeypot. Our indexer checks this invariant continuously and pages someone if it drifts.

## 2. What happens when a player moves a balance

This example moves a balance from Base to OP Mainnet on the committed path.

1. **In game:** the player picks an amount and the destination chain. The client calls `quoteSend()` on the Base adapter to get the messaging fee in ETH.
2. **Source transaction on Base:** the player signs one transaction, or a sponsored UserOp. `adapter.send(dstEid=OP, to=player, amount, minAmount, options)` does two things:
   - calls `token.crosschainBurn(player, amount)`, which is rate-limited per bridge;
   - hands a message `{to, amount}` to the LayerZero endpoint and pays the fee.
3. **Verification:** after the configured number of block confirmations on Base, the required DVNs attest to the message. Use at least 2 required, from different operators, not the defaults.
4. **Delivery:** LayerZero's executor, which LayerZero runs and the fee pays for, calls `lzReceive` on the OP adapter. The adapter checks the peer and mints with `token.crosschainMint(player, amount)`.
5. **In game:** the client tracks the message by GUID (LayerZero Scan API or our own indexer) and shows "arriving on OP". It credits the player when it sees the `CrosschainMint` event on OP.
6. **Failure handling:**
   - If the destination mint reverts (paused, or rate limit hit), the message stays stored and can be retried permissionlessly once cleared. The game exposes a "retry" button, so nobody needs to run a relayer for this either.
   - If the executor stalls, anyone, including the player's own client, can execute the verified message.

With CCIP the flow is the same. The router and token pool replace the endpoint and adapter, and the CCIP DON commits and executes. It is slower, because CCIP waits for finality of the source chain. On OP Stack chains that means L1 finality of the batch, so expect tens of minutes, not seconds.

**Who carries the message:** the messaging network's off-chain operators (DVNs and executor, or the CCIP DON). The source-chain fee pays them. We don't run infrastructure for delivery. We do run an indexer and monitoring, which you need anyway.

**Latency vs safety:** the one number that matters is the source confirmation count. OP Stack L2 blocks are "unsafe" until their batch lands on L1, and "finalized" once that L1 block finalizes, roughly 15–30 minutes. Fewer confirmations make the transfer faster but open a double-spend window if the sequencer reorgs its unsafe head. Two ways to handle it:
- Pick a conservative count and show honest ETAs in the UI.
- Or use a split policy: small amounts go fast, large amounts wait for safe/finalized. That can be done by sending large transfers over a stricter config or pathway.

## 3. What we commit to for Q4

These pieces use only things that are live today and that we control or can buy.

1. `GameToken` with ERC-7802 hooks and a per-bridge allowlist and rate limits, at the same address on Base and OP Mainnet, audited.
2. **One** messaging integration: LayerZero OFT, or CCIP CCT if you choose security over latency. It needs:
   - explicit (non-default) DVN and confirmation config;
   - peers locked to each other;
   - conservative starting rate limits.
3. In-game flow: quote, send, then track by message ID, with retry for failed deliveries. Optional gas sponsorship on the source chain.
4. Operations:
   - Safe multisig and timelock on both chains, plus a guardian pause;
   - an indexer that monitors the supply invariant and in-flight messages;
   - alerts on rate-limit saturation and unusual mint volume;
   - a runbook for "bridge compromised" (pause, then revoke the bridge from the allowlist).
5. A published statement to players about delivery times and what "pending" means.

What we are trusting on this path is the messaging network's verifier set, plus our own admin keys. The rate limits bound the worst case to a known number per window. Say that number out loud internally.

## 4. The bet

- **Native Superchain interop between Base and OP Mainnet.** The mechanics:
  - `SuperchainTokenBridge.sendERC20` (predeploy `0x4200…0028`) burns via ERC-7802 and emits a message through `L2ToL2CrossDomainMessenger`.
  - The destination chain validates it against its interop dependency set.
  - It is minted when someone calls `relayMessage` on the destination.

  The upside: the Superchain's own security, with no third-party verifier set, low latency, and no messaging fee beyond gas.

  **Why it's a bet:** it requires *both* chains to have activated the interop upgrade on mainnet and to be in *each other's* dependency set. As of what I can verify (my information runs to roughly mid-2026), I can't confirm that this has happened for Base ↔ OP Mainnet. Neither its timing nor Base's participation is ours to schedule. Check the current Superchain upgrade status and Base's public roadmap before planning around it.

  **It also doesn't fully remove "someone relays".** Interop needs a destination-side transaction. Either:
  - the player's client submits it (a second transaction, on the destination chain, needing destination gas, which is sponsorable);
  - or we rely on an autorelayer, which is not guaranteed to exist or be free.

  "No relayer we run" is achievable by having the game client self-relay, but it's two transactions.

  **How we de-risk it:** the Q4 token already speaks ERC-7802 and lives at the same address. Enabling interop is then a timelocked `setBridge(SuperchainTokenBridge, limits)` on both chains. There's no token migration and no liquidity move. The old bridge can stay live in parallel or be drained and revoked.
- **Other bets that aren't on the critical path:**
  - "Instant" UX via low confirmation counts on large amounts. That's a security bet, not a schedule bet.
  - Intent/solver-based fast fills, where someone fronts the tokens on the destination. That needs solver liquidity in our token, which won't exist at launch.
  - Adding a second messaging provider for redundancy. It's cheap to add later because of the allowlist.

## 5. Assumptions about Base and OP Mainnet this design depends on

If any of these stop holding, the item they affect breaks:

1. **Both chains stay EVM-equivalent with ETH as gas, and the deterministic deployer stays the same.** The same-address deployment and the shared code depend on this. If Base drifted from OP Stack predeploys and preinstalls, we'd lose same-address deployment. That doesn't matter for Q4, but it kills the SuperchainERC20 path.
2. **Base remains an OP Stack / Superchain chain and joins an interop set with OP Mainnet.** The whole bet in §4 depends on this. If Base moves to its own stack or opts out of Superchain interop, the bet is dead. The Q4 path is unaffected because it doesn't depend on shared infrastructure. This is the assumption I'd watch most closely.
3. **Sequencers are live and don't equivocate beyond what our confirmation depth covers.** An outage stalls transfers: the burn doesn't land, or the mint can't land. Funds aren't lost, because messages retry, but the UX breaks. A reorg of the unsafe head deeper than our confirmation count lets a burn vanish after its mint landed on the other chain, which inflates supply. Choosing the confirmation depth is how we price this risk.
4. **L1 data posting and finality behave normally.** Batches reach L1 on the usual cadence, and "safe/finalized" means what we think it means. CCIP latency and any "wait for finalized" policy depend on it. A long batcher outage stretches transfer times to hours.
5. **Forced inclusion via L1 exists.** The sequencer window lets users force transactions through L1 if the sequencer censors. This is our last resort for a player whose transfer is censored. If it were removed or weakened, censorship would become unrecoverable at the chain level.
6. **The chains' governance doesn't ship hard forks that break the contract assumptions we rely on.** That covers predeploy addresses, opcode behavior and gas semantics. Base and OP upgrades are controlled by their governance and Security Council, not us.
7. **The chosen messaging network keeps supporting both chains** at the current endpoint addresses and chain/endpoint IDs, and its verifier set stays honest. That isn't a chain assumption, but it's the one the Q4 path leans on most. The rate limits and a second-provider slot are the hedge.
8. **We never use the canonical L2↔L1 bridge in the player path.** If a product requirement ever pushed player transfers through it, the ~7-day withdrawal window makes the "move from inside the game" promise impossible.

## Bottom line

For Q4, ship a burn/mint ERC-7802 token at the same address on both chains, bridged by one third-party messaging network with its own executors. Players get one-click transfers and we run no relayer. Treat native Superchain interop as an upgrade we can switch on later with a governance transaction, only if Base and OP Mainnet actually end up in the same interop set.
