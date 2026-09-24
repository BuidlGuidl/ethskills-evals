# Onchain scoring for the DePIN network: where it runs and how to build it

## Recommendation: Arbitrum One, with the scoring routine as a Stylus program

What decides this is one thing you said: **you will not keep a second implementation of a 2k-line Rust routine.** That rules out any chain where onchain code has to be Solidity/EVM bytecode. Porting the routine to Solidity is exactly the second implementation you refuse to write, and it would drift from the firmware.

Arbitrum Stylus runs Rust compiled to WASM next to the EVM on the same chain. Stylus programs and Solidity contracts share state and can call each other both ways. So:

- **The scoring crate the firmware pipeline uses gets compiled for onchain use.** It is the same source, with a thin Stylus entrypoint added. Fixed-point integer math with no floats is the case that ports cleanly: nothing non-deterministic has to be removed.
- **Your Solidity stays Solidity.** The ERC-20, staking and slashing contracts deploy to Arbitrum One unchanged, because it is an optimistic rollup and takes the same bytecode.
- **Operators can check their own score for free.** An `eth_call` to the deployed program with their own samples gives the exact number the reward contract will use, from the exact code that computes it.

Stylus runs compute-heavy work much faster than equivalent EVM code (roughly 10–100x). The gas saving is much smaller: about 26–50% compared with well-optimised EVM, and storage costs the same as in the EVM. The reason to use it here is the single implementation, not cheaper gas. Measure the real gas for one device-hour on Arbitrum Sepolia before committing to a budget. Don't plan on a remembered number.

## What runs onchain

Scoring every device every hour onchain means putting a few thousand hours of raw samples into calldata each hour. Most of the cost would be data, not compute, and almost none of it would ever be disputed. Instead, **commit every hour and recompute onchain only when someone disputes**:

1. **Hourly commitment (your server, as today).** The server scores everything off-chain using the same crate. It then posts one transaction to `RewardDistributor` containing:
   - a Merkle root over `(deviceId, hour, samplesHash, score, scorerVersion)`;
   - the hour's reward parameters.

   The server operator is bonded through your existing staking contract.
2. **Claim.** A device or operator claims its reward with a Merkle proof against that root.
3. **Dispute (the whole point of the exercise).** During a dispute window, an operator who thinks their score is wrong calls `dispute(leaf, proof, samples, deviceSignature)`. The contract then:
   - checks the leaf is in the committed root;
   - checks `keccak256(samples) == samplesHash`, so the samples are the ones committed at the time and can't be picked after the fact;
   - checks the device's signature over the samples, so nobody can submit made-up data. If the device key scheme is not secp256k1 (ed25519, for example), do this check inside the Stylus program in Rust rather than in Solidity;
   - calls the Stylus scorer: `IScorer(scorerFor[version]).score(samples)`;
   - if the result differs from the committed score, corrects the reward and slashes the poster's bond through your existing slashing contract. If it matches, the disputer loses a small dispute fee, which prevents spam.

The operator's local check and the contract's check run the same WASM. In practice, a dispute is only filed when the operator already knows it will win.

If you do want every score computed onchain (step 1 replaced by direct submission of samples), the same scorer handles it. Only the call site changes. Price the calldata first.

### How the reward contract calls the scorer

- Write the Stylus entrypoint with the `stylus-sdk` `#[public]` macro, for example `fn score(&self, samples: Vec<u8>) -> U256`. It is a thin wrapper that decodes bytes into your sample structs and calls the existing `score()` function in the shared crate.
- `cargo stylus export-abi` generates the Solidity interface (`IScorer`). The Solidity side just sees an ordinary contract address.
- Keep scorer addresses **versioned**, not swapped in place: `mapping(uint32 => address) scorerFor`, updated only through your existing governance or a timelock. Each hourly leaf records which `scorerVersion` produced it. That way a dispute about last week is judged by last week's code, even after a firmware scoring change has shipped a new program.
- Use `block.timestamp` for epochs, dispute windows and staking periods, never `block.number`. On Arbitrum, `block.number` returns an approximate L1 block number, not the L2 block. Check your existing staking and slashing code for this before redeploying it.

### Repository layout

```
scoring/            # the existing crate — no_std-compatible, no Stylus deps
scoring-stylus/     # thin cdylib: stylus-sdk entrypoint, ABI decoding, calls scoring::score
firmware/           # depends on scoring/ as today
contracts/          # Solidity: ERC-20, staking, slashing, RewardDistributor, IScorer (generated)
```

`scoring/` stays the single source of truth. `scoring-stylus/` should be a few dozen lines, with no scoring logic in it.

## What the deploy pipeline has to do that a plain Solidity deploy doesn't

1. **Build for `wasm32-unknown-unknown` with a pinned toolchain.** Use `cargo stylus` in its reproducible (Docker) build mode, so anyone, including an operator in a dispute, can rebuild the WASM and confirm that the deployed code hash comes from a given commit of `scoring/`. Publish the commit → code hash mapping, and verify the program on Arbiscan.
2. **Differential tests between targets.** One source is not automatically one behaviour:
   - `wasm32` has a **32-bit `usize`**, and overflow behaviour can differ between debug and release profiles.
   - Run a test corpus (including recorded disputed hours) through the native build, the firmware target, and the WASM running on a local Arbitrum dev node (`nitro-devnode`). Require bit-identical scores.
   - Make overflow behaviour explicit in the crate (`wrapping_`/`checked_`/`saturating_`) instead of leaving it to the build profile.
3. **`cargo stylus check`** runs before deploy. It validates the WASM against Stylus rules (which reject floating-point instructions, so your no-floats design is an advantage here) and checks the compressed size against the program size limit. A 2k-line routine plus ABI glue should fit after `opt-level = "z"`, LTO, `panic = "abort"` and `wasm-opt`. Make this a CI gate, because a dependency bump can push you over the limit.
4. **Two onchain transactions, not one.** First deploy the WASM, then **activate** it through the `ArbWasm` precompile (`activateProgram`, which charges a data fee). Until activation succeeds, any call to the program reverts. `cargo stylus deploy` does both, but a pipeline driven by Foundry/Hardhat scripts has to model it explicitly. Only register the address in `scorerFor[version]` after activation is confirmed.
5. **Reactivation is an ongoing job, not a one-off.** Activated programs expire after a period (currently about a year), and Arbitrum upgrades that bump the Stylus version can require reactivation (`ArbWasm.codehashKeepalive` / re-activate). Add a monitored job that checks the activation status of every scorer version still inside a dispute window, and reactivates it before it lapses. If one lapses, disputes against that version revert.
6. **Gas measurement per release.** Record the gas for `score()` on a worst-case device-hour, and fail CI if it exceeds a threshold set well below the block gas limit, so a dispute can never become too expensive to execute.
7. **Redeploying the existing Solidity** on Arbitrum One uses the same bytecode with a different RPC URL and chain id. Beyond the `block.number` audit above, nothing changes. If the ERC-20 has to exist on L1 too, use Arbitrum's canonical token bridge. Rewards withdrawn to L1 then face the multi-day optimistic exit (three steps: initiate, prove/confirm, finalize). Read the current window from the chain and don't hardcode one.

Before committing, confirm on Arbitrum's current docs that the Stylus limits and activation/expiry parameters are still as described above, and do a full dry run on Arbitrum Sepolia.

## What would have to change for this to be the wrong choice

- **You become willing to maintain a Solidity port** (for example, the routine shrinks to a formula). Then the Stylus premise disappears. Choose the chain on other grounds (where your token's liquidity and users are), and it may be L1 or a different L2.
- **The reward contracts have to live on Ethereum mainnet or another chain** because they compose with liquidity or protocols there. Stylus only exists on Arbitrum (and Orbit chains). Scoring on Arbitrum and paying out elsewhere means a cross-chain message path, with its own trust assumptions and latency, on every dispute.
- **Scoring must be checked for every device-hour, not just disputed ones, or the routine gets much heavier** (longer windows, more sensors, an ML model). At that point direct execution stops fitting in gas/calldata. The better design becomes a **zkVM (SP1, RISC Zero)** proving the same Rust crate off-chain, with one cheap proof verification on any EVM chain. You still keep one implementation, you're no longer tied to Arbitrum, and the cost moves to proving infrastructure.
- **The routine stops being deterministic integer code**: floats, `std` threads, large dynamic memory, or a size that can't be compressed under the program limit. Stylus rejects or can't hold it, so again a zkVM, or a rewrite.
- **Operators need rewards on L1 quickly.** Arbitrum's optimistic exit takes days. A ZK rollup settles faster, but none of them runs your Rust natively, so you'd pay with either a zkVM or a second implementation.
- **The people calling the contract hold no ETH and shouldn't need any**, for example operators on phones paying per dispute. Then gas abstraction becomes the constraint that decides the choice: Celo fee currencies or zkSync native account abstraction. You'd then need the zkVM route to keep a single Rust implementation.
- **Samples have to stay private.** Onchain disputes publish raw samples. Privacy points to proving (zk) instead of re-execution.
