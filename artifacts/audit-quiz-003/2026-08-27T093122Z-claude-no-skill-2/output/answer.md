# ArbiLend `borrowWithSig` — signature replay

## TL;DR for the ticket

The user is right. Their key was not compromised, our relayer was not compromised,
and the signature in the June transaction is genuine — it is *the exact same
signature they made in March*. Our contract has no way to tell a first use from a
tenth use, so that one March authorisation is a permanently valid, publicly
readable bearer token that anyone on earth can redeem, forever, as many times as
they like. This is our bug. The June debt is not a debt they authorised.

---

## 1. How the June borrow was possible

The verification is cryptographically correct and semantically empty.

```
structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount))
```

Every input to that hash is a constant of the *intent*, not of the *occasion*:

- `BORROW_TYPEHASH` — compile-time constant
- `borrower` — the user's address, never changes
- `amount` — 5,000e6, never changes

`DOMAIN_SEPARATOR` is likewise fixed at deploy. So for this user and this amount
there is exactly **one** digest that will ever exist, and exactly one signature
over it. `ecrecover(digest, v, r, s) == borrower` answers the question *"did this
user ever sign 'borrow 5,000 USDC'?"* — it does **not** answer *"did this user
authorise the borrow that is happening right now?"*. The contract asks the first
question and acts as if it asked the second.

Three consequences chain together into the incident:

1. **The signature never expires and is never consumed.** Nothing is written to
   storage on use. Repaying in April changed nothing — repayment is not a
   revocation, and the contract has no notion of an authorisation being spent.
2. **The signature is public.** It was in the calldata of the March transaction.
   Anyone reading the chain — a bot indexing `borrowWithSig` calls is a normal
   thing to run — has had those 65 bytes since March.
3. **`borrowWithSig` has no caller restriction.** There is no `onlyRelayer`
   modifier, so "our relayer" is a convention, not a control. Any address can
   submit.

So the June transaction is: an unknown address copied the `(borrower, amount, v,
r, s)` tuple out of the March calldata and re-submitted it verbatim. The require
passed because it was always going to pass. The boarding pass is consistent with
everything we know — the user was not involved in June, and did not need to be.

**Why would someone do this?** The borrowed USDC goes to the borrower, not the
attacker, so this is not a direct theft. The profitable version is: force debt
onto a position until it is under-collateralised, then liquidate it and take the
liquidation bonus. Check whether the June borrow was followed (same block or
shortly after) by a liquidation of this position, and whether the liquidator is
the same address or a known counterparty of it. If so, this was not griefing, it
was an engineered liquidation. Either way the user owes nothing.

**Do this before closing the ticket:** replay-scan the whole history. For every
`borrowWithSig` call ever made, recompute the digest (or just key on the
`(borrower, amount, v, r, s)` tuple) and group. **Any digest appearing more than
once is another victim.** Do this before you tell anyone the blast radius is one
user.

---

## 2. What else this construction exposes us to

These have not bitten us yet. They are live right now.

**a. Unlimited replay, not single replay.** Nothing caps this at one repeat. An
attacker can call `borrowWithSig` with the March signature in a loop, in one
transaction, until the position hits the collateral factor. The June event was an
attacker being conservative or under-resourced, not a limit of the bug.

**b. Every signature we have ever seen is still armed.** Not just used ones.
Signatures that were produced but never landed — dropped from the mempool,
rejected by our relayer, sitting in a relayer database, in a log, in a Sentry
breadcrumb, in a user's wallet history — are all still valid and will be valid in
2035. Our exposure is the set of all signatures ever *created*, which is larger
than the set we can enumerate on-chain, and it grows every day the current code is
live.

**c. No deadline means signing is unbounded in time *and* in market state.** A
user signs "borrow 5,000 USDC" when their collateral is healthy and rates are 3%.
That same signature is redeemable at any future rate, at any future collateral
price, at any future utilisation. There is no such thing as a user consenting to
those terms, because the terms did not exist when they signed. This is a
correctness problem even with a nonce, if we also lack a deadline.

**d. No way for a user to revoke.** A user who realises a signature is loose has
no on-chain action available. Today the only remediation we can offer is
"withdraw all your collateral", which is not a remediation, it is an exit.

**e. Cached `DOMAIN_SEPARATOR` breaks under a chain fork.** `block.chainid` is
read once in the constructor and frozen. If the chain hard-forks and the new chain
adopts a new chain ID, our contract on that chain still uses the *old* chain ID in
its domain, so signatures are cross-chain replayable between the fork and the
original. This is exactly the failure mode EIP-712's chainId field exists to
prevent, and caching defeats it. (Related: if this contract is ever put behind a
proxy, a `DOMAIN_SEPARATOR` set in the implementation's constructor is not in the
proxy's storage. Confirm we are not already in that state.)

**f. Signature malleability — a trap for the fix, not a bug today.** For any valid
`(v, r, s)`, the pair `(v ^ 1, r, n - s)` is a *different byte string* that
`ecrecover` accepts as the same signer. Today this changes nothing (the signature
is infinitely replayable anyway). It matters the moment someone "fixes" this the
cheap way — `mapping(bytes32 => bool) usedSig` keyed on `keccak256(v, r, s)` or on
`r`. That check is bypassed by flipping the signature to its malleable twin, and
the fix ships a false sense of safety. **Replay protection must key on the message
(nonce/digest), never on the signature bytes.** Flag this now so nobody implements
it that way under incident pressure.

**g. `ecrecover` returns `address(0)` on malformed input.** With `v` outside
{27,28} or an out-of-range `s`, `ecrecover` returns zero rather than reverting.
Our current code is accidentally safe because `require(recovered == borrower)`
fails when `borrower != 0`. It stops being safe the instant any code path can
reach this with `borrower == 0` — an uninitialised struct field, a defaulted
argument, a future batch entrypoint. Reject `address(0)` explicitly rather than
relying on that.

**h. Smart-contract wallets cannot use this at all.** Safe, Argent, and every
4337 account have no ECDSA key to `ecrecover` against. Not a vulnerability, but if
we are touching this code we should add EIP-1271 rather than do it twice.

---

## 3. What we ship

### Immediately (today, before the fix)

1. **Pause `borrowWithSig`.** Every outstanding signature is redeemable until it
   is off. Normal `borrow` (msg.sender-authenticated) stays up.
2. **Run the replay scan** from §1 and size the real blast radius.
3. **Cancel the June debt** for this user and unwind any liquidation that followed
   it. The authorisation was consumed in March; June was our contract failing to
   notice.

### The fix

Bind the signature to a single occasion and a bounded window, and make replay
protection message-keyed.

```solidity
bytes32 private constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
);

mapping(address => uint256) public nonces;

bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
uint256 private immutable _CACHED_CHAIN_ID;

event BorrowAuthorizationUsed(address indexed borrower, uint256 nonce, bytes32 digest);
event NoncesInvalidated(address indexed borrower, uint256 newNonce);

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    // recompute if the chain forked under us
    return block.chainid == _CACHED_CHAIN_ID
        ? _CACHED_DOMAIN_SEPARATOR
        : _buildDomainSeparator();
}

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    bytes calldata signature      // bytes, not (v,r,s) — needed for EIP-1271
) external {
    require(block.timestamp <= deadline, "expired");

    uint256 nonce = nonces[borrower]++;   // consumed here, before any external call

    bytes32 digest = keccak256(abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR(),
        keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline))
    ));

    require(
        SignatureChecker.isValidSignatureNow(borrower, digest, signature),
        "bad sig"
    );

    emit BorrowAuthorizationUsed(borrower, nonce, digest);
    _borrow(borrower, amount);
}

/// Lets a user burn outstanding authorisations without moving collateral.
function invalidateNonces(uint256 newNonce) external {
    require(newNonce > nonces[msg.sender], "monotonic only");
    nonces[msg.sender] = newNonce;
    emit NoncesInvalidated(msg.sender, newNonce);
}
```

Point by point, and why each line is there:

- **`nonce`, read-and-incremented before verification.** This is the actual fix.
  The digest is now unique per occasion, so a replayed signature recovers to a
  different (wrong) address and reverts. Increment first, so the storage write
  cannot be re-entered around by anything `_borrow` touches.
- **`deadline`.** Bounds market-state exposure (§2c). Our relayer should sign with
  minutes, not days. Enforce a max window (`deadline <= block.timestamp + 1 hours`)
  if we want a hard ceiling rather than trusting the frontend.
- **`SignatureChecker` (OpenZeppelin).** Gets us three things at once: it rejects
  `s > secp256k1n/2` and `v ∉ {27,28}` (malleability, §2f), it rejects
  `address(0)` recovery (§2g), and it falls back to EIP-1271 for smart-contract
  wallets (§2h). Do not hand-roll `ecrecover` here. If we must, the checks are
  `require(uint256(s) <= 0x7FFF...B20A0)`, `require(v == 27 || v == 28)`,
  `require(signer != address(0) && signer == borrower)`.
- **`invalidateNonces`.** Gives users a revocation path (§2d). Cheap to add, and
  it is the answer we want to have the next time someone asks "how do I make sure
  this can't happen again".
- **Chain-ID-aware domain separator.** Keeps the cached-value gas saving while
  staying correct across a fork (§2e).
- **New typehash invalidates the past.** Because the type string changed, the
  digest for every historical signature changes too. **Every signature ever issued
  under the old scheme becomes unverifiable the moment this ships** — including
  the ones we cannot enumerate (§2b). That is the property we want. Do not add a
  legacy-signature compatibility path; it would preserve the exact hole we are
  closing.

Migration is a redeploy or an upgrade, not a config change: the old function
signature is gone and relayer + frontend must sign the new struct. Version-bump
the EIP-712 domain to `"2"` as well if we want belt and braces.

### Tests to land with it

- Same signature twice → second call reverts.
- `deadline` in the past → reverts.
- Malleated `(v ^ 1, r, n - s)` → reverts (this is the one a naive fix fails).
- `signature` recovering to `address(0)` with `borrower == address(0)` → reverts.
- `invalidateNonces` → a previously-valid unspent signature stops working.
- Fork simulation: change `block.chainid`, confirm an old-chain signature no
  longer verifies.
- EIP-1271: a Safe-style contract wallet can borrow.

---

## 4. What to tell the user

Plainly, and without hedging, because they are correct and we are not going to
come out of this looking better by being vague:

> You authorised one borrow, in March, and you repaid it. The June borrow was not
> authorised by you and did not require any action, key, or device of yours. Our
> contract failed to record that your March authorisation had already been used,
> which allowed a third party to re-submit your original, genuine signature months
> later. Your key is not compromised and you do not need to rotate it. We are
> cancelling the June debt and [unwinding the liquidation / restoring your
> collateral], and we have disabled the affected function until a fix that binds
> each authorisation to a single use and a short expiry is deployed.

Do not ask them to rotate keys — it would not have helped and it implies fault on
their side. If the replay scan turns up other affected positions, they need the
same message before they find it themselves.
