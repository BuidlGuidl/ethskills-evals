# ArbiLend `borrowWithSig` — replayable signature (root cause, blast radius, fix)

**Short version:** the user is right, your verification is right, and both facts are
compatible. `ecrecover` did exactly what it is supposed to do. The bug is that the
signed message never says *which* borrow it authorises, so it authorises all of them,
forever. This is unauthenticated debt issuance, not a key compromise. Nobody needs to
be blamed and nothing needs to be revoked — the March signature is a bearer instrument
that you minted and published yourselves.

---

## 1. How the June borrow was possible

Look at what is actually inside the digest:

```solidity
bytes32 structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount));
bytes32 digest     = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
```

Every input is a constant or an argument the caller supplies:

| field | value | varies per borrow? |
|---|---|---|
| `BORROW_TYPEHASH` | compile-time constant | no |
| `DOMAIN_SEPARATOR` | fixed at construction | no |
| `borrower` | the user's address | no |
| `amount` | `5_000e6` | no |

So `digest` is a pure function of *(borrower, amount)*. For this user and this amount
there is exactly **one** digest that will ever exist, and therefore exactly **one**
valid `(v, r, s)` — the one they produced in March. The contract has no concept of a
signature being "used". There is no nonce, no deadline, no consumption bookkeeping, no
record of prior redemptions. `borrowWithSig` asks "is this a valid signature over this
digest?" and never asks "have I already honoured it?"

That means the March signature is not an authorisation of *an* event. It is a
permanent, transferable coupon reading *"anyone holding this may open a 5,000 USDC
borrow against this user's collateral, an unlimited number of times, until the
contract dies."*

### Where the attacker got it

They did not steal it. They read it.

Calldata of a mined transaction is public, permanent, and trivially indexed. Your March
relayer transaction put `(v, r, s)` on-chain in plaintext where it will remain for the
life of the chain. Anyone running an indexer, scanning for `borrowWithSig` selectors, or
just eyeballing your contract in a block explorer had it from the moment that
transaction confirmed. In June they pasted those same 65 bytes into their own
transaction from their own EOA and paid their own gas.

This explains, precisely, every fact in the ticket:

- **`(v, r, s)` byte-identical to March.** Not a coincidence and not a collision — it is
  a literal copy, because it is the only signature that exists for this digest.
- **Recovered address is genuinely the user's.** Correct. `ecrecover` recovers the
  signer of the March message. It has no idea what year it is.
- **Your relayer didn't send it.** It didn't need to. `borrowWithSig` is `external`
  with no caller restriction; the signature *is* the authorisation, and it is public.
  Your relayer is not a trust boundary and never was.
- **Sender address you don't recognise.** Any address works. The attacker used their own.
- **User was on a flight; signed nothing since March.** Consistent. Their participation
  ended in March. Nothing about replay requires them to be online, awake, or alive.
- **No key compromised on either side.** Correct, and irrelevant. Replay needs no key.
- **They repaid in April.** Also irrelevant. Repayment touches loan accounting; it does
  not touch the signature, because the contract stores nothing about the signature to
  touch. The user's mental model ("I paid it back, so it's closed") is the correct model
  of a lending market and simply is not what this code implements.

### The part that should worry you more than the June event

The June borrow was not a one-shot. It is repeatable **right now**, in the same block,
in a loop:

```
for (;;) borrowWithSig(user, 5000e6, v, r, s);
```

The only thing stopping the attacker is your collateral factor / health-factor check
inside `_borrow`. So the real exposure per victim is not 5,000 USDC — it is *the entire
remaining borrowing capacity of that user's collateral, drained 5,000 at a time.*

And that suggests the actual monetisation, which is worse than theft of the borrowed
funds. An attacker who is also a liquidator can replay the signature to deliberately
push the position to the liquidation threshold, then liquidate it in the same
transaction and collect the liquidation bonus. The borrowed USDC is a bonus; the
victim's collateral is the target. A June attacker who only borrowed once was either
capacity-limited or was testing. Assume the next one is neither.

**This applies to every signature ever submitted to this function, from every user, for
as long as the contract is live.** Every historical `borrowWithSig` call is a live,
public, permanently redeemable coupon against that signer. This is not one bad ticket;
it is a standing liability across your whole signature history, and it grows every time
a new user signs.

---

## 2. What else this same construction exposes you to

Ordered by what I would fix first. Items 1–3 are live now; 4–6 are latent traps,
including two that will bite you *while you are fixing item 1* if you are not warned.

### 2.1 No expiry — signatures are immortal (live)

Even with the replay hole closed, there is no `deadline`. A signature that is produced
but not immediately submitted stays valid indefinitely, so a relayer (or anyone who saw
the sig in the mempool) can sit on it and redeem it at the moment that is worst for the
signer: after a rate spike, after the collateral price has fallen, right before a
liquidation cascade. The user consented to borrowing conditions in March, not to
whatever conditions happen to prevail whenever someone decides to cash in. A held
signature is a free option written against your users, and they are the short side.

### 2.2 Signature malleability (live, and a trap for the naive fix)

Raw `ecrecover` accepts high-`s` signatures. For any valid `(v, r, s)` there is a second
valid `(v ^ 1, r, n - s)` that recovers to the *same* address over the *same* digest.

Today this changes nothing, because unlimited replay already dominates. It matters
enormously tomorrow, because it defeats the fix most teams reach for first:

> "Let's just mark signatures as used: `mapping(bytes32 => bool) usedSig`, keyed on
> `keccak256(v, r, s)`."

That is bypassable. The attacker flips the malleable twin, gets a different key, and
replays exactly once more per signature. A used-signature registry keyed on signature
bytes is **not** a valid replay defence. Use nonces (see §3), which key on the *message*,
not on the encoding of the signature.

### 2.3 `ecrecover` returns `address(0)` on failure (live)

`ecrecover` returns `address(0)` for malformed input rather than reverting — e.g. `v`
outside {27, 28}. Your check is `ecrecover(...) == borrower`, so a call with
`borrower = address(0)` and any garbage `(v, r, s)` **passes the require**, with no
signature at all, and falls through to `_borrow(address(0), amount)`.

Whether that is exploitable depends on internals I can't see. If `address(0)` can ever
hold collateral, be credited, or be treated as a position, this is a second
authentication bypass sitting next to the first. Either way it is one `require` to
close and there is no reason to leave it open. Add the zero check *and* move to a
library that reverts.

### 2.4 Domain separator frozen at deploy → chain-fork and redeploy replay (latent)

You compute `DOMAIN_SEPARATOR` once in the constructor and cache it, capturing
`block.chainid` at that moment. If the chain ever forks, the fork inherits your bytecode
*and* your stale cached `chainId`, so every signature is simultaneously valid on both
chains. Users signing for one chain get borrows opened for them on the other. Given the
name, you're on an L2 — chain-id changes at reorg/fork/migration events are a real
operational hazard there, not a thought experiment.

Recompute the separator whenever `block.chainid` (or `address(this)`) differs from the
cached value. OpenZeppelin's `EIP712` does this for you; it is the reason the cache
check exists.

### 2.5 Every future signed action inherits this bug (latent, and the expensive one)

`borrowWithSig` is presumably not the last gasless action you ship. `repayWithSig`,
`withdrawWithSig`, `setDelegateWithSig` — each will be written by copying this function,
and each will copy the missing nonce with it. Fix the *pattern*, not the function: one
shared signing helper, one shared nonce space per account, and a lint/CI rule or review
checklist item that no `abi.encode(TYPEHASH, ...)` lands without a nonce and a deadline.

Two specific traps when you add the second action:

- **Give each action a distinct typehash.** You do this correctly today. Keep doing it —
  two actions with the same field layout and no distinct typehash are
  cross-redeemable.
- **Share one nonce counter per account across all actions.** Per-action counters look
  tidier and are strictly weaker: they let an attacker reorder a user's intents across
  action types.

### 2.6 No EIP-1271 support (limitation, not a vuln — but fix it in the same PR)

`ecrecover` only understands EOAs. Safe multisigs, smart accounts, and every 4337 wallet
cannot use `borrowWithSig` at all today. Since you're touching the signature path
anyway, route through `SignatureChecker` so contract wallets work. It costs one import
and closes a support-ticket category you'd otherwise open later.

---

## 3. What to ship

### 3.1 The code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

contract ArbiLend {
    // Nonce + deadline are part of the signed message. Distinct typehash from v1,
    // so every pre-existing signature is cryptographically dead on arrival.
    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    /// One shared counter per account, across every signed action.
    mapping(address => uint256) public nonces;

    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    address private immutable _cachedThis;

    event BorrowedWithSig(address indexed borrower, uint256 amount, uint256 nonce, address relayer);
    event NoncesInvalidated(address indexed account, uint256 newNonce);

    constructor(/* ... */) {
        _cachedChainId = block.chainid;
        _cachedThis = address(this);
        _cachedDomainSeparator = _buildDomainSeparator();
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256("ArbiLend"),
            keccak256("2"),            // version bump: belt-and-braces kill of all v1 sigs
            block.chainid,
            address(this)
        ));
    }

    /// Recomputed if the chain forks or the code is delegatecalled from elsewhere.
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        if (block.chainid == _cachedChainId && address(this) == _cachedThis) {
            return _cachedDomainSeparator;
        }
        return _buildDomainSeparator();
    }

    function borrowWithSig(
        address borrower,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature      // bytes, not (v,r,s): enables EIP-1271
    ) external {
        require(borrower != address(0), "zero borrower");
        require(block.timestamp <= deadline, "expired");

        // Post-increment consumes the nonce. If anything below reverts the whole tx
        // reverts, so the nonce is only burned on success.
        uint256 nonce = nonces[borrower]++;

        bytes32 structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));

        // Rejects high-s malleable sigs and the address(0) return; supports smart wallets.
        require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

        emit BorrowedWithSig(borrower, amount, nonce, msg.sender);
        _borrow(borrower, amount);
    }

    /// Lets a user revoke any outstanding signature they have issued but not yet seen redeemed.
    function invalidateNonces() external {
        uint256 n = ++nonces[msg.sender];
        emit NoncesInvalidated(msg.sender, n);
    }
}
```

Why each piece is there:

- **`nonce` in the struct** — the actual fix. Each signature now commits to one specific
  slot in a strictly increasing per-account sequence. Redeem it and the counter moves;
  replaying produces a digest for a nonce that no longer matches, so recovery yields a
  different address and the require fails. This keys on the *message*, so §2.2
  malleability cannot route around it.
- **`deadline`** — closes §2.1. Signatures become short-lived options, not perpetual ones.
  Have the frontend default to minutes, not days.
- **New typehash + version `"2"`** — changes the digest for every possible input, so all
  v1 signatures, including the March one still sitting in public calldata, are
  permanently unredeemable against v2. This is what makes the fix retroactive rather
  than merely prospective, and it is why you must not preserve v1 compatibility "for a
  transition period." There is no safe transition period.
- **`SignatureChecker`** — closes §2.3 and §2.6 in one line.
- **Dynamic `DOMAIN_SEPARATOR()`** — closes §2.4.
- **`invalidateNonces()`** — gives users unilateral revocation without needing you.
  Worth having the moment a user asks "how do I cancel that?", which they will now ask.
- **Event with `msg.sender`** — you could not answer "who redeemed this and when" from
  chain state during this incident. Fix that so the next ticket takes minutes.

### 3.2 Deployment sequence

Order matters. Every hour between disclosure and step 3 is an hour in which anyone who
has read the June transaction can replay any signature in your history.

1. **Pause `borrowWithSig` immediately, before anything else.** Every signature ever
   submitted is live right now. If there is no pause guard on this path, that is the
   emergency — ship a one-line guard first and treat the rest as follow-up.
2. **Enumerate the damage.** Index every historical `borrowWithSig` call and group by
   `(r, s)`. Any group of size > 1 is a confirmed replay. Groups of size 1 are *not*
   safe — they are unredeemed live coupons; they are your remaining exposure, and they
   are why step 1 is urgent. Also compute, per affected signer, the borrowing capacity
   still reachable via replay, so you know the worst case if you are wrong about
   containment.
3. **Deploy v2.** Proxy upgrade if you're upgradeable; otherwise deploy fresh, migrate,
   and permanently disable `borrowWithSig` on v1 — do not merely pause it, and do not
   leave a v1 with a live signature path reachable behind any admin key.
4. **Make users re-sign.** Unavoidable and correct: v1 signatures are dead by
   construction, which is the point. Update the frontend to fetch `nonces(borrower)` and
   include `nonce` + `deadline` in the EIP-712 payload. Users will see the extra fields
   in their wallet; that is a feature — the wallet can now show them a borrow that
   expires.
5. **Reconcile affected users.** Reverse the June debt and any others found in step 2.
   Treat as protocol loss, not user loss. The users did nothing wrong and there is no
   defensible reading in which they authorised these borrows.
6. **Regression tests, as required CI:** replaying a consumed signature reverts; the
   malleable twin `(v^1, r, n-s)` of a consumed signature reverts; an expired deadline
   reverts; `borrower = address(0)` with garbage sig reverts; a v1-format signature
   reverts against v2; `invalidateNonces()` kills an outstanding signature. The
   malleability and v1-format cases are the ones that catch a bad "fix" — do not skip
   them.

### 3.3 What to tell the user

Say plainly that they are right, because they are, and that this was your bug. They will
have gathered from your first reply that you suspected their key or their story; the
boarding pass tells you they expected not to be believed. Suggested text:

> You're right, and you don't owe us this money. We've reversed the June borrow and any
> interest accrued on it.
>
> The signature you created in March didn't have an expiry or a one-time-use marker in
> it, which is our error. That meant it stayed valid after you repaid in April, and
> because the signature is visible in the public transaction data from March, someone
> else was able to copy it and re-submit it in June. They never had your private key and
> nothing on your side was compromised — you did not need to be online, and the flight
> is not in question. Our contract should have refused a signature it had already
> honoured, and it didn't.
>
> We've paused gasless borrows, fixed the contract so each signature is single-use and
> expires, and are reviewing every past gasless borrow for the same issue. When we
> re-enable it you'll be asked to sign again; the new signature can only be used once,
> and you can cancel it at any time from your account page.

Two things not to say: don't call it "suspicious activity" or "an attack on your
account" — it was neither, and framing it that way tells them to rotate keys that are
fine. And don't call it an edge case. It is the default outcome of a signature scheme
with no nonce, and the only reason it took until June is that nobody had bothered before.

If other users turn out to be affected, disclose to them proactively rather than waiting
for tickets — the ones who never open a ticket are the ones who didn't notice, and the
liquidation path in §1 means some of them may have lost collateral without ever
connecting it to a signature they made months ago.
