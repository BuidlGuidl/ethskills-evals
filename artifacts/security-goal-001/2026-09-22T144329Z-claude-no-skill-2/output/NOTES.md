# save-any-token — onchain notes

Two contracts:

- `src/SaveVaultFactory.sol` — permissionless registry/deployer. One canonical
  vault per ERC-20, deployed with CREATE2 (salt = token address).
- `src/SaveVault.sol` — the vault itself. It *is* the receipt token: shares are
  a plain transferable ERC-20 (with `permit`), so a depositor's claim moves with
  the receipt.

`forge build` / `forge test` (21 tests, incl. fee-on-transfer, reentrant-token,
donation/inflation, and hostile-metadata cases).

---

## How a depositor's claim is computed

`totalAssets()` is just `asset.balanceOf(vault)`. That is what makes the keeper
work: it transfers tokens in, nothing is called, and every share is instantly
worth more. There is no internal accounting counter to keep in sync and no
`notifyYield()` to forget.

Shares are priced against that balance, with **virtual assets and shares** added
to both sides:

```
shares = assets * (totalSupply + 10**3) / (totalAssets + 1)      // deposits, rounded down
assets = shares * (totalAssets + 1) / (totalSupply + 10**3)      // redemptions, rounded down
```

Share decimals = asset decimals + 3 (`DECIMALS_OFFSET`), so a whole share is
still a sane number in a UI.

Three details that matter more than the formula:

1. **Deposits are credited by measured balance delta, not by the requested
   amount.** `_pull()` snapshots `balanceOf(vault)` either side of the
   `transferFrom` and credits only the difference. For a fee-on-transfer asset
   the depositor is credited what actually arrived; crediting the requested
   amount would mint shares against tokens the vault never received, and the
   last person out would eat the shortfall.

2. **The deposit is priced against the pre-deposit balance.** The snapshot is
   taken before the pull; pricing against the post-pull balance would price the
   deposit partly against itself.

3. **Rounding always favours the vault**, i.e. existing shareholders. Deposits
   and redemptions round down; the exact-amount paths (`mint`, `withdraw`) round
   the share side up. Dust accrues to the pool, never to the person leaving.

### Why the vault can't be dilution-attacked

The classic first-depositor attack — mint 1 wei of shares, donate a large
balance, let the victim's deposit round to zero shares — is closed on both ends:

- **Virtual offset.** With `10**3` virtual shares against 1 virtual asset,
  inflating the share price to the point where a victim rounds down costs the
  attacker roughly 1000× whatever they could extract.
- **Bootstrap reset.** While `totalSupply == 0`, the share math prices against a
  basis of `0`, not the live balance. Tokens donated into an empty vault are
  absorbed as a gift to the first real depositor rather than diluting them, so
  pre-seeding is a pure loss for the attacker.
- **Locked shares.** The first deposit permanently burns `MIN_LOCKED_SHARES`
  (1000) to `0x…dEaD`, so `totalSupply()` can never return to zero. The bootstrap
  branch is reachable exactly once per vault and the share price can't be reset
  by emptying the vault.

### Entry points

`deposit` / `redeem` take a slippage bound (`minSharesOut` / `minAssetsOut`) —
use them. The share price moves between simulation and execution every time the
keeper lands yield, and a stale quote is how depositors get sandwiched. The
two-argument ERC-4626-shaped overloads pass `0`/`max` and are only safe from a
contract that checks the return value itself.

`mint` (exact shares) and `withdraw` (exact assets out) exist for composability
but are strict: `mint` reverts with `InexactAssetTransfer` if the asset doesn't
deliver exactly what was pulled, because "exactly N shares" and "a transfer fee"
cannot both be honoured. Use `deposit`/`redeem` for fee-on-transfer tokens.

### Deliberately not ERC-4626

The method set and the `Deposit`/`Withdraw` events match ERC-4626, but the vault
does not claim compliance and does not declare the interface. ERC-4626 requires
`previewDeposit` to be exact and `mint` to return exactly the shares requested;
neither can hold for an arbitrary permissionlessly-listed token. Integrators
should read `previewDeposit` as a quote, not a promise.

---

## What an operator has to get right

### Listing a token

The factory enforces only what the accounting itself depends on: the address is
a contract, `decimals()` is readable and ≤ 24, and `balanceOf(address)` returns a
uint256. `name()`/`symbol()` are read with a gas cap and bounded, sanitised
copying (legacy `bytes32` metadata supported; a gas-bomb or garbage symbol falls
back to `svTKN` instead of bricking the listing). **None of that is a safety
review.** Anyone can list anything, so the listing decision lives in the product,
not in the contract:

- **Rebasing / elastic-supply tokens (stETH, AMPL, aTokens) are not supported.**
  A negative rebase silently cuts every holder's claim with no event, and a
  positive rebase is indistinguishable from keeper yield. Don't surface vaults
  for them.
- **Fee-on-transfer tokens work but behave differently.** Depositors are credited
  net of the fee, `previewDeposit` will overstate the result, and `mint()`
  reverts. Label them.
- **Tokens with transfer hooks (ERC-777, ERC-1363) are handled** — every
  balance-changing entry point is `nonReentrant` and follows checks-effects-
  interactions — but a hook still gives the token control during a user's
  transaction. Treat as higher risk.
- **Upgradeable, pausable, or blacklisting tokens (USDC, USDT) can freeze a
  vault** at the token's discretion. Nothing onchain can fix that; the vault has
  no owner, no pause, and no rescue hatch, which is the correct trade for a
  permissionless product but means a broken token means a stuck vault.
- **Look-alike tokens are the main user-facing risk.** One vault per token
  *address*, not per symbol — anyone can deploy "USDC" and list it, and the
  receipt will be called `svUSDC`. The front end must resolve by address against
  a curated list and mark everything else unverified.
- **Non-standard returns** (USDT's missing return value) are fine: all token
  calls go through OpenZeppelin `SafeERC20`.
- A vault with zero supply is inert — listing costs the lister gas and nothing
  else. Spam listings are an indexing problem, not a safety one.

### Running the keeper

- **Yield is delivered by a plain `transfer` of the underlying to the vault
  address.** No approval, no call. Sending the *wrong* token to a vault is
  permanently lost: there is no rescue function. Verify
  `factory.vaultFor(token) == vault` before every send.
- **Large, infrequent drops are sandwichable.** The share price jumps the instant
  the transfer lands, so anyone can deposit in the block before and redeem in the
  block after, capturing yield they were never exposed to. Mitigate by paying
  frequently in small amounts, and/or by sending through a private mempool
  (Flashbots Protect) so the pending transfer isn't visible. This is a property
  of instant balance-based recognition, which is what "the keeper just sends
  tokens in" buys; the alternative is a streaming/drip contract that releases
  linearly over time — worth doing if drops are ever large relative to TVL.
- **Never route keeper yield through `deposit()`.** That mints shares to the
  keeper instead of lifting everyone's claim.
- Deposits into a vault whose share price has grown very large can round to zero
  shares and revert (`ZeroAmount`). That's the intended failure — it protects the
  depositor from donating dust — but the front end should quote a minimum.
- The vault holds no ETH and has no admin keys. There is nothing for the operator
  to custody and nothing to rotate; equally, there is no emergency pause. Plan
  incident response as "tell people to withdraw", not "pause the vault".
