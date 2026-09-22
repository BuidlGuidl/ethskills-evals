# Save Any Token — design & operating notes

Two contracts:

| Contract | Role |
|---|---|
| `src/SaveVaultFactory.sol` | Permissionless registry. Anyone calls `createVault(token)`; one vault per token, CREATE2, deterministic address. Never holds or approves funds. |
| `src/SaveVault.sol` | One vault per underlying ERC-20. ERC-4626 + ERC-2612 permit. The receipt token *is* the vault contract. |

There is **no owner, no pauser, no upgrade path, no fee switch, and no privileged keeper
address**. Once a vault is deployed nobody — including us — can change its behaviour, freeze it,
or seize deposits. That is a deliberate trade for a permissionless product: it also means there is
no emergency stop, so everything below has to be right at deploy time.

---

## How a depositor's claim is computed

Every vault tracks exactly two numbers:

- `totalAssets()` = `underlying.balanceOf(vault)` — everything the vault holds, including yield.
- `totalSupply()` = receipt tokens outstanding.

A holder's claim is their pro-rata slice:

```
claim = shares * (totalAssets + 1) / (totalSupply + 1e6)      // rounded down
shares_minted_on_deposit = assets_received * (totalSupply + 1e6) / (totalAssets + 1)   // rounded down
```

Reading it in order:

1. **Yield needs no bookkeeping.** The keeper sends underlying to the vault address. `totalAssets`
   rises, `totalSupply` does not, so every holder's claim rises proportionally in the same
   transaction. No `notifyReward`, no checkpoint, no accrual loop, nothing to call.
2. **The receipt is fully transferable.** The claim lives in the share balance, not in a per-user
   struct, so sending the receipt sends the claim (including all yield earned so far) with it.
   `test_receiptIsTransferableAndCarriesTheClaim` pins this.
3. **`+ 1` asset and `+ 1e6` shares are virtual.** They do not exist and cannot be redeemed; they
   exist to make an empty vault behave as if it already held 1 wei against 1e6 shares. See the
   inflation attack below.
4. **Rounding always favours the vault**, i.e. the depositors who are already in it. Deposits round
   shares down, withdrawals round shares-burned up. A deposit-then-immediate-withdraw round trip
   therefore always loses a wei or two rather than gaining — fuzzed by
   `testFuzz_roundTripIsNeverProfitable`.
5. **Deposits are credited by measured balance delta**, not by the requested amount
   (`SaveVault._deposit`).

Because the receipt carries `underlying.decimals() + 6` decimals, a vault over USDC (6 decimals)
issues a 12-decimal receipt and one over WETH issues a 24-decimal receipt. That is expected — read
`decimals()`, never assume 18, and always quote user-facing balances through
`convertToAssets` / `previewRedeem` rather than by treating shares as if they were the underlying.

### Why share price is balance-derived, and what that costs

Deriving `totalAssets` from the raw balance is what makes "the keeper just sends tokens in" work.
The price of that is the ERC-4626 **inflation / donation attack**: a first depositor mints 1 wei
worth of shares, donates a large amount directly, and the next depositor's share quote rounds to
zero — the attacker then redeems everything. We can't defend with the usual "reject unexpected
balance increases" check, because unexpected balance increases *are the product*. So the vault
defends on two axes instead:

- **A 1e6 virtual-share offset**, so shifting the exchange rate enough to cost a victim `X` requires
  donating on the order of `1e6 * X` first — the attacker burns roughly a million times what they
  could extract. `test_inflationAttackIsUnprofitable` runs the full attack: the attacker ends
  ~100k USDC down and the victim keeps >99.999% of a 100k deposit.
- **`ZeroShares` revert.** If a deposit would mint zero shares it reverts instead of silently
  handing the assets to the pool. That closes the theft path entirely; what remains is a
  self-funded griefing DoS on small deposits, covered by
  `test_absurdDonationGriefsWithARevertNotATheft`.

---

## What an operator has to get right

### Listing a token

Listing is permissionless by design, so the contracts assume the underlying is hostile and are
built to contain it rather than to vet it. Containment is real but bounded:

- Each vault is a separate contract holding exactly one asset, and the factory holds nothing and
  approves nothing. A malicious token can only hurt people who deposited into *its* vault.
- Nothing in the accounting trusts token metadata. `SafeTokenMetadata` reads `name()`/`symbol()`
  through a gas-capped staticcall, handles `bytes32`-style metadata (MKR), truncates, strips
  control characters and `" ' \ < >`, and falls back to `"Unknown Token"` / `"TKN"`. A token that
  reverts or returns a returndata bomb still lists fine.

What is **not** contained, and is the operator's job — for a listing to be safe for depositors,
and for it to be safe to *surface in the UI*:

1. **Confirm the address is the real token**, not a look-alike with the same symbol. Symbols are
   attacker-controlled strings; only the address is identity. Resolve vaults through
   `factory.vaultFor(token)`, never by matching a symbol.
2. **Fee-on-transfer** is handled (the vault credits what actually arrived, and
   `test_feeOnTransferCreditsOnlyWhatArrived` proves equal deposits get equal claims) — but a
   withdrawal of `N` delivers less than `N` to the receiver, because the token takes its cut on the
   way out. The UI must quote net-of-fee amounts or depositors will file bug reports forever.
3. **Rebasing tokens work but change the risk profile.** Positive rebases behave exactly like
   keeper yield. *Negative* rebases socialise a loss across all holders, silently. Either exclude
   them or label them.
4. **Blocklist / pausable tokens (USDC, USDT) can freeze withdrawals** — not because of anything
   the vault does, but because the token can refuse the transfer, and a vault that is itself
   blocklisted strands every depositor. This is an unremovable risk of listing them.
5. **Transfer-hook tokens (ERC-777, ERC-1363) are safe here** — every entry point is `nonReentrant`
   on top of checks-effects-interactions, and `test_reentrantTokenCannotReenter` shows a reentrant
   redeem inside a transfer hook reverting. A token with a *malicious* hook can still make its own
   vault's transfers fail arbitrarily.
6. **Tokens that can mint arbitrarily, upgrade their implementation, or rug** make their vault
   worthless. No contract can defend against this; it is a curation decision, so it belongs in the
   UI's allow/warn list, not in the contracts.
7. **Do not list a non-contract address.** `createVault` rejects `token.code.length == 0`, because
   calls to an EOA succeed silently and would produce a vault that accepts "deposits" and holds
   nothing. A token deployed *later* to that address via CREATE2 is a related hazard — always list
   against a live, verified token.
8. **Verify source on Etherscan** for the factory and each vault (`forge verify-contract`).
   Unverified vaults are indistinguishable from scams and cannot be audited by depositors.

### Running the keeper

The keeper has no on-chain privileges — it is just an address that sends tokens to the vault. That
is what makes it safe, and also what makes these the failure modes:

1. **Send to the vault address, not the underlying's address, and not the factory.** Tokens sent to
   the factory are stuck forever; there is no sweep function anywhere (a sweep is exactly the kind
   of privileged escape hatch that gets a protocol drained, so it was left out on purpose).
2. **Send the vault's own underlying.** Any *other* ERC-20 delivered to a vault is permanently
   stranded: `totalAssets` only reads the one asset, and nothing can move a foreign token out.
3. **Amounts are in the underlying's own decimals.** 1 USDC is `1e6`, 1 WBTC is `1e8`. Hardcoding
   `1e18` sends a trillion USDC or silently nothing.
4. **Yield lands instantly and is not vested.** Anyone can deposit in the block before a large
   keeper transfer and redeem in the block after, capturing yield they did not earn. On mainnet the
   transfer is visible in the public mempool, so this will be MEV'd on day one. Mitigations, in
   order of effort: send yield through a private relay (Flashbots Protect), stream it in small
   frequent transfers rather than large periodic ones, or add a linear-unlock wrapper that releases
   a pending balance over time. The contracts here deliberately implement none of these — if the
   product needs drip-vesting, that is a new contract, not a parameter.
5. **A keeper transfer that lands inside a user's transaction changes their quote.** Integrators
   and the UI should use `depositMin` / `redeemMin`, which bound the output the way a swap's
   `amountOutMinimum` does. `previewDeposit` is a quote, not a promise.
6. **Never approve the vault for more than a single keeper transfer.** The keeper uses a bare
   `transfer`, so no allowance is needed at all; if some upstream flow needs one, approve the exact
   amount. A hot keeper key with an unbounded approval is a single compromise away from draining
   the treasury it pulls from.
7. **Keeper key hygiene.** It holds no protocol power, but it holds the undistributed yield. Treat
   it as a hot wallet: minimal float, funded per-run from a multisig.

---

## Build & test

```bash
forge build
forge test -vv
forge test --fuzz-runs 10000     # deeper run on the two invariant-style fuzz tests
```

19 tests cover pro-rata accounting, the inflation attack end to end, fee-on-transfer dilution,
reentrancy via a transfer hook, hostile metadata, slippage bounds, allowance enforcement on
third-party redeems, factory determinism, and two fuzzed invariants (claims never exceed assets;
round trips are never profitable).

### Before mainnet

- [ ] `slither .` and `mythril` clean, or every finding triaged in writing.
- [ ] Deeper fuzzing plus a stateful invariant run (`forge test --fuzz-runs 100000`).
- [ ] External audit — this holds user funds with no upgrade path and no pause.
- [ ] Source verified for the factory and for the first vaults.
