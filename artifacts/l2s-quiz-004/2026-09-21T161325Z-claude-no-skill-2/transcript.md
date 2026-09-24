# Executor transcript — 2026-09-21T161325Z-claude-no-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /Users/spencerfaber/.cache/ethskills-evals/2026-09-21T161325Z-claude-no-skill-2/l2s-quiz-004

## assistant
- **Write** `/Users/spencerfaber/.cache/ethskills-evals/2026-09-21T161325Z-claude-no-skill-2/l2s-quiz-004/answer.md`

  > File created successfully at: /Users/spencerfaber/.cache/ethskills-evals/2026-09-21T161325Z-claude-no-skill-2/l2s-quiz-004/answer.md (file state is current in your context — no need to Read it back)

## assistant
I wrote the answer to `answer.md`. It's a design only: I didn't build or test anything.

**Where to deploy:** Arbitrum One. Your Rust scoring routine becomes a Stylus contract (Rust compiled to WASM), and your ERC-20, staking and slashing contracts stay the same. Your routine is a good fit because Stylus rejects floating-point code and yours is integer-only. If your contracts aren't on Arbitrum today, you'd have to redeploy them there and migrate the token. That migration is the biggest cost of this choice.

**What runs onchain:**
- Pull the routine into its own crate with no chain dependencies. Both the firmware and a thin Stylus wrapper build from that same crate.
- A few things can make the WASM build give different answers from firmware:
  - **Pointer width:** WASM uses 32-bit pointer-sized integers, so keep all math in fixed-width types.
  - **Overflow:** write it explicitly in the code rather than relying on build settings.
  - **Panics:** return errors instead. A panic would make the whole reward transaction fail.
- Check device signatures in Solidity: `ecrecover` for secp256k1 keys, or Arbitrum's P-256 precompile for secure-element keys. The scoring code stays identical to what firmware runs.

**How the reward contract calls it:** through an ordinary Solidity interface, wrapped in `try/catch` so bad input produces no reward instead of a failed payout. The contract points to a scorer address per epoch, so old rewards can still be recomputed after an upgrade. The deciding factor is how much raw data an hour produces:
- **A few KB per device-hour:** score every hour onchain.
- **Much larger:** your server posts scores plus a hash of the samples. Anyone can challenge an hour during a window, and the same scorer re-runs it onchain.

**What the deploy pipeline adds over a plain Solidity deploy:**
- **Reproducible builds:** operators must be able to rebuild the code and get exactly what's deployed. That's what makes disputes resolvable.
- **Size check:** `cargo stylus check` gates the roughly 24 KB compressed limit.
- **Deploy, then activate:** each deploy needs a separate, paid activation step before the contract can be called.
- **Keep it activated:** activation expires after about a year, and some Arbitrum upgrades also require reactivation. If it lapses, scoring calls fail and rewards stop, so you need a scheduled job and alerts.
- **Optional cache bid:** makes each of your tens of thousands of daily calls cheaper.
- **Interface check:** fail CI if the generated Solidity interface differs from the committed one.
- **Replay test:** run recorded device-hours through the firmware build, a native build and the deployed contract, and require identical outputs.
- **Versioned rollout:** each scoring change is a new contract switched in for a future epoch. Old scorers stay deployed and activated while past rewards can still be disputed.

**When this would be the wrong choice:**
- **Your contracts must stay on a chain without Stylus** (Ethereum mainnet, OP Stack chains). Run the same Rust in a zero-knowledge VM (SP1 or RISC Zero) and verify proofs on that chain instead.
- **Raw samples must stay private.** Onchain re-execution needs public inputs, so you'd need zero-knowledge proofs.
- **Data gets too big to post.**
- **Scoring changes shape:** it needs floats or ML models, or ranks devices against each other network-wide.
- **Firmware can no longer share the Rust crate.**
- **Disputes become rare and low-stakes.** Publishing the code plus a signed data hash each hour may be enough.
- **You won't accept Arbitrum's trust model:** its governance, its sequencer, and its 7-day withdrawal delay to Ethereum.

The roughly 24 KB size limit and the one-year activation expiry are from memory, so check them against current Arbitrum parameters.

## run stats
- turns: 2
- duration: 91s
- cost: $0.37717500000000004
- tokens in/out: 39982/9051
- of which cache write/read: 13778/26200
