# ArbiLend — `borrowWithSig` replay: root cause, blast radius, fix

**Summary for the ticket:** the user is right, and so is your reading of the
verification code. The signature check is correct; the *message it checks* is
wrong. The March signature was never retired, so it stayed a permanently valid
bearer instrument sitting in public calldata. No key was compromised. This is
our bug.

---

## 1. How the June borrow was possible

The digest is a pure function of two values the user cannot change after the fact:

```
digest = H("\x19\x01", DOMAIN_SEPARATOR, H(BORROW_TYPEHASH, borrower, amount))
```

`DOMAIN_SEPARATOR` is fixed at construction. `borrower` and `amount` are fixed by
the intent. So for `(user, 5000e6)` there is exactly **one** digest, for the life of
the contract, and exactly one `(v, r, s)` that satisfies it.

The contract records nothing about that signature having been used. `_borrow`
touches debt accounting; it does not touch signature state. There is no nonce, no
deadline, no consumed-signature set. Repaying in April cleared the *debt* — it had
no effect on the *authorisation*, because the authorisation was never stored
anywhere to be cleared.

And the signature is public. The moment the March transaction landed, its calldata
— including `(v, r, s)` — was permanently readable by anyone with an RPC endpoint.
Scraping every `borrowWithSig` call on a chain is a few lines of code and a common
thing to do.

So the June transaction is not a forgery and not a compromise. Someone read the
March calldata, copied the five arguments verbatim, and called the function again
from their own address. `ecrecover` returned the user's address because the user
genuinely signed that digest — in March. The contract has no way to tell the
difference between "signed just now" and "signed five months ago and already
spent," because it never asked the question.

The boarding pass and the byte-identical `(v, r, s)` are consistent with exactly
this and rule out the alternatives: a fresh signature would have different bytes,
and a stolen key would not need to reuse an old one.

**"Off-chain authorisation" here is really a permanent standing order.** Every user
who has ever used this path has one outstanding against them right now.

### Two things worse than the ticket suggests

**It is not one replay — it is unlimited replays.** Nothing caps reuse at one. The
same signature can be submitted in a loop, in a single transaction, until the
position hits the collateral factor or the pool runs dry. June was one use of an
instrument that permits arbitrarily many. Treat this as an *active* exposure, not a
postmortem.

**Check where `_borrow` sends the funds.** I can't see the body. If it credits
`borrower`, the attacker gains nothing directly, which means the profit motive is
almost certainly to push the position to a liquidatable LTV and take the liquidation
bonus — check for a liquidation of this account shortly after the June transaction,
and check whether the unknown sender or a related address was the liquidator. If
`_borrow` sends to `msg.sender` anywhere in its path, this is straightforward theft
and the severity is higher again. Either way, resolve this before writing back to
the user, because it changes what happened to their collateral.

---

## 2. What else the same construction exposes, that hasn't bitten yet

Ordered by what I'd fix first.

**a. Every historical signature is still live.** Not just this user's. Enumerate
every `borrowWithSig` call in the chain's history, pull `(borrower, amount, v, r, s)`
from each, and intersect with accounts that still hold collateral. That set is your
current blast radius and it is exploitable today.

**b. Signatures that never landed on-chain are also live.** Anything handed to the
relayer and dropped, anything in a transaction that reverted for an unrelated reason,
anything in a mempool a searcher observed. Those never appear in your on-chain
history, so step (a) *undercounts* the exposure. You cannot fully enumerate this set,
which is one reason the fix has to invalidate signatures categorically rather than
by list.

**c. No deadline — terms drift arbitrarily far from intent.** A signature made under
March's rates, oracle prices, and collateral factors executes under June's. Even
without malicious replay, a relayer sitting on a signature for weeks and submitting
it at an adverse moment is a real failure mode.

**d. Signature malleability.** For any valid `(r, s, v)`, the pair
`(r, secp256k1n − s, v ^ 1)` recovers the same address. This is harmless today (the
signature is already infinitely replayable, so a second form changes nothing), but it
becomes a live bypass the moment someone "fixes" replay the tempting way — with a
`mapping(bytes32 => bool) usedSignatures` keyed on `keccak256(v, r, s)` or on the
signature bytes. That guard is defeated by the malleated twin for one free extra use.
**Key the replay guard on a nonce, never on a hash of the signature.** Enforce
`s <= 0x7FFF...A0` (secp256k1n/2) and `v ∈ {27, 28}` regardless.

**e. `ecrecover` returns `address(0)` on malformed input.** With a bad `v`, recovery
yields the zero address rather than reverting. The current check passes if
`borrower == address(0)` and the signature is junk — so any code path that lets the
zero address accrue collateral or debt is a free borrow for anyone. Probably
unreachable today; it is unconditionally wrong and costs one line to close.

**f. `DOMAIN_SEPARATOR` is frozen at deploy with `block.chainid` baked in.** This is
correct protection against cross-chain replay under normal conditions, but it fails
open on a chain split: after a hard fork, one side runs with a `chainid` that no
longer matches the cached separator, and signatures replay across the two chains.
Recompute the separator when `block.chainid` differs from the cached value.

**g. No cancellation path.** A user who suspects a signature is outstanding — exactly
this user, today — has no self-serve way to kill it. Your only lever is pausing the
function for everyone. That's a support burden and an incident-response gap.

**h. Nothing is bound but `borrower` and `amount`.** Not the recipient, not the
relayer, not the time. If `_borrow`'s destination ever changes in a refactor, the
signature silently starts authorising something the user never agreed to. Bind every
semantically relevant field into the struct so that changing the meaning requires
changing the typehash.

**i. No EIP-1271 support.** Safes and ERC-4337 accounts cannot use this path at all,
since `ecrecover` only understands EOA signatures. Not a vulnerability — a product
gap that will keep arriving as bug reports.

---

## 3. What we ship

### Phase 0 — today, before anything else

1. **Pause `borrowWithSig`.** Every signature in history is a live claim on
   collateral right now.
2. Run the enumeration in (2a); size the exposed set.
3. Determine `_borrow`'s fund destination and check for a follow-on liquidation of
   this user's position.

### Phase 1 — the fix

Add `nonce` and `deadline` to the signed struct, and **change the typehash string**.
The string change is itself the invalidation mechanism: every legacy signature
produces a different digest under the new code and dies on deploy, including the
unbroadcast ones from (2b) that you can't enumerate. Adding a nonce while keeping
`"Borrow(address borrower,uint256 amount)"` would leave old signatures valid for one
more use each — do not do that.

```solidity
bytes32 private constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
);

mapping(address => uint256) public nonces;

bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
uint256 private immutable _CACHED_CHAIN_ID;

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    return block.chainid == _CACHED_CHAIN_ID
        ? _CACHED_DOMAIN_SEPARATOR
        : _buildDomainSeparator();      // handles fork / chainid change
}

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    bytes calldata signature
) external {
    require(block.timestamp <= deadline, "expired");

    bytes32 structHash = keccak256(
        abi.encode(BORROW_TYPEHASH, borrower, amount, nonces[borrower]++, deadline)
    );
    bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), structHash);

    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

    emit BorrowAuthorised(borrower, amount, nonces[borrower] - 1, msg.sender);
    _borrow(borrower, amount);
}

/// user-callable kill switch for any outstanding signature
function invalidateNonce() external {
    emit NonceInvalidated(msg.sender, nonces[msg.sender]++);
}
```

Why each piece:

- **`nonces[borrower]++` inline in the struct hash** consumes the nonce on the
  success path only — a revert anywhere downstream rolls the increment back, which is
  the behaviour you want. Sequential nonces also mean signatures must be used in
  order, which is the right default for a borrow flow.
- **`bytes calldata signature`, not `(v, r, s)`.** Required for EIP-1271; contract
  wallet signatures aren't 65 bytes.
- **`SignatureChecker.isValidSignatureNow`** (OpenZeppelin) gets you three fixes in
  one call: it rejects non-canonical `s` and bad `v` (closes 2d), rejects
  `address(0)` recovery (closes 2e), and falls through to EIP-1271 for smart accounts
  (closes 2i). Do not hand-roll this.
- **`deadline` should be relayer-latency-sized** — 15–30 minutes, not days. Set the
  default in the signing frontend; consider rejecting `deadline > block.timestamp +
  1 hours` on-chain so a buggy or hostile client can't ask users to sign an
  effectively-eternal authorisation.
- **`invalidateNonce`** gives users the self-serve revocation they currently lack
  (closes 2g).
- **The event with borrower + nonce + `msg.sender`** is what makes the next ticket
  answerable from logs in five minutes instead of five days.

Optional, and I'd skip it: binding an expected relayer address into the struct. Once
nonces exist, a stranger submitting a valid one-shot signature is harmless. It only
appealed here because "unknown sender" made this incident hard to diagnose, and the
event field solves that more cheaply.

### Tests that must exist before deploy

- Same signature submitted twice → second reverts.
- Malleated signature (`s' = n − s`, `v` flipped) → reverts.
- Expired deadline → reverts.
- **The actual March signature against the new contract → reverts.** Use the real
  bytes from the June transaction as a fixture; this is the regression test for this
  ticket.
- `borrower == address(0)` with junk `(v, r, s)` → reverts.
- `invalidateNonce`, then a previously-signed valid signature → reverts.
- EIP-1271 wallet signature → succeeds.
- Same signature replayed N times in one transaction → reverts on the second.

### Phase 2 — remediation

Void the June debt, release the collateral, waive accrued interest. Repeat for
anyone else in the exposed set from (2a), and reimburse any liquidation losses
traceable to a replay.

---

## 4. Draft reply to the user

> Thank you for the detail in your report — it was decisive, and your read of the
> situation is correct.
>
> Your key was not compromised, and nothing on your device or in your wallet needs to
> change. The June borrow used the signature you created in March. Our contract
> should have retired that signature once it was used; it did not, because we omitted
> a one-time value that would have made it single-use. That left it valid
> indefinitely, and because the March transaction is public, anyone reading the
> blockchain could resubmit it. That is what happened.
>
> This is our defect. Concretely:
>
> - The June debt of 5,000 USDC is void and has been cleared.
> - Your collateral is released, with no interest charged.
> - We have paused signature-based borrowing while we deploy a fix.
> - The fix makes every signature single-use and time-limited. All previously created
>   signatures, including yours from March, will be permanently invalid once it is
>   live.
>
> There is no action needed on your part — in particular you do not need to rotate
> keys or move funds.

Send this only after Phase 0 step 3 confirms what happened to the collateral; if
there was a liquidation, the remediation figure changes and the message needs to say
so.

---

## Assumptions and open questions

1. **Where does `_borrow` send funds?** Determines whether this is griefing-plus-
   liquidation or outright theft, and changes severity and remediation. Blocking for
   the user reply.
2. **Is the contract upgradeable?** If not, the typehash change means a migration,
   and Phase 0's pause has to hold for its duration. If there is no pause on
   `borrowWithSig` at all, that is the more urgent gap.
3. **Are there other `*WithSig` entry points?** Repay, withdraw, collateral changes —
   if they share this construction, they share this bug, and the enumeration in (2a)
   needs to cover them too.
