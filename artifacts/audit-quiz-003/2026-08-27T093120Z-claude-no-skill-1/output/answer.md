# ArbiLend `borrowWithSig` — signature replay

**Verdict: the user is right. No key was compromised, your relayer is not lying, and your
signature check is not broken. The June borrow is a replay of the March signature, and the
contract authorised it. The debt is yours, not theirs.**

---

## 1. How the June borrow happened

The signed message is:

```solidity
keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount))
```

It commits to exactly two things: *who* and *how much*. It does not commit to *which borrow*.

So the digest for "borrower `0xUser`, amount 5000e6" is a **constant**. It was the same value in
March, it was the same value in June, and it will be the same value in 2030. There is exactly one
valid signature for it, the user produced it in March, and the contract has no memory that it was
ever used.

The chain of events:

1. March — user signs `(0xUser, 5000e6)`. Relayer submits. `ecrecover` returns `0xUser`. Borrow opens.
2. **That transaction's calldata is public.** `(v, r, s)` sat in a block, permanently readable by
   anyone with an RPC endpoint, an explorer tab, or a mempool scraper.
3. April — user repays. Repayment touches balances. It does not touch the signature, because the
   contract never recorded the signature in the first place. The authorisation is still live.
4. June — an unrelated address copies the 32+32+1 bytes out of the March transaction, calls
   `borrowWithSig(0xUser, 5000e6, v, r, s)` from their own EOA, pays their own gas. `ecrecover`
   returns `0xUser`, because it is a mathematically valid signature over that digest. `require`
   passes. `_borrow` runs. Fresh 5,000 USDC against the user's collateral.

Everything you observed follows: byte-identical `(v, r, s)` (it is a literal copy-paste), an
unrecognised sender (`borrowWithSig` is permissionless — `msg.sender` is never checked, so anyone
can be the relayer), your operator's denial (true), and a valid recovered address with no key
compromise (also true).

The boarding pass is irrelevant to the exploit and the user should not have to produce it. Signing
in March was sufficient. Being asleep on a plane in June does not stop a replay.

**Root cause: no nonce, no replay protection, no expiry.** This is the canonical EIP-712 mistake.
Compare `ERC20Permit`, which signs `(owner, spender, value, nonce, deadline)` — the `nonce` is
what makes each signature single-use, and it is missing here.

**This is not a one-off.** The attacker can call it again tomorrow, and the day after. The March
signature is an unlimited-use, never-expiring line of credit against that user's collateral,
callable by anyone on Earth, and it will stay that way until you change the contract. **The same is
true of every signature every user has ever produced for this market.** Every one of them is
sitting in public calldata right now, live.

---

## 2. Do this before you read section 3

1. **Pause `borrowWithSig` now** (or the whole market, if there is no granular pause). Every past
   signature is currently drainable. You are not doing incident analysis, you are bleeding.
2. **Enumerate the blast radius.** Pull every historical `borrowWithSig` call, decode calldata,
   group by `(borrower, amount)` — equivalently, group by `r`, which is unique per signature. Any
   group with count > 1 is a completed replay. Any group with count == 1 is a live, unexercised
   authorisation. Sum the `amount`s over distinct groups: that is your maximum outstanding exposure
   per user, per replay round, unbounded in the number of rounds.
3. **Check whether other users have already been hit** and have not noticed. They will not have
   noticed — the borrow looks legitimate from the outside.
4. **Watch for liquidations** triggered by replayed borrows. Those are the expensive ones: the
   collateral is already gone and you cannot un-liquidate it.

---

## 3. What the same construction also exposes, that has not bitten you yet

Six more issues live in the ten lines you sent. Fix them in the same deploy — you only get one
cheap window.

### 3.1 `ecrecover` returns `address(0)` on failure — and `address(0)` passes the check

```solidity
require(ecrecover(digest, v, r, s) == borrower, "bad sig");
```

For a malformed signature (`v` not 27/28, `r` or `s` out of range) `ecrecover` returns
`address(0)`. It does not revert. So a call with `borrower = address(0)` and garbage `(v, r, s)`
satisfies the `require` with **no signature at all** and reaches `_borrow(address(0), amount)`.

Impact depends entirely on `_borrow`. If it books debt to a `mapping` slot for `address(0)` and
transfers USDC out to the borrower, that is an unauthenticated mint of debt to a nobody and a free
withdrawal. If it reverts on a zero-collateral account, you got lucky. Do not rely on luck at the
callee — reject `address(0)` at the recovery site. This is the second-most-common `ecrecover` bug
after the missing nonce, and it is a total-loss bug when it lands.

### 3.2 ECDSA malleability — two valid signatures per message

For any valid `(v, r, s)`, the pair `(v ^ 1, r, n - s)` (where `n` is the secp256k1 curve order) is
also valid for the same digest and recovers the same address. So every signature has a twin that
nobody signed but anyone can compute.

Today this costs you nothing, because replay is already free — why forge a twin when the original
works? It matters *the moment you fix section 1 the wrong way*. The tempting minimal patch is:

```solidity
mapping(bytes32 => bool) usedSig;   // keyed on keccak(v,r,s) — BROKEN
```

Under that patch, mark the March signature used and the attacker flips `s`, submits the twin, and
replays exactly once more. The nonce-based fix in section 4 is immune (the digest itself changes
per borrow, so there is nothing to malleate into), but enforce canonical `s` anyway — it is two
lines, and it protects you if anything downstream ever keys on the signature bytes.

### 3.3 No deadline — the signature is a perpetual option written against your borrower

Even with a nonce, a signature with no expiry is an *option*, and the holder decides when to
exercise it. Concretely: the user signs, the relayer is slow or the user changes their mind, and
the signature sits in the mempool or in an attacker's pocket. Six months later ETH has dropped 40%,
the user's collateral ratio is at the edge, and the attacker submits the borrow — pushing the
position underwater and liquidating it. The user never revoked, because there was no way to revoke.

A `deadline` bounds the window. An explicit `invalidateNonces` lets a user close it early. You need
both — the deadline for the default case, the cancel for "I signed something and want it dead now,"
which is exactly what your ticket-raising user is going to ask for on the call.

### 3.4 The domain separator is frozen at deploy — chain-fork replay

`DOMAIN_SEPARATOR` is computed once in the constructor and stored. It bakes in `block.chainid` as
it was at deploy time. If the chain hard-forks into two chains with different chain IDs, the
contract on **both** chains keeps validating against the old ID, so a signature from one chain
replays on the other. Cache the chain ID alongside the separator and rebuild on mismatch — this is
what OpenZeppelin's `EIP712` does, and it is why it does it.

(`address(this)` is in the domain, so distinct deployments on the same chain are already separated.
That part is correct. Note it stops being correct behind a proxy if you ever compute the separator
in an implementation constructor rather than an initialiser — `address(this)` differs.)

### 3.5 The signed struct may not bind everything that matters — **confirm this one**

`Borrow(address borrower,uint256 amount)` binds who and how much. If ArbiLend is or ever becomes
**multi-asset**, it does not bind *which asset*. A signature for "5000 units" would then authorise
5000 units of the most expensive listed asset, not the USDC the user had in mind.

I cannot tell from what you sent whether the market is single-asset. If it is multi-asset, this is a
second critical, independent of the replay, and it changes the typehash again — so settle it before
you deploy. Same question for the fund recipient: if `_borrow`'s payout destination can ever differ
from `borrower`, it must be a signed field.

**Rule: every parameter that changes the economic outcome goes in the struct hash.** Anything left
out is chosen by whoever submits the transaction, and that is not the signer.

### 3.6 Smart-contract wallets cannot use this at all

`ecrecover` only validates EOA signatures. A Safe, or any 4337 account, has no private key and
cannot produce one. Not a vulnerability — a silent feature gap that will read as "gasless borrow is
broken for us" from your largest depositors. Route through EIP-1271 (`SignatureChecker`) and both
paths work.

---

## 4. What to ship

Single deploy, covering all of the above.

```solidity
// nonce + deadline are now part of the signed struct.
// NOTE: changing the typehash string changes every digest, which invalidates every
// signature ever issued under the old scheme. That is the point — it is the migration.
bytes32 private constant BORROW_TYPEHASH =
    keccak256("Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)");

bytes32 private constant _DOMAIN_TYPEHASH =
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

bytes32 private immutable _cachedDomainSeparator;
uint256 private immutable _cachedChainId;

mapping(address => uint256) public nonces;

event BorrowAuthorizationUsed(address indexed borrower, uint256 nonce, uint256 amount);
event NoncesInvalidated(address indexed borrower, uint256 newNonce);

constructor(/* ... */) {
    _cachedChainId = block.chainid;
    _cachedDomainSeparator = _buildDomainSeparator();
}

function _buildDomainSeparator() private view returns (bytes32) {
    return keccak256(abi.encode(
        _DOMAIN_TYPEHASH,
        keccak256(bytes("ArbiLend")),
        keccak256(bytes("1")),
        block.chainid,
        address(this)
    ));
}

// (3.4) rebuild if the chain forked under us
function DOMAIN_SEPARATOR() public view returns (bytes32) {
    return block.chainid == _cachedChainId
        ? _cachedDomainSeparator
        : _buildDomainSeparator();
}

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external whenNotPaused {
    require(block.timestamp <= deadline, "sig expired");          // 3.3

    uint256 nonce = nonces[borrower]++;                            // 1 — single-use

    bytes32 digest = keccak256(abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR(),
        keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline))
    ));

    _requireValidSignature(borrower, digest, v, r, s);

    emit BorrowAuthorizationUsed(borrower, nonce, amount);
    _borrow(borrower, amount);
}

function _requireValidSignature(
    address signer,
    bytes32 digest,
    uint8 v,
    bytes32 r,
    bytes32 s
) private view {
    // 3.2 — canonical (lower-half) s only; upper bound is n/2
    require(
        uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
        "malleable s"
    );
    require(v == 27 || v == 28, "bad v");

    address recovered = ecrecover(digest, v, r, s);
    require(recovered != address(0), "bad sig");                   // 3.1 — before the compare
    require(recovered == signer, "bad sig");

    // 3.6 — optional: if signer.code.length > 0, fall through to
    // IERC1271(signer).isValidSignature(digest, abi.encodePacked(r, s, v)).
    // OpenZeppelin SignatureChecker.isValidSignatureNow does all of the above.
}

// 3.3 — user-side kill switch. Burn one nonce, or jump past a batch.
function invalidateNonces(uint256 newNonce) external {
    require(newNonce > nonces[msg.sender], "non-increasing");
    nonces[msg.sender] = newNonce;
    emit NoncesInvalidated(msg.sender, newNonce);
}
```

Notes on the shape:

- **`nonces[borrower]++` before verification is safe.** A bad signature reverts and the increment is
  rolled back with everything else.
- **Sequential nonces force ordering.** If you need users to hold several authorisations at once and
  redeem them out of order, use an unordered bitmap (`mapping(address => mapping(uint256 => uint256))`,
  Permit2-style) instead. Sequential is simpler; pick it unless you know you need otherwise.
- **`whenNotPaused`** — you want the pause guard on this path permanently, not just for this incident.
- **Off-chain changes ship in lockstep**: the relayer and the signing frontend must read
  `nonces(borrower)`, include `nonce` and `deadline` in the EIP-712 payload, and update the type
  definition to match the new typehash string byte-for-byte. A mismatched type string produces a
  different digest and every signature silently fails to recover — test this against a real wallet
  before deploy, not just against ethers' hasher.
- **Consider a relayer allowlist** as belt-and-braces. It is a real reduction in censorship-resistance
  and it is *not* a fix — the nonce is the fix — but while you are reissuing signatures it removes
  the anonymous-submitter class of surprise. Drop it once you are confident.
- **Get the fix audited.** The bug class you just hit is the one auditors check first; a fresh pair
  of eyes on `_borrow` itself (does it validate collateral ratio? is it reentrancy-safe?) is worth
  the week, given that the signature layer turned out to be load-bearing and wasn't.

**Rollout:** pause → deploy fixed contract/upgrade → confirm every old signature now fails (the
typehash change guarantees it; verify on a fork with the actual March calldata) → update relayer and
frontend → unpause. If the contract is not upgradeable, migrate positions and never re-enable the
old one; leaving it live and unpaused re-opens the hole for anyone who still has collateral there.

---

## 5. What to tell the user

Tell them they are right, close the ticket in their favour, and eat the loss. The June borrow was
authorised by your contract. They did not authorise it, and the contract's inability to tell the
difference is your defect, not their negligence. Framing this as anything else will not survive
contact with a third party reading the calldata — the byte-identical `(v, r, s)` is the whole proof,
and it is public.

Concretely: void the June debt, restore the collateral to where it stood before it opened, and if
any of it was liquidated, make them whole in kind at pre-liquidation value. Do not ask for the
boarding pass.

Draft reply:

> Hi — we finished investigating, and the June borrow was not authorised by you. You're right that
> you only ever signed once.
>
> The cause is a flaw in our contract. The authorisation you signed in March was not marked as used
> after we processed it, so it stayed technically valid indefinitely. Signatures like yours are
> visible in public transaction data, and in June someone copied yours and submitted it a second
> time. Your keys were not compromised, nothing on your end went wrong, and there was nothing you
> could have done to prevent it.
>
> What we're doing:
> - The June debt is void. We've cleared it and restored your collateral. [adjust if liquidated]
> - We've paused gasless borrowing while we deploy a fix that makes every authorisation
>   single-use and time-limited, and that lets you cancel one at any time.
> - Any signature you have previously given us will stop working when the fix ships. You'll be asked
>   to sign again the next time you borrow — that's expected.
>
> We're sorry. This was our bug and our cost, and we should have caught it before it reached you.

If other users are affected — and section 2 will tell you — disclose to all of them, proactively,
before someone else finds it. Users who *don't yet know* they have a live replayable authorisation
are the ones most likely to be hit between now and your deploy, and they are the ones who will be
angriest about having been told late.
