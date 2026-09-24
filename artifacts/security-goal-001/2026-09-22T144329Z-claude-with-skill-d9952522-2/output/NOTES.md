# Save Vaults — implementation notes

Two contracts:

| Contract | Role |
|---|---|
| `src/SaveVaultFactory.sol` | Ownerless registry. Anyone lists any ERC-20; exactly one canonical vault per token, deployed with CREATE2. |
| `src/SaveVault.sol` | The vault. ERC-4626 over one underlying token. The receipt token *is* the vault contract's own ERC-20 (plus EIP-2612 `permit`). |

Built on OpenZeppelin Contracts v5.5.0 (`ERC4626`, `ERC20Permit`, `SafeERC20`, `ReentrancyGuard`).
`forge build` and `forge test` both pass; the suite is in `test/SaveVault.t.sol`.

---

## 1. How a depositor's claim is computed

There is no per-user balance ledger and no accrual index. A depositor holds **shares**
(the receipt token), and the vault holds **assets**. The claim is pro rata:

```
                       totalAssets + 1
claim(user) = shares × ────────────────────
                       totalSupply + 10⁶
```

### `totalAssets` is the live balance

```solidity
function totalAssets() public view override returns (uint256) {
    return IERC20(asset()).balanceOf(address(this));
}
```

This is forced by the yield design. The keeper delivers yield with a plain
`transfer` — no call into the vault, no hook, nothing to record. So the vault has to
read its balance to see the yield at all. Consequences, all deliberate:

- **Yield lifts every claim automatically and instantly.** The keeper's transfer raises
  `totalAssets` while `totalSupply` is unchanged, so every share is worth more. No
  `harvest()`, no checkpoint, no gas paid per holder, nobody to exclude.
- **There is no cached total that can drift from reality.** Accounting cannot desync
  from custody, because there is only one number and it is the balance.
- **Unsolicited donations are yield.** They are indistinguishable from keeper drips and
  are shared by all current holders. This is why the vault is *structurally*
  donation-sensitive and cannot defend itself by rejecting donations — see §3.

### The `+ 1` and `+ 10⁶`: virtual assets and shares

The vault behaves as if it permanently holds **10⁶ virtual shares backed by 1 virtual
wei** (`_decimalsOffset() = 6`). That is the whole defence against the first-depositor
inflation attack, and it is load-bearing here precisely because donations can't be
rejected. Effects:

- The empty vault has a defined, finite share price, so there is no special-cased 1:1
  bootstrap path to exploit.
- To make a victim's deposit round down to zero shares, an attacker must donate on the
  order of **10⁶ ×** the victim's deposit — and the virtual shares absorb most of that
  donation rather than the attacker's position, so the attacker takes a large loss.
  `test_inflationAttackIsUnprofitable` and the fuzz test assert the attacker can never
  end up ahead.
- **Price of this choice:** the receipt token has `underlyingDecimals + 6` decimals
  (svDAI has 24), and a dust fraction of every yield drip accrues to the virtual shares
  instead of to holders.

### Rounding

Every conversion rounds **in the vault's favour**, i.e. against the caller, so rounding
can only ever leave the vault over-collateralised:

| Path | Rounding |
|---|---|
| `deposit` → shares minted | down |
| `mint` → assets pulled | up |
| `withdraw` → shares burned | up |
| `redeem` → assets paid | down |

`testFuzz_claimsNeverExceedHoldings` asserts the resulting invariant: the sum of all
claims never exceeds what the vault actually holds.

### Deposits are credited from the balance delta

`deposit()` does not mint against the amount you *asked* to deposit. It snapshots the
balance, transfers, and mints against what actually **arrived**, priced at the
pre-transfer balance:

```solidity
uint256 assetsBefore = token.balanceOf(address(this));
SafeERC20.safeTransferFrom(token, msg.sender, address(this), assets);
uint256 received = token.balanceOf(address(this)) - assetsBefore;
shares = received.mulDiv(totalSupply() + 1e6, assetsBefore + 1, Floor);
```

Listing is permissionless, so fee-on-transfer tokens *will* be listed. Without this, a
1% fee-on-transfer deposit would mint shares for 100 while delivering 99 and silently
dilute everyone already in the vault. Two things follow:

- `previewDeposit()` is an **upper bound**, not an exact quote, for fee-on-transfer
  tokens. For normal tokens it is exact.
- `mint()` (exact shares out) **reverts** with `InexactAssetTransfer` if the vault is
  shorted, because exact-share semantics and a transfer fee are mutually exclusive. Use
  `deposit()` for fee-on-transfer tokens.

A deposit that would mint zero shares reverts (`ZeroShares`) rather than pocketing the
tokens.

### Reentrancy

`deposit` / `mint` / `withdraw` / `redeem` are all `nonReentrant`. The underlying is
untrusted and may hand control back mid-transfer (ERC-777 hooks, or any token with a
callback). Since share price is read from a balance that is *in flux* during that
window, re-entering would let a token trade against a half-updated price.
`test_reentrantTokenIsBlocked` covers this.

---

## 2. What an operator has to get right

### 2a. Listing a token

The factory checks only that the address has code. **A listing is not an endorsement,
and the factory cannot make a bad token safe.** Before you surface a vault in the
product, confirm the underlying:

1. **Has no transfer fee**, or accept that `mint()` is unusable for it and the UI must
   route through `deposit()` only.
2. **Does not rebase.** A token whose balances shrink (algorithmic rebases, Aave-style
   aTokens going down) silently reduces `totalAssets` and every claim, with no event.
   Positive rebases are just yield and are fine; negative ones are a loss to holders.
3. **Has no admin pause, blacklist, or freeze** you are not willing to expose depositors
   to. If the token can block transfers, it can block withdrawals. The vault has no
   override — that is by design (§4).
4. **Is not upgradeable behind a key you don't trust**, since the token proxy can be
   changed into any of the above after listing.
5. **Has no callback / hook on transfer** (ERC-777, ERC-1363). The reentrancy guard
   holds, but such tokens can make ordinary operations revert unpredictably.
6. **Is the token you think it is.** Anyone can deploy a contract reporting
   `symbol() == "USDC"`. The vault's name and symbol are copied from the underlying and
   are **attacker-controlled strings** — they are sanitised to printable ASCII and
   capped at 32 chars, but they carry no authority. Resolve by token address via
   `vaultFor(token)`, never by symbol.
7. **Has ≤ ~50 decimals.** Receipt decimals are `underlying + 6`; an absurd `decimals()`
   makes the receipt token's display value nonsense (it does not break accounting).

**Seed every vault you list.** Immediately after `createVault`, make a non-trivial
deposit from the listing account and leave it in. Virtual shares already make the
inflation attack unprofitable, but a live vault with real TVL removes the remaining
rounding-grief window entirely, and costs you nothing but the float.

Also note: `predictVaultAddress()` depends on the token's reported name and symbol,
because those are constructor arguments. A token that changes its `symbol()` between
your quote and your transaction changes the deployed address. Always confirm against
`vaultFor(token)` after listing rather than trusting a stale prediction.

### 2b. Running the keeper

The keeper is *just* `token.transfer(vault, amount)`. There is no vault function to
call, no permission to hold, and no state to keep in sync. What can still go wrong:

1. **Never send yield to a vault with `totalSupply() == 0`.** With no shares
   outstanding, donated assets back only the virtual shares. They are not
   recoverable, and they inflate the share price for the next depositor. Check
   `vault.totalSupply() > 0` before every transfer and skip the vault otherwise.
2. **Size drips against TVL.** A drip that is enormous relative to the vault's current
   assets pushes the share price up so far that small deposits round to zero shares and
   revert. Rule of thumb: keep a single drip within the same order of magnitude as
   `totalAssets()`; split a large payout across several transfers as TVL grows.
3. **Send the right token to the right vault.** `vaultFor(token)` is the only correct
   destination. A transfer of token A to token B's vault is an irrecoverable gift to
   nobody — there is no rescue function (§4). Assert
   `SaveVault(v).asset() == address(token)` in the keeper before every send.
4. **Drip on a steady, un-gameable cadence.** Because yield lands in one block and
   claims update instantly, anyone who can predict the drip can deposit in the block
   before and withdraw in the block after, capturing yield they did not hold through.
   There is no lockup to stop this — it is the stated product. Mitigate operationally:
   frequent small drips rather than rare large ones, and private-mempool submission so
   the transfer cannot be sandwiched.
5. **Fund and monitor the keeper key.** It holds no privilege over the vault (worst case
   a compromised keeper key *gives* tokens away), but a stalled keeper means silently
   zero yield. Alert on drip age, not just on failure.
6. **Account for fee-on-transfer on the keeper side too.** The vault credits what
   arrives, so a fee token delivers less yield than you sent. Gross it up or accept it.

---

## 3. Accepted risks

- **The vault is permanently donation-sensitive.** Not a bug to fix — it *is* the yield
  mechanism. Handled with virtual shares, not by rejecting donations.
- **Residual rounding grief.** After a donation of ~10⁶ × a pending deposit, that
  deposit loses up to one share of rounding, or reverts with `ZeroShares` if it would
  round to nothing. The attacker cannot capture that value (the fuzz test asserts it),
  so this is griefing at enormous cost, not theft. Depositors should still use a
  minimum-shares-out check; a router wrapper is the right place for it.
- **No slippage protection in the vault itself.** ERC-4626's `deposit`/`redeem` take no
  `minOut`. Front ends and integrators must bound the result themselves.
- **Timing games on yield.** No lockup means no defence against deposit-before-drip.
  Mitigated operationally (§2b.4), not in the contract.
- **Bad underlying tokens.** Isolated per vault — one malicious token cannot touch any
  other vault or the factory — but depositors in *that* vault are fully exposed to it.

## 4. Why there is no owner

`SaveVault` and `SaveVaultFactory` have **no owner, no pause, no upgrade path, and no
rescue function.** This is a deliberate trade, not an omission.

A permissionless listing registry whose vaults can be paused, upgraded or drained by a
key has simply moved the trust assumption to that key: the same switch that stops an
exploit also censors withdrawals and, in a compromise, becomes the exploit. Since the
vaults hold nothing but user deposits and have no external integrations, oracles, or
parameters to tune, there is nothing an admin would legitimately need to change. So
there is no admin, and the deployed bytecode is the whole agreement.

The cost of that choice, stated plainly: **tokens sent to the wrong vault are gone**,
and a vault listed over a broken token stays listed forever. Both are handled off-chain
— the keeper asserts its destination (§2b.3), and the product surface chooses which
vaults to show.

## 5. Before mainnet

- [ ] Run Slither/Aderyn; resolve or document every high/medium finding.
- [ ] Fork-test against the real tokens you intend to list first (USDT's missing return
      value, USDC's proxy + blacklist, DAI's `bytes32`-era quirks).
- [ ] Add invariant tests with a handler covering interleaved deposits, redeems,
      transfers of the receipt token, and keeper drips.
- [ ] Verify deployed bytecode on Etherscan for the factory and at least one vault.
- [ ] Ship a router or front-end path that enforces minimum-shares-out / minimum-assets-out.
- [ ] Publish the keeper's drip policy and destination-assertion logic alongside the code.
