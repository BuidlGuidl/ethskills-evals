# Why 100% coverage missed the deposit shutdown

Line coverage only proves that the test suite executed each line. It does not prove that it exercised the relevant input domain or checked the contract's invariant. Here, the setter accepts every `uint256`, while a usable deposit requires:

```text
0 <= depositFeeBps < BPS_DENOMINATOR
```

The suite tried only small, valid fee values such as 0, 10, and 25 bps. Those values are all in the same equivalence class: each is below 10,000 bps, so `fee <= amount` and `netAmount` remains positive for ordinary deposits. Testing more values from that same class cannot expose the missing upper bound. Event and access-control tests likewise execute the setter but say nothing about whether the stored value is economically or arithmetically valid.

The missing class was boundary and out-of-range input: a fee at or above 10,000 bps (100%). For example, let `amount = 10_000` and set `depositFeeBps = 10_001`:

```text
fee      = (10_000 * 10_001) / 10_000
         = 10_001
netAmount = 10_000 - 10_001
          = -1
```

Because `netAmount` is a `uint256`, Solidity 0.8+ does not produce `-1`; the subtraction reverts with an arithmetic-underflow panic. Thus every positive deposit reverts (ignoring a possible earlier multiplication overflow for extraordinarily large amounts). At the exact boundary, `depositFeeBps = 10_000`:

```text
fee       = amount
netAmount = 0
shares    = convertToShares(0) = 0
```

so the deposit reverts with `NoSharesMinted()` instead. Either boundary can shut the vault to deposits.

Property-based fuzz testing of the owner setter followed by `deposit()` would have caught this. In particular, fuzz `newFeeBps` across the full `uint256` domain and assert the invariant that every accepted configuration is valid and permits a representative positive deposit. The fuzzer would quickly shrink a failure to the 10,000/10,001-bps boundary. An equivalent setter property is that values `>= 10_000` must revert; this leads directly to validating `newFeeBps < BPS_DENOMINATOR` in `setDepositFee`.
