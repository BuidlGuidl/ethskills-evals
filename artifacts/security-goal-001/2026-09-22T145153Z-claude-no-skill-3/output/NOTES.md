# Save-any-token vaults — operator notes

Two contracts:

- `src/SaveVaultFactory.sol` — permissionless registry, one canonical vault per ERC-20,
  deployed with CREATE2 salted by the asset address.
- `src/SaveVault.sol` — the vault itself. ERC-4626 compatible. The vault *is* the receipt
  token: shares are a transferable ERC-20 (with `permit`) that you can move or use elsewhere.

There is no owner, no pause, no upgrade path, no fee switch and no rescue function anywhere.
With permissionless listing, an admin key over thousands of vaults is a bigger risk than the
edge cases it could unstick. Everything below follows from that.

## How a depositor's claim is computed

A vault holds one asset. `totalAssets()` is the vault's own balance of that asset, minus the
part of recently-arrived yield that has not vested yet (see below). Shares are a claim on that
pool:

```
shares_minted   = assets_in  * (totalSupply + 10**6) / (totalAssets + 1)      // rounded down
assets_returned = shares_out * (totalAssets + 1) / (totalSupply + 10**6)      // rounded down
```

Your claim is `yourShares / totalSupply` of `totalAssets()`. Nothing is written per-depositor;
a keeper transfer raises `totalAssets()`, which raises everyone's claim at once and leaves
share balances untouched. That is what makes the receipt token freely transferable — it carries
the whole claim with it.

The `+1` asset and `+10**6` shares are virtual — they do not exist, they are just in the
formula. Share decimals are `assetDecimals + 6` for the same reason.

Three deliberate details:

**Balance-based accounting.** Yield arrives as a bare `transfer`, so the vault cannot tell
yield from a donation and must read its own balance. That is also exactly the setup the
first-depositor inflation attack needs, which is why the next two points exist.

**Virtual shares (the `10**6` offset).** Without them, an attacker deposits 1 wei, donates a
large amount, and the next depositor's shares round to zero. With the offset, moving the share
price by one wei-of-share costs ~10^6 of the underlying, and whatever the attacker spends is
donated to the victim rather than stolen. Rounding is always in the vault's favour: shares
round down when minting, up when burning, so no loop of deposits and withdrawals extracts dust.
See `test_inflationAttackIsUnprofitable`.

**Linear vesting (`VESTING_PERIOD = 24h`).** Deposits and withdrawals are open with no lockup,
so recognising a keeper transfer instantly would be sandwichable: deposit, watch the price
jump, leave, all in one transaction. Instead, every entry point first calls `_accrue()`, which
notices any balance increase since the last interaction and releases it linearly over 24 hours.
Yield you earn is therefore proportional to the time you actually held. See
`test_yieldCannotBeSandwiched`.

Losses are *not* vested. If the asset rebases down or the vault's balance shrinks for any other
reason, the loss lands immediately and pro-rata on all holders. Smoothing a loss would just let
whoever withdraws first exit at a stale price at everyone else's expense.

`deposit`/`redeem` and `withdraw`/`mint` behave as ERC-4626 specifies, with one documented
deviation: `mint` reverts (`InexactTransfer`) on fee-on-transfer assets, because "pull exactly
N assets" is not expressible there. `deposit` works fine with them — it credits whatever
actually arrived, measured as a balance delta, never the requested amount.

## What an operator has to get right

### Listing a token

`createVault` takes any address and the vault constructor is hostile-input-hardened — metadata
is read with gas-capped staticcalls and hand-decoded, so a token that reverts, returns a raw
`bytes32` (MKR), returns malformed ABI, or burns all its gas cannot block its own listing or
blow up the caller. Non-contract addresses and assets with more than 24 decimals are rejected.
So listing itself is safe. What listing does *not* do is vouch for anything:

- **A vault is only as good as its asset.** Anyone can list a token that mints freely, seizes
  balances, blacklists addresses, or upgrades its implementation tomorrow. The vault holds no
  allowances and shares no state with other vaults, so the damage is bounded to the depositors
  of that one vault — but it is total for them. Any frontend you put in front of this needs its
  own curation list; treat the factory registry as a directory, not an endorsement.
- **Ticker collisions are the main phishing vector.** Share names are derived from the asset's
  own `name()`/`symbol()`, which are attacker-controlled: a fake "svUSDC" vault is trivial to
  create. Route users by asset address, and show the address in the UI.
- **Rebasing assets.** Positive rebases are treated as yield (vested over 24h); negative
  rebases hit everyone immediately. Workable, but say so before listing one.
- **Blacklisting assets (USDC, USDT).** If the vault address is blacklisted, deposits and
  withdrawals stop and there is no admin who can move the funds. That is the deliberate
  trade-off of having no admin key.
- **Fee-on-transfer assets.** Work via `deposit`/`withdraw`/`redeem`; `mint` reverts. Integrators
  that call `mint` need to know this.
- **The CREATE2 address is predictable** (`predictVaultAddress`), so someone can send tokens to
  a vault before it is deployed. Those tokens simply become the first vested yield — no harm,
  but do not treat a pre-deployment balance as a bug.
- **One vault per asset, enforced.** Deploy a second factory and you fragment liquidity and
  create look-alike vaults. Pick one factory address and publish it.

### Running the keeper

- **The keeper is not privileged.** It just `transfer`s the asset to the vault address. Anyone
  can do the same thing; the vault never distinguishes. So the keeper needs no approval from
  anyone and holds no power over depositor funds — but also, nothing stops someone else from
  donating, and nothing recovers a transfer sent to the wrong address. **Verify the vault
  address from `vaultFor(asset)` on every run**, not from a cached config.
- **Send the right token.** Only the vault's own asset counts. Any other ERC-20 sent to a vault
  is stuck forever — there is no sweep function, by design.
- **Drip small and often.** Yield vests over 24h, so a large infrequent transfer means a long
  window during which a well-timed depositor shares in yield they did not earn (they have to
  actually hold through the window, but still). Transferring every few hours keeps the
  unvested balance small and the dilution negligible.
- **Never `transfer` to a vault with zero total supply.** Those assets vest to whoever deposits
  next. Check `totalSupply() > 0` before sending.
- **Calling `sync()` is optional.** It is permissionless and starts the vesting clock promptly;
  otherwise the next deposit or withdrawal picks the transfer up. Calling it right after a
  transfer is tidier and costs one cheap transaction.
- **Monitor `totalAssets()` vs `recordedBalance`.** A persistent gap means transfers are
  arriving that no one has accrued; `recordedBalance` dropping without a withdrawal means the
  asset is taking tokens out of the vault (fee, rebase, seizure) and depositors are eating it.

## Build and test

Dependencies (`forge-std`, `openzeppelin-contracts` v5.1.0) live in `lib/` and are checked in —
they were installed with `--no-git`, so there are no submodules to initialise.

```
forge build
forge test
```

Tests cover pro-rata yield, the JIT-sandwich and inflation attacks, fee-on-transfer accounting,
a token that reenters mid-transfer, hostile metadata, and factory determinism.
