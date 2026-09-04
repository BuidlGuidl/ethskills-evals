# Vendored Solidity dependencies

Copied verbatim, not modified:

| Path | Source | Why vendored |
| --- | --- | --- |
| `vendor/lean-imt/` | npm `@zk-kit/lean-imt.sol@2.0.1` | forge's remapping resolver mangles paths whose directory name ends in `.sol` (`@zk-kit/lean-imt.sol/`), so it cannot be consumed from `node_modules` |
| `vendor/poseidon-solidity/` | npm `poseidon-solidity@0.0.5` | kept next to lean-imt so `forge build` needs no `npm install` |

`InternalLeanIMT` hashes with `PoseidonT3`, which must stay bit-identical to
`poseidon::poseidon::bn254::hash_2` in the circuit and `poseidon2` from
`poseidon-lite` in the client. `test/HashParity.t.sol` asserts that.

Only `InternalLeanIMT.sol` (an `internal` library, inlined) and `Constants.sol`
are copied — the `LeanIMT.sol` `public` wrapper is unused.

They live in `vendor/` rather than `lib/` because `lib/` holds dependencies
`forge install` can restore (`./scripts/setup.sh`), and these two cannot.
