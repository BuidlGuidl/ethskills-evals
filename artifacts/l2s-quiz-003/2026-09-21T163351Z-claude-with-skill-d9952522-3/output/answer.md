# Cross-chain layer for the game token (Base ⇄ OP Mainnet)

## TL;DR

- **Don't build on Superchain interop.** `SuperchainERC20`, `L2ToL2CrossDomainMessenger`, `CrossL2Inbox` and `SuperchainTokenBridge` are still on devnets and testnets, not on OP Mainnet. Even once they ship, they would not reach Base. Base left the OP Stack: it has run its own Base Stack since the Azul upgrade (May 2026) and upgrades on its own schedule (Beryl, June 2026). So "both chains are Superchain, use native interop" is a plan that no longer holds.
- **Don't use the canonical bridges for player moves.** Going Base → L1 → OP Mainnet means an optimistic withdrawal: initiate, prove on L1, then finalize after a challenge window measured in days. On top of that, someone has to submit the L1 transactions. That doesn't work as an in-game button.
- **Recommended: a burn/mint token on an existing messaging network that runs its own relaying.** My default is a **LayerZero V2 OFT** deployed on both chains. **Chainlink CCIP with a Cross-Chain Token (CCT)** is an equally valid second choice with the same shape (notes below). In both, the network's own off-chain agents carry the message, so **we don't run a relayer**. Players pay for delivery in ETH on the source chain, which works because both chains use ETH for gas.

---

## 1. What we deploy on each chain

| | Base (8453) | OP Mainnet (10) |
|---|---|---|
| Token | `GameToken` = OFT (ERC-20 + LayerZero OApp), burn/mint | Same contract, burn/mint |
| Initial supply | **All** of it, minted once at deploy to the treasury multisig | **Zero** — only ever minted by inbound messages |
| Peer config | `setPeer(OP_EID, opToken)` | `setPeer(BASE_EID, baseToken)` |
| Security config | Send/receive libraries pinned (not left on "default"), DVN set + confirmations set explicitly | Same, mirrored |
| Safety rails | Per-direction rate limit (outbound and inbound), `pause()`, owner = multisig (plus a timelock for config changes) | Same |
| Game-side | Nothing new on-chain. The client calls `quoteSend` / `send` and tracks the message | Same |

Notes:
- **One supply, enforced by construction.** Supply is minted once on one chain. After that, tokens are only ever burned on the source chain and minted on the destination chain when a verified message arrives. The invariant `supply(Base) + supply(OP) + in-flight = TOTAL` holds without anyone reconciling it. No mint function is exposed to anyone except the messaging endpoint. The alternative, a lockbox (`OFTAdapter`) on a home chain, adds a honeypot and buys us nothing, since this token is new.
- **Same address on both chains is optional.** CREATE2/CREATE3 through one factory with the same salt and bytecode gives the token a single address, which is nice for UX and the token list. The messaging layer doesn't need it: peers are configured explicitly.
- Deploy is the same on both chains: same bytecode, change the RPC URL and chain id. Use `block.timestamp`, never `block.number`, in any time-based logic, including rate-limit windows.

## 2. What happens when a player moves a balance (Base → OP; the reverse is symmetric)

1. **Quote.** The game client calls `quoteSend(dst=OP, amount, to=player, options)` on Base and shows the fee (in ETH) plus the destination gas budget it includes.
2. **Send.** The player signs one transaction on Base: `send(...)` with `msg.value = fee`. The OFT **burns** `amount` from the player on Base. The LayerZero Endpoint emits a packet with a unique GUID. The game stores the GUID and shows the transfer as "in flight".
3. **Verify.** The DVNs (Decentralized Verifier Networks) we configured each wait for the configured number of Base confirmations, then attest to the packet hash on OP Mainnet's receive library. Once the required set has attested, the packet is committed as verified.
4. **Execute.** LayerZero's Executor calls `lzReceive` on the OP token, and the OFT **mints** `amount` to the player on OP. The executor's gas is prepaid out of the step-2 fee, so nobody on our side has to act.
5. **Confirm in-game.** The client watches for the `OFTReceived` event on OP, keyed by GUID, or polls LayerZero Scan's API. Then it flips the balance from "in flight" to settled.

**If step 4 stalls** (executor outage, or too little destination gas quoted), the burned tokens are not lost. Once a packet is verified, *anyone* can call `lzReceive` through the Endpoint. Our fallback is a "retry delivery" button in the game, or a small ops script run by hand. It is not a relayer service we operate. Keep `lzReceive` trivial (credit only, no composed calls) so a stuck delivery is almost always a gas problem, never a revert.

**If step 3 stalls** (a DVN is down), nobody can force the message through. It waits. That is the liveness price of the security model. See the assumptions section.

## 3. Who carries the message, and what we trust

- **Relaying:** LayerZero's Executor, paid per message by the player's `msg.value`. We run nothing.
- **Verification (the actual trust assumption):** the DVN set we choose. Example: require 2 independent DVNs, such as LayerZero Labs plus Google Cloud, Nethermind or Polyhedra, whichever are live on both chains when we configure. Optionally add a threshold over a larger optional set. If the required DVNs collude or are compromised, they can attest to a fake packet, which **mints unbacked tokens on the destination chain**. Mitigations:
  - more independent required DVNs
  - inbound **rate limits**, so the worst case is capped per window
  - a supply-invariant monitor that pauses on a mismatch
- **Governance power we hold:** the owner multisig can re-point peers, swap DVNs or change libraries. A malicious or compromised owner can therefore mint via a fake peer. Put the owner behind a multisig plus a timelock for config changes, and say so publicly.
- **Beyond Ethereum:** transfers do *not* inherit rollup security. They rely on the DVN set being honest and on source-chain confirmations not reorging after attestation. That trade is the price of a transfer that settles in minutes instead of days, and it is the right one for a game token.

**CCIP alternative.** Same shape: a burn/mint CCT on both chains with a token pool per chain. Chainlink's DON relays, and the Risk Management Network adds a second check. You get built-in per-lane rate limits, and fees can be paid in ETH or LINK. It is a fair choice if you'd rather trust Chainlink's fixed security model than configure DVNs yourself. Wormhole NTT and Hyperlane also fit. With Hyperlane, confirm who runs the relayer on this route, because self-hosting is common there and self-hosting is what you want to avoid.

## 4. What we can commit to for Q4 vs. what's a bet

### Commit (built from things live on mainnet today)
- OFT (or CCT) burn/mint token on Base and OP Mainnet, with all supply minted on one chain.
- Explicit DVN configuration (2+ required, independent), pinned libraries, confirmation counts set per chain.
- Rate limits in both directions, pause, and a multisig owner with a timelock on config changes.
- In-game move flow: quote, then one signed tx, then an "in flight" state tracked by GUID, then settled. Includes a user-facing "retry delivery" path for verified-but-unexecuted packets.
- Monitoring: a supply-invariant check across both chains, stuck-message alerts (verified but not executed for more than N minutes), and alerts on rate limits being hit.
- Full rehearsal on Base Sepolia ⇄ OP Sepolia, an external audit of the token and config, and a mainnet canary with small caps before raising the limits.
- Players need a little ETH on the source chain for gas plus the message fee. Commit to showing that fee clearly, not to hiding it.

### Bet (depends on things not yet live, or on work with real schedule risk)
- **Superchain native interop (`SuperchainERC20` etc.).** Not live on OP Mainnet. Even when it is, it covers OP Mainnet and other OP Stack chains, **not Base**. At best a future option for adding more OP Stack chains. Never the Base⇄OP path.
- **Gasless / fee-sponsored moves.** Sponsoring gas and the LZ fee through ERC-4337 paymasters on both chains, or a sponsored-send contract, is doable but needs its own bundler/paymaster vendor, abuse controls and budget. Ship it as a follow-up.
- **"Instant" moves.** End-to-end latency is set by DVN confirmation counts and executor timing. Lowering confirmations speeds things up but increases reorg exposure. Don't promise a number until it has been measured on mainnet with the final config.
- **Composed moves** (move and equip, or move and list in a marketplace on arrival, via `lzCompose`). They add revert paths on the destination. Leave them for after launch.
- **Dual-provider redundancy** (LZ + CCIP) or migrating messaging layers later. Possible with a burn/mint design, but a second minter doubles the attack surface. That's a design project in its own right, not a Q4 item.
- **Fully trust-minimized transfers** (settling through L1 with rollup security). Days per transfer, plus someone submitting the L1 prove/finalize transactions. Only viable as a slow "escape hatch", not as the game path.

## 5. What this design assumes about Base and OP Mainnet (and what breaks if an assumption fails)

1. **Both chains are live and include transactions promptly.** If either sequencer halts, moves out of it can't start, and moves into it are verified but can't execute until it recovers. Funds aren't lost, but they sit "in flight". A long outage becomes a support incident, and the game UI has to show it honestly.
2. **Both chains use ETH as the gas token.** The fee model ("player pays in ETH on the source chain") depends on it.
3. **The messaging layer stays deployed and supported on both chains:** LayerZero Endpoint V2 at its published addresses, our chosen DVNs, the Executor. If a provider drops a chain, or a DVN stops serving one, messages stop verifying. Check endpoint and DVN addresses on each chain's live deployment list before configuring, not from memory.
4. **Confirmation depth means what we think it means.** DVNs attest after N source-chain blocks. That is safe only if the chain doesn't reorg past that depth. This is where a reorg would bite: a reorg past attestation means tokens minted on the destination whose burn no longer exists. **Base is now on its own stack and upgrades on its own schedule.** Any Base (or OP) change to block production, reorg or safe-head behavior, or block time means re-checking the confirmation counts. Track Base upgrades and OP upgrades as two separate feeds.
5. **Nothing assumes Base and OP share a stack.** This design deliberately avoids that. It would break (and was one of the assumptions people are getting wrong) if someone later added OP-Stack-only tooling or predeploys to the Base side: `SuperchainERC20`, the L2⇄L2 messenger, op-specific viem actions. It would also break if we planned on a joint upgrade window.
6. **Both chains stay EVM-equivalent for our bytecode:** same opcodes, precompiles and `block.timestamp` semantics. Both run their own forks now, so re-run the test suite against each chain's upcoming hard fork on its testnet before it activates.
7. **Chain ids 8453 and 10, and the endpoint IDs mapped to them, don't change.** Peers and rate limits are keyed on them.

**Before this goes into a plan, verify live rather than from memory:** current LZ endpoint and DVN addresses on both chains; message fees at today's gas; measured Base⇄OP latency with the final DVN and confirmation config; and whether Superchain interop has reached OP Mainnet since this was written (September 2026). Even if it has, that changes nothing for Base.
