# Save-any-token vaults — operator notes

Two contracts:

- `src/SaveVaultFactory.sol` — permissionless registry. `createVault(token)` deploys the one
  canonical vault for that token (CREATE2, salt = token address) and records it in `vaultFor`.
  Holds no funds, has no roles.
- `src/SaveVault.sol` — one vault per underlying ERC-20. It is an ERC-4626 vault built on
  OpenZeppelin v5.5, so the receipt token is a normal transferable ERC-20 (`svTKN`) that any
  integrator already knows how to handle.

There is **no owner, pauser, upgrade path, fee switch or rescue function** on either contract.
Listing is permissionless, so any admin key would be a key over arbitrary user-chosen tokens; the
vaults are immutable instead, and each vault is fully isolated from the others.

---

## How a depositor's claim is computed

A depositor's claim is their share of `totalAssets()`:

```
claim(user) = balanceOf(user) * (totalAssets() + 1) / (totalSupply() + 10**3)
```

That is OpenZeppelin's ERC-4626 conversion with virtual assets and a decimals offset of 3. The
`+1` / `+1000` are the virtual asset and virtual shares: they make the empty-vault edge cases
well defined and make the classic first-depositor inflation attack economically pointless (the
attacker's donation is captured by the virtual shares, not by the victim's rounding loss). The
receipt token therefore has `underlying.decimals() + 3` decimals.

Rounding always goes against the user and in favour of the vault: `deposit`/`redeem` round shares
and assets down, `mint`/`withdraw` round up. This is what stops a repeated
deposit/withdraw loop from extracting a wei per iteration.

### `totalAssets()` is *not* `balanceOf(address(this))`

```
totalAssets() = storedTotalAssets - lockedRewards()
```

`storedTotalAssets` is an internal accounting number: it goes up by the amount a deposit actually
delivered, down by the amount a withdrawal actually sent, and is resynced to the real balance by
`syncRewards()`. A raw transfer into the vault changes no one's claim until someone calls
`syncRewards()`.

This is deliberate and it is the main security property of the design:

- **No donation / inflation attack.** Moving the share price requires a `syncRewards()` call and
  then a full 24-hour stream, so it cannot be done atomically inside one transaction.
- **The keeper payment can't be sandwiched.** If yield were recognised the instant it landed, a bot
  could deposit in the block before the keeper's transfer and withdraw in the block after,
  capturing a slice of a payment it was never at risk for. Here the payment is released linearly.

### Reward streaming

`syncRewards()` is permissionless. It takes everything sitting in the vault that isn't already
accounted for (`pendingRewards()`) and releases it linearly over `REWARDS_CYCLE_LENGTH = 24 hours`:

```
lockedRewards() = lastRewardAmount * (rewardsCycleEnd - now) / (rewardsCycleEnd - lastSync)
```

It reverts until the current cycle has fully vested, so nobody can repeatedly re-sync to postpone
the release of rewards. Principal is never locked: deposits and withdrawals stay open for the whole
cycle. Only the *price* moves gradually.

If the vault's real balance has gone *down* (a negative rebase, or a token that confiscated
balance), `syncRewards()` writes the lower number and emits `LossRecognized`. The loss is shared
pro-rata by everyone holding at that moment.

### Worked example

Vault holds 1,000 TKN, 1,000,000 shares outstanding. Alice holds 250,000 shares → 250 TKN.
The keeper sends in 100 TKN and calls `syncRewards()`.

| time | `totalAssets()` | Alice's claim |
|---|---|---|
| right after the transfer, before sync | 1,000 | 250.00 |
| right after `syncRewards()` | 1,000 | 250.00 |
| +6 h | 1,025 | 256.25 |
| +24 h | 1,100 | 275.00 |

Anyone depositing at +23 h gets shares at a price that already reflects ~96% of the batch, so
there's nothing to snipe.

---

## What an operator has to get right

### Listing a token

The contracts assume the underlying is hostile and defend the vault's own accounting, but they
cannot make a bad token into a good savings product. Before you surface a vault in the product UI:

1. **Check the token's code, not just its symbol.** Anyone can list anything, and `createVault`
   will happily deploy a vault for a scam token with the symbol `USDC`. The factory only enforces
   that the address is a contract. Curation is a front-end/indexer responsibility — treat
   `vaultFor[token]` as "a vault exists", never as "this token is safe".
2. **Fee-on-transfer tokens work, with one caveat.** Deposits are credited from the measured
   balance delta, so shares only ever back assets that actually arrived. But `mint()` (the
   exact-share entry point) reverts on these tokens — a front-end must route them through
   `deposit()`. On withdrawal, `assets` is the amount that *leaves the vault*; the receiver gets
   less, and the difference is the token's fee.
3. **Rebasing tokens are only partly supported.** A positive rebase shows up as pending rewards
   and is streamed out like any other yield. A negative rebase is recognised as a loss at the next
   `syncRewards()`. Between syncs the quoted price is stale, so don't list rebasing tokens unless
   you're willing to run the keeper often.
4. **Tokens with a blocklist or pause (USDC, USDT) can freeze withdrawals.** If the issuer blocks
   the vault address, every withdrawal reverts and there is no admin here who can bail it out.
5. **Tokens with transfer hooks (ERC-777, ERC-1363) are handled** — every value-moving entry point
   is `nonReentrant` and follows checks-effects-interactions — but a hook token can still make
   deposits expensive or revert.
6. **Don't list a token with more than 36 decimals or exotic metadata expectations.** Metadata is
   read with a gas-capped static call and falls back to 18 decimals and an address-derived symbol,
   so listing never breaks, but the displayed receipt-token metadata will be wrong.
7. **Double-listing is impossible.** `createVault` reverts if the token already has a vault, and
   `predictVaultAddress(token)` gives the address before deployment, so the UI can link to a vault
   that doesn't exist yet.

### Running the keeper

1. **Two steps, always: `transfer` then `syncRewards()`.** A transfer alone increases
   `pendingRewards()` but nobody's claim. Tokens left unsynced are not lost — the next successful
   `syncRewards()` picks them up — but they earn nothing for holders in the meantime.
2. **Respect the cycle.** `syncRewards()` reverts with `CycleNotEnded` until `rewardsCycleEnd`.
   Schedule the keeper at or slightly after the cycle boundary; a job that runs more often than
   every 24 hours will revert harmlessly, but you should alert on it rather than retry blindly.
   The natural cadence is: transfer whenever yield arrives, call `syncRewards()` once per cycle.
3. **Never send yield to the wrong vault or a non-vault address.** There is no rescue function.
   Tokens sent to a vault for a *different* underlying are unrecoverable; tokens sent to the right
   vault are always distributable via `syncRewards()`.
4. **`syncRewards()` is permissionless by design** — anyone can call it, and doing so can only move
   value to existing holders. Don't build anything that assumes the keeper is the only caller.
5. **Fund the vault with the vault's own `asset()`.** The vault never swaps or wraps anything; yield
   must arrive as more of the same underlying.
6. **Alert on `LossRecognized`.** It means the vault's real balance fell below what it had
   accounted for — a rebase, a confiscation, or a broken token.
7. **Keeper key hygiene.** The keeper has no privileges over the vault; the worst a compromised
   keeper key can do is stop sending yield or send it to the wrong place. Don't add privileges to
   it later without revisiting this.

### Before mainnet

Not done here and required before deployment: static analysis (slither), invariant/fork tests
against real mainnet tokens (USDT, USDC, stETH, a fee-on-transfer token), and a third-party review.
`forge test` covers the pro-rata math, the streaming behaviour, donation/JIT resistance,
fee-on-transfer accounting, reentrancy, and hostile metadata.
