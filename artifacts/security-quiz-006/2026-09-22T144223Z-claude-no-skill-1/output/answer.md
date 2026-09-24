# Post-mortem: V1 → V2 UUPS upgrade returns shifted values

## Short version

Nothing was lost and nothing was miscomputed. You inserted a new variable at the
**front** of the contract's storage layout. The proxy's storage slots still hold
exactly the bytes they held before the upgrade; V2 simply reads them through a
different set of slot assignments, so every old variable is now read by the
*next* declaration down the list. Deposit data is intact — it is sitting in slot
0 being reported as `rewardIndex()`.

The fix is a second upgrade to a V2 whose layout **appends** `rewardIndex` after
the existing variables instead of prepending it, plus an audit of anything that
*wrote* to storage during the window the bad implementation was live.

## Why every value is shifted

A proxy holds the storage; the implementation holds only the code that decides
*which slot number* a name refers to. Solidity assigns slots in declaration
order, starting at 0. There is no name in the storage — the name→slot mapping is
baked into the bytecode at compile time and is re-derived from scratch for every
new implementation you deploy.

V1 compiled to:

| slot | V1 name          | value stored in the proxy                      |
|-----:|------------------|------------------------------------------------|
| 0    | `totalDeposited` | `2_000_000_000000` (`0x1d1a94a2000`)           |
| 1    | `treasury`       | `0xC0FFEE0000000000000000000000000000000000`   |
| 2    | `feeBps`         | `500` (`0x1f4`)                                |
| 3    | —                | never written → `0`                            |

V2 compiled to:

| slot | V2 name          | reads the bytes that V1 wrote as… |
|-----:|------------------|-----------------------------------|
| 0    | `rewardIndex`    | `totalDeposited`                  |
| 1    | `totalDeposited` | `treasury`                        |
| 2    | `treasury`       | `feeBps`                          |
| 3    | `feeBps`         | (nothing)                         |

That reproduces your four observations exactly:

- `rewardIndex() -> 2000000000000` — it is your USDC total, read out of slot 0.
  You "never set it" because the deposit accounting set it, under its old name.
- `totalDeposited() -> ` a huge number whose hex is your treasury address — an
  `address` is a 160-bit value left-padded into the 256-bit slot, so reading it
  as `uint256` yields `0xC0FFEE…0000` = `1101833650747854256492557129184819199699562004480`.
- `treasury() -> 0x00000000000000000000000000000000000001F4` — slot 2 holds
  `500`; reading a `uint256` as an `address` truncates to the low 20 bytes, and
  `500 == 0x1F4`.
- `feeBps() -> 0` — slot 3 was never written by V1, so it is the zero default.

Nothing reverts because the EVM has no type information at rest. `SLOAD` returns
32 bytes; the compiler's only job is deciding which 32 bytes and how to
interpret them. A wrong interpretation is silently valid.

Two related notes:

- The upgrade transaction "succeeding" proves only that `_authorizeUpgrade`
  passed and the new implementation address was written to the ERC-1967 slot
  (`0x360894…bbc`). That slot is a fixed, hash-derived location precisely so it
  can never collide with sequential variable slots — which is why the proxy
  admin and implementation pointer are fine while your business state is not.
- No re-initializer would have helped, and adding one now would make things
  worse: an initializer that "sets" `rewardIndex = 0` writes slot 0 and would
  have zeroed your `totalDeposited` for real. You got lucky that you skipped it.

## Is the deposit data gone?

No — provided nothing wrote to storage while V2 was live. Every slot still holds
its original bytes. Re-pointing the proxy at a correctly-laid-out
implementation makes all four values read correctly again, with no data
migration.

**But you must check for writes made during the window.** Any state-changing
call executed under bad-V2 wrote to the shifted slot, and those writes *are*
destructive. Concretely, for the window between the upgrade tx and the fix:

| call made under bad V2         | slot written | what it actually clobbered |
|--------------------------------|-------------:|----------------------------|
| anything updating `totalDeposited` (deposit/withdraw) | 1 | your **treasury address** |
| anything setting `treasury`    | 2 | your **feeBps** |
| anything setting `feeBps`      | 3 | a slot that becomes **`rewardIndex`** in the fixed layout |
| anything setting `rewardIndex` | 0 | your **`totalDeposited`** ← worst case |

Before upgrading again:

1. Pull all transactions to the proxy since the upgrade (`cast run` / an
   explorer / `eth_getLogs` for your events) and classify them against the table
   above.
2. Snapshot the raw slots now, at a pinned block, so you have ground truth:
   `cast storage <proxy> 0 --rpc-url … ` for slots 0–3 (and the ERC-1967 slots
   `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` for the
   implementation and `0xb531277…103` for the admin, if applicable).
3. Compare slot 0 against your off-chain/event-derived expected
   `totalDeposited`, and slot 1 against the known treasury address
   `0xC0FFEE…`. If deposits happened in the window, slot 1 is no longer an
   address and slot 0 is stale — you then need a one-off repair
   re-initializer, not just a layout fix.
4. If you are still exposed, pause the contract (or upgrade to a pause-only
   implementation) *before* doing anything else, so the window stops growing.

Also note slot 3: in the fixed layout it becomes `rewardIndex`. If any
`setFeeBps`-style call landed there, `rewardIndex` will start life non-zero.
Verify it is `0` (or whatever you intend) and zero it explicitly in the repair
step if not.

## The fix

### 1. Append, never prepend or reorder

```solidity
contract StakingV2 is StakingV1Storage, UUPSUpgradeable {
    uint256 public totalDeposited; // slot 0 — unchanged
    address public treasury;       // slot 1 — unchanged
    uint256 public feeBps;         // slot 2 — unchanged
    uint256 public rewardIndex;    // slot 3 — NEW, appended
}
```

The rule for inherited-storage upgradeable contracts: new variables go at the
end, existing variables never move, never change type or size, and are never
deleted (retire them by renaming to `uint256 private __deprecated_foo;` so the
slot stays reserved). The same rule applies to the *inheritance order* of base
contracts, since bases are laid out before the derived contract's own variables
— adding a new base with storage in front of an existing one shifts everything
just as badly.

Deploy this as V2b and `upgradeToAndCall(v2b, "")`. No re-initializer, no
migration: slots 0–2 read correctly again the moment the implementation pointer
changes.

### 2. Reserve room in base contracts

If `rewardIndex` conceptually belongs to a shared base rather than the leaf
contract, appending to the leaf is still the safe move. To keep the option of
growing a base later, give each upgradeable base a trailing gap:

```solidity
uint256[50] private __gap;
```

and shrink the gap by exactly the number of slots you consume when you add a
variable (`__gap[50] → __gap[49]` for one new `uint256`). A gap you forget to
shrink is the same bug as today's, one level down.

### 3. Prefer namespaced storage (ERC-7201) going forward

The structural fix that makes this class of bug impossible is to stop relying on
sequential slots at all. OpenZeppelin v5 uses ERC-7201 namespaced layouts:

```solidity
/// @custom:storage-location erc7201:acme.storage.Staking
struct StakingStorage {
    uint256 totalDeposited;
    address treasury;
    uint256 feeBps;
    uint256 rewardIndex; // still append within the struct
}

// keccak256(abi.encode(uint256(keccak256("acme.storage.Staking")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant STAKING_STORAGE_LOCATION = 0x...;

function _s() private pure returns (StakingStorage storage $) {
    assembly { $.slot := STAKING_STORAGE_LOCATION }
}
```

The struct sits at a hash-derived base slot, so each contract's storage is
isolated from inheritance order and from other modules. You still append within
the struct, but you can never collide with a base or with the ERC-1967 slots.

### 4. Make the CI catch it, not the mainnet

This is a fully mechanical, statically detectable bug. Put a layout check in the
deploy path so a human never has to notice it:

- `@openzeppelin/hardhat-upgrades` / `openzeppelin-foundry-upgrades`:
  `upgradeProxy(proxy, V2)` validates the new layout against the stored one and
  **refuses to deploy** on an incompatible change. Keep the generated
  `.openzeppelin/mainnet.json` manifest in version control — it is the record of
  the deployed layout that the check compares against.
- Or diff layouts directly in CI: `forge inspect StakingV1 storageLayout` vs
  `forge inspect StakingV2 storageLayout`, and fail if any pre-existing
  `(label, slot, offset, type)` tuple changed.
- Rehearse every upgrade against a mainnet fork and assert post-upgrade reads
  equal pre-upgrade reads for all existing getters. That single assertion would
  have caught this in seconds.
- Use `upgradeToAndCall` with a `reinitializer(N)`-guarded function for genuine
  migrations only, and make sure the implementation itself calls
  `_disableInitializers()` in its constructor so nobody can initialize the logic
  contract directly.

## Summary

| question | answer |
|---|---|
| Why shifted? | `rewardIndex` was declared first, pushing every existing variable one slot down in V2's compile-time name→slot map, while the proxy's bytes stayed put. |
| Why no revert? | Storage is untyped at rest; a misinterpreted `SLOAD` is indistinguishable from a correct one. |
| Data gone? | No — all bytes intact, assuming no state-changing calls ran during the window. Audit that window; writes there are genuinely destructive. |
| Fix | Upgrade again to a V2 that appends `rewardIndex` after `feeBps`; add `__gap`s or move to ERC-7201; enforce layout compatibility in CI. |
