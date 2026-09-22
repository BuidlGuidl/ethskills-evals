# Post-mortem: V1 → V2 UUPS upgrade returned shifted values

## Summary

Nothing was corrupted, overwritten, or lost. You inserted `rewardIndex` at the
**front** of the state declarations instead of appending it at the end. A proxy's
storage lives in the proxy, and slot assignment is decided purely by *declaration
order in the implementation source* — so V2 re-labelled the existing slots and
every getter now reads its neighbour's data, off by one slot.

The USDC is still in the contract. The accounting numbers are still in storage,
just under the wrong names. This is recoverable without touching funds.

## Why the values are shifted

The proxy holds storage; the implementation holds only code. When the proxy
`delegatecall`s into the implementation, the implementation's code executes
against the **proxy's** storage. Solidity assigns slot numbers at compile time
by walking the state variable declarations in order — slot 0, 1, 2, ... It does
not store names, types, or any layout metadata onchain. There is nothing at
runtime to detect a mismatch, which is exactly why no call reverted.

Slots as V1 wrote them, vs. how V2's code now interprets the same bytes:

| Slot | Bytes actually stored (written by V1) | V1 name | V2 name | V2 reads |
|------|---------------------------------------|---------|---------|----------|
| 0 | `0x...01D1A94A2000` (2_000_000_000000) | `totalDeposited` | `rewardIndex` | 2000000000000 |
| 1 | `0x...C0FFEE0000000000000000000000000000000000` | `treasury` | `totalDeposited` | the address, read as uint256 |
| 2 | `0x...01F4` (500) | `feeBps` | `treasury` | `0x...01F4`, read as address |
| 3 | never written — zero | — | `feeBps` | 0 |

That reproduces your four observations exactly:

- `rewardIndex() -> 2000000000000` — this is your old `totalDeposited`
  (2,000,000 USDC at 6 decimals = 2_000_000_000000 base units). You never set
  `rewardIndex`; it is reading slot 0, which deposits wrote.
- `totalDeposited()` returns a huge number whose hex form *is* the treasury
  address, because a 20-byte address zero-extended into a 32-byte slot and
  reinterpreted as `uint256` is a ~2^155-scale integer.
- `treasury() -> 0x00000000000000000000000000000000000001F4` — that is decimal
  500, your `feeBps`, reinterpreted as an address. `0x1F4 == 500`.
- `feeBps() -> 0` — slot 3 was never written by V1, so it is the zero default.

The shift is by exactly one slot because each of these types occupies a full
slot: `uint256` is 32 bytes, and `address` (20 bytes) is followed by a `uint256`,
so no packing occurs to complicate the picture. Inserting one 32-byte variable at
the head pushed every subsequent variable down by one.

The real danger: this is not read-only breakage. Any V2 function that writes
`feeBps` now writes slot 3 (harmless), but a function that writes `treasury`
writes slot 2 — clobbering the real `feeBps` — and a reward accrual that writes
`rewardIndex` writes slot 0, **destroying your real `totalDeposited`**. Every
write since the upgrade has been landing in the wrong place.

## Is the deposit data gone?

Not yet, provided no V2 transaction has written to `rewardIndex` (slot 0) since
the upgrade. Verify this directly against mainnet before doing anything else:

```bash
cast storage <PROXY> 0 --rpc-url $RPC   # expect 0x...01d1a94a2000 (2_000_000_000000)
cast storage <PROXY> 1 --rpc-url $RPC   # expect 0x...c0ffee00...00
cast storage <PROXY> 2 --rpc-url $RPC   # expect 0x...01f4 (500)
cast storage <PROXY> 3 --rpc-url $RPC   # expect 0x0 (never written)
```

Also read slot 0 at the block immediately **before** the upgrade and compare. If
they match, nothing has been lost and the fix below is purely a re-labelling. If
slot 0 has drifted, you must reconstruct `totalDeposited` from the `Deposit` /
`Withdraw` event history and from the proxy's actual USDC balance
(`IERC20(USDC).balanceOf(proxy)`), and restore it in the re-initializer.

Independently, confirm the funds themselves: `balanceOf(proxy)` is unaffected by
any of this — token balances live in the USDC contract's storage, keyed by the
proxy address, and no storage-layout mistake in your contract can move them.

Freeze the contract now (pause deposits/withdrawals, or at minimum stop any
keeper that calls a reward-accrual function) until V3 is live, so no further
writes land on the wrong slots.

## The fix

### V3: append, never insert

```solidity
contract StakingV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // --- V1 layout, byte-for-byte unchanged, in the original order ---
    uint256 public totalDeposited;  // slot 0
    address public treasury;        // slot 1
    uint256 public feeBps;          // slot 2

    // --- appended in V3 ---
    uint256 public rewardIndex;     // slot 3

    // Reserve room so future versions can append without colliding with
    // anything a child contract or later version adds.
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initializeV3(uint256 initialRewardIndex) public reinitializer(3) {
        rewardIndex = initialRewardIndex;   // e.g. 1e18 for a 1.0 starting index
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

Slot 3 already holds zero, so `rewardIndex` starts clean — but set it explicitly
in the re-initializer anyway if your accrual math needs a non-zero base (an index
starting at 0 rather than 1e18 will make the first accrual compute a nonsensical
ratio).

Guard the re-initializer with `reinitializer(n)` rather than `initializer`: the
plain `initializer` modifier will revert on an already-initialized proxy, and
leaving the function unguarded lets anyone call it and reset your index.

Note the rule generalizes beyond appending: you also must not **reorder**,
**remove**, **change the type of**, or **shrink** an existing variable, and you
must not insert into the middle of an inherited base contract's storage either —
base-contract variables are laid out before the child's, so adding a variable to
a shared base shifts every derived contract's slots the same way.

### Make this impossible to repeat

1. **Deploy through the OpenZeppelin Upgrades plugin**, not a raw
   `upgradeToAndCall`. `@openzeppelin/hardhat-upgrades` or
   `openzeppelin-foundry-upgrades` stores the V1 layout in a manifest and
   **refuses to deploy** an implementation that reorders or inserts storage. It
   would have rejected your V2 before it ever reached mainnet. This is the single
   change that would have prevented the incident.

   ```js
   // hardhat
   await upgrades.upgradeProxy(proxy, StakingV3, {
     call: { fn: 'initializeV3', args: [ethers.parseUnits('1', 18)] },
   }); // throws on any incompatible layout change
   ```

2. **Diff the layout in CI** as a second, plugin-independent check:

   ```bash
   forge inspect StakingV1 storage-layout > layout.v1.json
   forge inspect StakingV3 storage-layout > layout.v3.json
   # fail the build if any pre-existing (label, slot, offset, type) tuple moved
   ```

3. **Consider ERC-7201 namespaced storage** for future features. Each module
   stores its state in a struct at a hashed, collision-resistant slot instead of
   sequential slots 0,1,2 — so adding a field to one namespace cannot shift
   another. Worth adopting when you next restructure; not required to fix this.

4. **Fork-test every upgrade before mainnet.** Fork mainnet at head, run the
   upgrade against the real proxy, and assert the post-upgrade reads equal the
   pre-upgrade reads:

   ```solidity
   uint256 before = staking.totalDeposited();
   address treasuryBefore = staking.treasury();
   _upgradeTo(address(new StakingV3()));
   assertEq(staking.totalDeposited(), before);
   assertEq(staking.treasury(), treasuryBefore);
   assertEq(staking.feeBps(), 500);
   ```

   A three-line assertion on a mainnet fork catches every layout bug of this
   class, including ones the plugin's static check might miss.

5. **Move upgrade authority to a multisig behind a timelock** if it is not there
   already. A timelock delay gives you and your users a window to run the reads
   above against the queued implementation before it goes live — a bad upgrade
   becomes a cancellable proposal rather than a mainnet incident.

## Order of operations

1. Pause / halt keepers so nothing else writes to the shifted slots.
2. `cast storage` slots 0–3 and compare against the pre-upgrade block; confirm
   `balanceOf(proxy)` is intact.
3. Write V3 with the original V1 order plus `rewardIndex` appended, and a
   `reinitializer(3)`.
4. Fork-test the V2 → V3 upgrade against the live proxy with the equality
   assertions above.
5. Upgrade via the OZ plugin (it will now validate the layout against V1).
6. Re-read all four getters on mainnet, confirm the expected values, then unpause.
7. Add the CI layout diff so the next V4 cannot reintroduce this.
