Deploy on Arbitrum One and put the scoring routine in an Arbitrum Stylus
contract. The reward contracts and scorer should live on the same Arbitrum
chain, because the Solidity reward contract needs to call the scorer
synchronously during reward settlement.

That is the clean fit because your hard requirement is not just "cheap onchain
compute"; it is "do not maintain another implementation of the scorer." Stylus
lets you ship Rust smart contracts compiled to WASM, while your existing
Solidity reward, token, staking, and slashing contracts remain normal EVM
contracts. Solidity and Stylus contracts can call each other through ordinary
ABI calls, so the scoring code can live in Rust without forcing the rest of the
protocol out of Solidity.

The onchain split should look like this:

- Keep the ERC-20, staking, slashing, reward accounting, operator registry, and
  access control in Solidity.
- Move the deterministic scoring function into a Rust `scoring-core` crate that
  is shared by firmware, offchain simulation, tests, and the Stylus contract.
- Wrap that crate in a thin Stylus contract, for example `ScoringEngine`, whose
  public ABI is intentionally small:
  - `score(bytes samples, ScoringConfig config) returns (uint256 score)` for
    pure evaluation, or
  - `scoreHour(deviceId, hour, bytes samples, bytes signature) returns
    (uint256 score)` if signature checking and canonical input validation should
    live beside scoring.
- The Solidity reward contract stores the active scoring engine address and a
  scoring version/config hash. When a measurement bundle is submitted, it
  verifies the device/operator eligibility, calls `IScoringEngine.score(...)`,
  then computes rewards, slashing exposure, and events from the returned score.
- Devices and operators can call the same scorer with `eth_call` before or
  after submission to reproduce the score without sending a transaction.
- Do not store raw samples unless you truly need them later. Put the raw samples
  in calldata, store or emit the sample hash, score, device, hour, scoring
  version, and reward result. That gives operators a reproducible audit trail
  without turning your reward contract into a data warehouse.

The Solidity side should treat the scorer as a versioned pure dependency, not
as the owner of protocol economics. A typical entry point is:

```solidity
interface IScoringEngine {
    function score(bytes calldata samples, bytes32 configHash)
        external
        view
        returns (uint256);
}

function submitHour(
    bytes32 deviceId,
    uint64 hour,
    bytes calldata samples,
    bytes calldata deviceSignature
) external {
    _verifyDeviceSignature(deviceId, hour, samples, deviceSignature);
    _checkNotAlreadySubmitted(deviceId, hour);

    uint256 quality = scoringEngine.score(samples, activeConfigHash);

    uint256 reward = _rewardFor(deviceId, hour, quality);
    _record(deviceId, hour, keccak256(samples), quality, reward);
    token.transfer(_operatorOf(deviceId), reward);
}
```

In practice I would usually put signature verification in Solidity unless the
signature format is already Rust-only or computationally heavy. Keep the Rust
contract focused on the disputed thing: "given these bytes and this config,
what score is correct?" That makes upgrades and audits easier.

The deploy pipeline has extra steps that a plain Solidity deploy does not:

- Build the Rust scorer for Stylus/WASM with a pinned Rust toolchain, pinned
  dependencies, and deterministic release flags. The firmware and onchain
  wrapper should both depend on the same `scoring-core` crate.
- Run the existing Rust test corpus against `scoring-core`, then run Stylus
  contract tests against the wrapper. Include golden vectors from real device
  hours and assert byte-for-byte identical scores across firmware/offchain and
  Stylus builds.
- Run `cargo stylus check` in CI. This compiles the WASM and runs Stylus
  activation checks before you try to deploy.
- Export the Solidity ABI from the Stylus contract with `cargo stylus
  export-abi`, commit or package that generated interface, and use it from the
  Solidity reward contract/tests.
- Deploy the Stylus scorer with `cargo stylus deploy`, which posts the WASM and
  activates it. Activation is the extra lifecycle step: a Stylus contract is not
  callable until the WASM has passed activation.
- Deploy or upgrade the Solidity reward contract with the activated scorer
  address, scoring version, and config hash.
- Verify both sides: verify the Solidity contracts as usual, and verify the
  Stylus deployment/WASM with the Stylus tooling. Publish the scorer crate
  commit, WASM hash, ABI, config hash, and golden-vector results as release
  artifacts.
- Add an operations job for Stylus reactivation/keepalive. Current Arbitrum
  docs describe Stylus contracts as needing periodic reactivation, so this
  should be monitored like certificate expiry, not remembered by a human.

This recommendation would be wrong if the product changes in one of these
ways:

- The raw hourly sample payloads become large enough, or the scorer becomes
  expensive enough, that putting every sample through onchain calldata/execution
  is the dominant cost. Then I would move scoring offchain and put a zkVM proof
  verifier onchain, using the same Rust code inside something like SP1 or RISC
  Zero instead of executing the full scorer onchain every hour.
- The scoring result no longer needs to be recomputed by every device/operator;
  for example, disputes become rare and a challenge game is acceptable. Then an
  optimistic submit/challenge design is cheaper than scoring every report
  eagerly.
- The reward system must stay on a non-Arbitrum chain for liquidity,
  governance, compliance, or existing user custody reasons. Stylus is the reason
  to pick Arbitrum here; without it, a standard EVM L2 would push you back
  toward a second Solidity implementation or a proof-verifier architecture.
- The scoring code stops being deterministic, fixed-point, and bounded. If it
  needs floating point, network/file access, huge memory, nondeterministic
  libraries, or unbounded loops, it is no longer a good onchain execution
  target.
- Storage writes, not computation, become the bottleneck. Stylus helps most on
  compute-heavy work; it does not make large persistent storage cheap.
- You need fast L1 withdrawal finality as a core product property. Arbitrum One
  is an optimistic rollup, so canonical L2-to-L1 withdrawals inherit the
  challenge window. That usually does not matter for hourly DePIN rewards paid
  on the L2, but it would matter if operators must regularly exit rewards to L1
  without using a fast bridge.

So the short version is: Arbitrum One for production, Stylus for the Rust
scoring engine, Solidity for the protocol economics, calldata for raw hourly
samples, hashes/events for auditability, and a deploy pipeline that treats the
WASM scorer as a first-class artifact alongside the Solidity contracts.

References checked:

- Arbitrum Stylus introduction:
  https://docs.arbitrum.io/stylus/gentle-introduction
- Arbitrum Stylus quickstart and deployment flow:
  https://docs.arbitrum.io/stylus/quickstart
