# save-any-token — onchain notes

Two contracts, both ownerless and immutable once deployed:

- `src/SaveVaultFactory.sol` — permissionless registry. Anyone calls `createVault(token)` and gets
  the one canonical vault for that token, at a CREATE2 address anyone can recompute offchain.
- `src/SaveVault.sol` — the vault itself. It *is* the receipt token: an ERC-20 (plus `permit`) that
  is freely transferable, and exposes the ERC-4626 interface so it composes with existing
  integrations.

`forge build` compiles; `forge test` runs 19 tests covering the behaviours described below.

---

## How a depositor's claim is computed

A depositor holds **shares**. Their claim is a pro-rata slice of the vault's *recognised* assets:

```
assets = shares * (totalAssets + 1) / (totalSupply + 1000)
shares = assets * (totalSupply + 1000) / (totalAssets + 1)
```

The `+1` / `+1000` are virtual assets and virtual shares — see "inflation attack" below. Rounding
always favours the vault and therefore the existing holders: minting rounds shares **down** and
assets **up**, burning rounds shares **up** and assets **down**. That means a deposit-then-withdraw
round trip can lose you a wei, never gain you one.

### `totalAssets` is internal accounting, not `balanceOf`

This is the one place the design deliberately departs from a naive ERC-4626, and it's the part most
worth understanding before changing anything.

The vault stores `totalAssetsStored`. A plain ERC-20 transfer into the vault does **not** raise it.
Instead, on the next state-changing call (any deposit/withdraw, or a permissionless `sync()`), the
vault notices the unaccounted balance and queues it as `streamRemaining`, released linearly into
`totalAssetsStored` over `DRIP_PERIOD` (24 hours). `totalAssets()` returns principal plus the
already-released part; `lockedYield()` returns the rest.

The keeper still just transfers tokens in — no keeper-side call is needed for correctness, because
the pickup happens lazily inside whatever transaction touches the vault next.

**Why the drip.** Deposits and withdrawals are instant and there is no lockup. If a payout were
recognised the moment it landed, anyone watching the mempool could deposit in the block before the
keeper's transfer, redeem in the block after, and take a pro-rata cut of a day's yield for zero
seconds of exposure — funded entirely by the people who actually held. That is not a theoretical
MEV footnote; it is the dominant strategy against every instantly-recognising vault with open
withdrawals. Spreading each payout over 24 hours means capturing it requires holding for 24 hours,
which is exactly the behaviour the product wants to pay for. `test_yieldSandwichIsUnprofitable`
pins this: the atomic sandwich nets zero.

A second benefit: the same mechanism is why a donation can't move the share price within a
transaction, which is what defuses the classic first-depositor attack.

### Shortfalls are socialised

The underlying is untrusted. It can rebase down, blacklist the vault, or let an admin burn from it,
leaving the real balance below what the vault has accounted. On every accrual the vault compares
`asset.balanceOf(this)` against its own books and, if short, writes the difference down (out of
locked yield first, then principal) and emits `ShortfallRecognised`.

The alternative — leaving the books untouched — turns a shortfall into a first-come-first-served
race where early redeemers exit whole and the last holders get nothing. Writing it down makes every
holder eat the same proportional loss regardless of gas price.

### Known, accepted rounding behaviour

- `deposit` prices at the pre-deposit exchange rate, so your own assets never price your own shares.
- A dust deposit that would mint zero shares reverts (`ZeroShares`) rather than silently donating.
- `mint(shares)` reverts under a fee-on-transfer token, because it cannot honour exact-share
  semantics without diluting everyone else by the fee. Use `deposit(assets)` for those tokens.
- Each new payout restarts the 24h window for the whole locked balance, so frequent small payouts
  stretch the tail of older ones. A griefer dripping 1 wei repeatedly slows release asymptotically;
  they cannot stop or redirect it, and they pay for every transaction.

---

## Hostile-underlying handling (what "permissionless listing" actually costs)

Listing is open, so the underlying token is an untrusted contract that runs code inside every vault
operation. What the vault does about it:

| Token behaviour | Handling |
| --- | --- |
| No return value / `false` return (USDT, BNB) | `SafeERC20` everywhere |
| Fee-on-transfer (PAXG, USDT-if-enabled) | every transfer is measured as a real balance delta; you're credited what arrived |
| Transfer hooks / ERC-777 reentrancy | `nonReentrant` on every external state-changing entry point, plus checks-effects-interactions: shares burn and books update before assets leave |
| `name`/`symbol` missing, `bytes32`, huge, or reverting (MKR) | gas-capped staticcalls, hand-parsed with bounds checks, capped at 48 bytes, fallbacks on failure — never `abi.decode` on untrusted returndata |
| `decimals` lying or reverting | read for display only; it never enters share math |
| Not a contract at all | rejected by the factory and by the vault constructor's `balanceOf` probe |
| Rebase down / blacklist / admin burn | socialised write-down, above |

There is deliberately **no** owner, pause, fee switch or upgrade path on either contract. With
permissionless listing, an admin key that can touch every vault is a bigger risk than any single bad
token; the tradeoff is that a vault over a broken token cannot be rescued, only abandoned.

---

## What an operator has to get right

### Listing a token

1. **Check `vaultFor[token]` first.** There is exactly one vault per token and `createVault` reverts
   on a repeat. Never let a UI point at a vault address that didn't come from the registry (or from
   `predictVault`) — a look-alike contract is the cheapest attack on this product.
2. **The vault's name is derived from the token's own `name()`.** A malicious token can call itself
   "Save USDC". Display the *underlying address*, not just the string, and curate your frontend
   list separately from the onchain registry. The registry is permissionless by design; your UI
   does not have to be.
3. **Understand what you're listing.** The contracts survive weird tokens, but they can't make a
   bad token good:
   - **Rebasing tokens (stETH, AMPL): don't list.** A positive rebase is picked up as yield (fine);
     a negative rebase is a write-down for every holder.
   - **Upgradeable or blacklist-capable tokens (USDC, USDT):** the issuer can freeze the vault's
     balance outright. That's a property of the token, not the vault.
   - **Tokens with callbacks (ERC-777):** safe here, but they make integrations downstream of the
     receipt token riskier.
   - **Very low decimals (GUSD, 2dp):** rounding dust is proportionally larger. The 3-decimal
     virtual-share offset covers the inflation attack, but expect wei-level losses on round trips.
   - **Fee-on-transfer:** works, but tell users `mint()` will revert and that withdrawals net less
     than the requested amount.
4. **Seed the vault yourself with a non-trivial first deposit.** Not strictly required — the virtual
   offset and the drip both hold without it — but it removes the only regime where rounding is
   economically interesting.

### Running the keeper

1. **Just `transfer` the yield in.** No call, no approval, no privileged role. The next interaction
   picks it up; call `sync()` yourself if you want the `YieldQueued` event emitted promptly.
2. **Send to the right vault.** A transfer to the wrong vault is an irrecoverable gift to that
   vault's depositors — there is no admin able to claw it back. Resolve the address through
   `vaultFor[token]` every run, not from a hardcoded list.
3. **Send the same token the vault holds.** Any *other* ERC-20 sent to the vault is simply stuck:
   the vault only ever accounts and transfers `asset`, and has no sweep function.
4. **Payout cadence should be at least the drip period.** Paying more often than every 24 hours
   keeps restarting the release window and stretches the tail; once a day (or slower) is the
   intended rhythm.
5. **Never route yield through `deposit`.** That would mint the keeper shares instead of lifting
   every holder's claim. A bare transfer is the whole interface.
6. **Don't let the keeper's payout be predictable and huge relative to TVL.** The drip caps the
   sandwich, it doesn't eliminate the incentive to time deposits. Steady payouts beat lumpy ones.
7. **Monitor `ShortfallRecognised`.** It means the underlying moved tokens out from under the vault
   — blacklist, rebase, or rug. Nothing onchain can fix it; you want to know before your users do.

### Before mainnet

These contracts are unaudited. The share math, the drip, and the hostile-token handling are the
three areas to put an auditor's time into, in that order.
