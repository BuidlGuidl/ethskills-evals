# Post-mortem: V1 → V2 UUPS upgrade, every value reads shifted by one slot

## TL;DR

You prepended `rewardIndex` to the state declarations. Under a proxy, storage
slots are assigned by *declaration order*, and the proxy's storage is never
migrated by an upgrade — so every variable in V2 is pointing one slot lower than
the data it names. **No data was lost.** All three original values are still
sitting in slots 0, 1 and 2 exactly as V1 left them; V2 is just reading them
through the wrong names. The fix is to redeploy an implementation that appends
`rewardIndex` at the end instead of the front — *provided* nothing has written
to storage since the upgrade. That proviso is the dangerous part and is
addressed below.

---

## 1. Why the values are shifted

A UUPS proxy holds all the state. `upgradeToAndCall` only overwrites the ERC-1967
implementation slot (`0x360894...bbc`, a keccak-derived slot that deliberately
lives nowhere near slot 0). It copies nothing, moves nothing, and zeroes nothing.
The proxy then `delegatecall`s V2's code against the *V1 storage image*.

Solidity assigns slots to a contract's own state variables sequentially from slot
0 in declaration order. Both versions declare `uint256`, `address`, `uint256`
(and a fourth `uint256` in V2) — none of which pack together, since a `uint256`
always starts a fresh slot and the `address` is followed by a `uint256`. So each
variable occupies one whole slot:

| Slot | Value actually stored (written by V1) | V1's name | V2's name |
|------|---------------------------------------|-----------|-----------|
| 0 | `0x0000…01D1A94A2000` = 2_000_000_000000 | `totalDeposited` | `rewardIndex` |
| 1 | `0x000…000C0FFEE0000000000000000000000000000000` | `treasury` | `totalDeposited` |
| 2 | `0x0000…0000_01F4` = 500 | `feeBps` | `treasury` |
| 3 | never written → `0x00…00` | — | `feeBps` |

Read that table against your observed output and every line matches exactly:

- `rewardIndex()` → `2000000000000`. That is your 2,000,000 USDC in 6-decimal
  base units, read out of slot 0. You never "set" it; you're reading the deposit
  total under a new name.
- `totalDeposited()` → a huge number whose hex is your old treasury address.
  Slot 1 holds a 20-byte address left-padded into 32 bytes; interpreted as a
  `uint256` that is ~1.1 × 10^57. Solidity does no type checking across an
  upgrade — the slot is just 32 bytes, and the getter's return type decides how
  those bytes are printed.
- `treasury()` → `0x…01F4`. `0x1F4` = 500 = your `feeBps`. Slot 2 held the number
  500; the `address` getter masks to the low 20 bytes and formats it as an
  address, so 500 becomes an address that looks like a checksum typo.
- `feeBps()` → `0`. Slot 3 was never touched by V1, so it reads as zero — which
  is also why V2 needed no re-initializer to "work": uninitialized storage in the
  EVM is zero, not an error.

Nothing reverts because nothing is *invalid* at the EVM level. A slot is 32 bytes
of opaque data; every read succeeds, it is only the *meaning* that is wrong. This
is the defining hazard of proxy upgrades: storage-layout bugs fail silently and
keep serving traffic. A layout mismatch is a `delegatecall` whose caller and
callee disagree about where variables live — the same class of bug as
delegatecalling into a contract with an incompatible layout, just self-inflicted.

The admin and implementation addresses look fine for the same reason: ERC-1967
puts them at `keccak256("eip1967.proxy.implementation") - 1` and the equivalent
admin slot, precisely so that sequential slots 0, 1, 2… from the implementation
can never collide with them. The proxy's own bookkeeping is intact; only your
application state is misaligned.

## 2. Is the deposit data gone?

**Not gone — but it is at active risk right now, and possibly already damaged.**

The 2,000,000 USDC figure is intact in slot 0, the treasury address in slot 1,
the fee in slot 2. The accounting number and the real USDC balance held by the
proxy are two different things: the ERC-20 balance lives in USDC's own contract,
keyed by your proxy address, and is completely unaffected by any of this.

The danger is that V2 has been live and writable. Every write through V2 lands in
the shifted slot and **destroys** the original value there:

- Any `deposit()` doing `totalDeposited += amount` writes to **slot 1**,
  overwriting your treasury address with `0xC0FFEE…0000 + amount`. That is the
  irreversible loss case, and a subsequent fee payout would send funds to an
  address derived from your treasury plus a deposit amount — an address nobody
  controls.
- Any `setFeeBps()` writes to **slot 3**, which is harmless to old data but means
  the "real" fee at slot 2 is still 500 while the contract believes it is
  something else.
- Any `setTreasury()` writes to **slot 2**, replacing `feeBps` with an address
  cast down — so `feeBps` (once realigned) becomes an absurd number, and fee math
  `amount * feeBps / 10_000` would compute a fee larger than the principal.
- If V2 added a `rewardIndex` accrual that writes slot 0, it is overwriting
  `totalDeposited` directly.

### Do this first, before anything else

1. **Pause the contract, or upgrade immediately to a minimal implementation whose
   only mutating function is `_authorizeUpgrade`.** Stop all writes. Every
   additional transaction can convert a recoverable mislabelling into permanent
   data loss.
2. **Read the raw slots**, not the getters — the getters are exactly what is
   lying to you:
   ```bash
   cast storage $PROXY 0 --rpc-url $RPC   # expect 0x…01D1A94A2000  (2e12)
   cast storage $PROXY 1 --rpc-url $RPC   # expect 0x…C0FFEE00…00   (treasury)
   cast storage $PROXY 2 --rpc-url $RPC   # expect 0x…01F4          (500)
   cast storage $PROXY 3 --rpc-url $RPC   # expect 0x00…00
   ```
   Compare each against the value at the block immediately *before* the upgrade
   (`cast storage $PROXY N --block <preUpgradeBlock>`). If all four match, no
   corrupting write has happened and a straight relayout restores everything.
3. **Audit the post-upgrade transactions** to the proxy (`cast logs` / an explorer
   trace) to confirm which state-changing functions were actually called. Do not
   rely on the assumption that nobody deposited; verify it. If slot 1 no longer
   equals the old treasury address, subtract the sum of post-upgrade deposits
   from it to recover the original — the arithmetic is reconstructible from the
   event log — and hardcode the correct value into a repair re-initializer.
4. Confirm the proxy's actual USDC balance (`IERC20(USDC).balanceOf(proxy)`)
   against slot 0. Those are your two independent sources of truth for solvency.

## 3. The fix: append, never prepend

Storage layout for an upgradeable contract is an append-only ledger. You may add
variables at the end. You may never insert, reorder, remove, or change the type
or size of an existing one. `rewardIndex` was appended in the *source file* sense
of "it's the new feature", but prepended in the *layout* sense, and layout is all
the EVM sees.

### V3 — the corrected implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract StakingV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // ---- V1 layout. Frozen forever. Do not touch these three lines. ----
    uint256 public totalDeposited;  // slot 0
    address public treasury;        // slot 1
    uint256 public feeBps;          // slot 2

    // ---- Added in V3. Appended, so it takes slot 3 (never written by V1). ----
    uint256 public rewardIndex;     // slot 3

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// V1's initializer; still here so the layout/initializer history is explicit.
    function initialize(address owner_, address treasury_, uint256 feeBps_)
        public
        initializer
    {
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
        require(treasury_ != address(0), "zero treasury");
        require(feeBps_ <= 10_000, "fee > 100%");
        treasury = treasury_;
        feeBps = feeBps_;
    }

    /// Runs once, during the V2 -> V3 upgrade, via upgradeToAndCall.
    /// Only needed because rewardIndex must start at a non-zero base.
    function initializeV3(uint256 startingIndex) public reinitializer(3) {
        rewardIndex = startingIndex; // e.g. 1e18 if you use 1e18 as "1.0"
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

Notes on that code:

- `rewardIndex` sits at slot 3, which V1 never wrote and which therefore reads as
  0 — exactly the "fresh variable" semantics you expected.
- The `reinitializer(3)` is what you were missing conceptually. You were right
  that a *no-op* new variable needs no re-initializer: zero is a valid starting
  value and the slot is already zero. But if `rewardIndex` is a multiplicative
  index, zero is catastrophic — a reward calculation like
  `earned = stake * (rewardIndex - userIndex) / 1e18` silently pays nothing, or
  underflows and reverts, if the index starts at 0 instead of `1e18`. Decide
  which your design needs and set it explicitly rather than inheriting whatever
  the EVM's default happens to be. Bump the `reinitializer` number on every
  future upgrade that needs a one-time setup step; never reuse a number.
- Call it atomically with the upgrade so there is no window where V3 is live with
  an unset index:
  `proxy.upgradeToAndCall(v3, abi.encodeCall(StakingV3.initializeV3, (1e18)))`.
- If your investigation in §2 found that slot 1 or slot 2 was corrupted by a
  post-upgrade write, add the repair to `initializeV3` — e.g.
  `treasury = 0xC0FFEE…; feeBps = 500;` with the values you recovered from the
  pre-upgrade block — so the fix and the restore land in one transaction.

### Reserve space so this can't recur

Two standard defences; use either, and prefer the second for new work.

**Storage gap** — reserve trailing slots up front so future variables consume the
gap rather than shifting anything:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
uint256[46] private __gap;  // shrink by exactly 1 for each uint256 you add
```

The discipline is that adding a variable must be paired with decrementing the gap
size in the same commit, keeping the total slot count constant. That matters for
inherited contracts especially: a base contract growing by one slot would
otherwise shift every child's variables.

**ERC-7201 namespaced storage** — the modern approach, and immune to this entire
bug class because the struct lives at a keccak-derived slot that cannot collide
with anything, and declaration order within the file becomes irrelevant to the
base offset:

```solidity
/// @custom:storage-location erc7201:staking.main
struct MainStorage {
    uint256 totalDeposited;
    address treasury;
    uint256 feeBps;
    uint256 rewardIndex;   // appending to the struct is still append-only
}

// keccak256(abi.encode(uint256(keccak256("staking.main")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant MAIN_STORAGE_LOCATION = 0x...;

function _s() private pure returns (MainStorage storage $) {
    assembly { $.slot := MAIN_STORAGE_LOCATION }
}
```

You still append fields within the struct rather than reordering them, but
different modules no longer share a slot numbering space at all. This is what
OpenZeppelin v5's own upgradeable contracts use.

### Make the tooling refuse the bad upgrade

This failure is fully mechanically detectable, and should never have reached
mainnet. Wire the check into CI so a prepended variable fails the build:

```bash
npm i -D @openzeppelin/upgrades-core   # or the hardhat/foundry plugin
```

```js
// Hardhat: validates the new layout against the deployed one, and throws.
await upgrades.validateUpgrade(PROXY_ADDRESS, StakingV3);
await upgrades.upgradeProxy(PROXY_ADDRESS, StakingV3);
```

For Foundry, `openzeppelin-foundry-upgrades`' `Upgrades.upgradeProxy` runs the
same validation, and `forge inspect StakingV3 storage-layout` gives you the raw
table to diff by hand. Commit the V1 layout JSON to the repo and diff every
candidate implementation against it in CI — that diff is the single check that
would have caught this.

Finally, before the V3 upgrade goes out: fork mainnet at head, run the upgrade
against the *real* proxy state, and assert the getters return
`totalDeposited == 2_000_000_000000`, `treasury == 0xC0FFEE…`, `feeBps == 500`,
`rewardIndex == <your chosen start>`. A fork test that reads post-upgrade state
is the only test that would have failed on V2, since every unit test against a
freshly-initialized V2 proxy passes perfectly — the bug only exists in the
presence of pre-existing storage.

## 4. Related things worth fixing while you're in here

- **Upgrade authority.** Confirm `_authorizeUpgrade` is gated to a multisig or
  timelock, not an EOA. An upgrade that can silently reinterpret all of the
  protocol's storage — as this incident demonstrates concretely — is too much
  power for one key. A timelock would also have given observers a window to spot
  the layout change before it landed.
- **Decimals.** `totalDeposited` is in USDC's 6 decimals. If `rewardIndex` is an
  18-decimal fixed-point value, every expression mixing the two needs an explicit
  `* 1e12` normalisation. Given that this incident began with a 6-decimal number
  showing up where an 18-decimal one was expected, make the units part of the
  variable names or document them at the declaration.
- **Fee math.** `feeBps` reading 0 meant fees silently stopped being charged
  rather than reverting; confirm whether any fee-bearing operations ran during
  the window and whether the treasury is owed a reconciliation. Keep the
  multiply-before-divide form `(amount * feeBps) / 10_000` and bound `feeBps` at
  `<= 10_000` in the setter.
- **Events.** If the upgrade path had emitted events carrying the post-upgrade
  values of the key state variables, your monitoring would have caught this in
  the same block rather than after a day. Add an invariant monitor that alerts
  when `totalDeposited` diverges from `IERC20(USDC).balanceOf(proxy)` by more
  than expected.
