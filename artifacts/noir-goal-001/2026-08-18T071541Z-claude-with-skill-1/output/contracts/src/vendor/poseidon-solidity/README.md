Vendored from the npm package `poseidon-solidity@0.0.5` (only `PoseidonT3.sol` is used).
Vendored rather than `forge install`ed because the upstream GitHub repo is no longer public, so
there is nothing for `forge install` to point at. It lives under `src/vendor/` rather than `lib/`
for the same reason: `lib/` is for dependencies a fresh clone can refetch, and this one cannot be.

`PoseidonT3.hash([a, b])` is the BN254 Poseidon used by `LeanIMT` for parent hashing. It must stay
bit-identical to `poseidon::poseidon::bn254::hash_2` in the circuit and `poseidon2` from
`poseidon-lite` in the offchain tree mirror. `contracts/test/HashParity.t.sol` pins that.
