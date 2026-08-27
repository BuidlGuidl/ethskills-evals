# ArbiLend `borrowWithSig` — replayable signature

## TL;DR

The signature is not a one-time authorisation. It is a **permanent bearer
instrument**, published in plaintext in March's calldata, redeemable by anyone,
an unlimited number of times, forever.

The user is right. Their key is fine, their signature was correct, our
verification is correct — and that is exactly the problem. `ecrecover` answers
"did this person sign this message?" It does **not** answer "is this
authorisation still unspent?" We never asked the second question, so nothing
ever marked the March authorisation as consumed.

This is our bug. The June debt should be voided.

---

## 1. How the June borrow was possible

The signed payload is:

```solidity
structHash = keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount));
```

Two fields: `borrower` and `amount`. Both are constants of the user's intent.
`DOMAIN_SEPARATOR` is `immutable`. So the digest is a pure function of
`(borrower, amount)` — **the same two inputs produce the same digest in March,
in June, and in 2031**. One valid `(v, r, s)` for that digest is valid for every
call, forever.

The verification consumes nothing:

```solidity
require(ecrecover(digest, v, r, s) == borrower, "bad sig");
_borrow(borrower, amount);   // no state written that would reject a re-submission
```

There is no nonce, no `used[digest]` mapping, no deadline. Nothing in storage
changes to distinguish "first use" from "second use."

The chain of events:

1. **March** — user signs `(their address, 5000e6)`. Our relayer submits it.
   The transaction succeeds, and **the 65 signature bytes become public,
   permanent, and world-readable** in that transaction's calldata. Anyone with
   an RPC endpoint or an Etherscan tab can copy them. They are as visible as the
   `from` address.
2. **April** — user repays. Their debt goes to zero and their borrow capacity
   against the collateral is restored. Repayment does *not* invalidate the
   signature; it just re-opens the room for it to be used again.
3. **June** — an arbitrary address copies the March calldata verbatim and calls
   `borrowWithSig` with the identical arguments. `ecrecover` recovers the user's
   address, because the user really did sign that digest. `require` passes.
   `_borrow` runs a second time.

This also explains the two facts that look suspicious but are not:

- **"Our relayer operator says they did not send it."** Correct, and expected.
  `borrowWithSig` is `external` with no access control on `msg.sender`. There is
  no "relayer" in the code — only in our mental model. Anyone is the relayer.
- **"The June transaction came from an address none of us recognise."** Also
  expected. The sender is unauthenticated and irrelevant to the check. The
  attacker needed no key, no privilege and no compromise — only the ability to
  read a public transaction.

The boarding pass is not needed. The on-chain evidence is conclusive on its own:
the June `(v, r, s)` is byte-identical to March's. A signature the user produced
in June would have identical `r` only with negligible probability (and if it
did, that would mean nonce reuse and a leaked private key — a different, worse
incident). Byte-identical means *copied*, not *re-signed*.

### Forensic step before you reply to the ticket

`_borrow(borrower, amount)` credits the **borrower**, so the 5,000 USDC most
likely landed in the user's own wallet, not the attacker's. Confirm this by
tracing the token transfer in the June transaction. It changes the shape of the
remedy and tells you the attacker's motive:

- **Funds went to the user's wallet.** The replayer gained nothing directly, so
  the payoff has to be downstream: forcing the user's health factor down to
  liquidate them and buy the collateral at the liquidation discount, or plain
  griefing. **Check for a liquidation of this user in June, successful or
  attempted, and check whether the liquidator is related to the replayer.** If
  so, the loss is larger than 5,000 USDC and this is a targeted attack, not
  opportunism.
- **Funds went anywhere else.** Then `_borrow` has a second, independent bug in
  its credit destination and it needs its own investigation.

State the trace result in the ticket. It is also the honest answer to the
question someone on your side will eventually ask — whether the user replayed
their own signature to manufacture a claim. If the USDC is sitting in their
wallet, the fair unwind is symmetric (below), and it does not require accusing
anyone: the contract permitted this, so intent does not change our liability.

---

## 2. What else this construction exposes, that has not bitten us yet

The replay is the presenting symptom. The underlying defect is that the signed
message **under-binds** — it commits to far less than it needs to. That produces
several more exposures from the same three lines of code.

### 2.1 The June borrow was not "one extra borrow." It is unbounded.

Nothing limits the replay to twice. The same signature can be submitted every
time the user's borrow capacity refills — after each repayment, after each
collateral top-up, after any price move that raises their LTV headroom. The only
ceiling is the collateral. A user who repays and re-collateralises can be drained
repeatedly with zero new signatures.

Worse, replays can be batched: if the user's collateral supports 20,000 USDC of
debt, an attacker submits the 5,000 signature four times **in a single
transaction** and takes the position straight to the liquidation threshold.

### 2.2 Every signature ever submitted to this function is live right now.

This is the part to act on today. This is not a historical incident — it is a
standing, open liability across the entire user base. Every `borrowWithSig`
transaction we have ever mined published a signature that is still redeemable
this minute. The set of live authorisations is exactly the set of signatures in
our own transaction history, and it is trivially enumerable by an attacker
(filter our contract's transactions by selector, decode the calldata). They do
not have to find the vulnerability; they only have to read our logs.

Assume every one of them is known to an adversary. Total exposure:

```
Σ over users:  floor(current_borrow_capacity(user) / signed_amount(user)) × signed_amount(user)
```

### 2.3 No expiry. A signature that was never used is still armed.

There is no `deadline`. Consider a user who signed a borrow, the relayer's
transaction reverted (gas spike, capacity full, market paused), and the user
walked away assuming the intent had lapsed. It did not. If that signature ever
leaked — relayer logs, a failed mempool transaction, an internal dashboard, a
support ticket screenshot, an ex-employee's laptop — it fires the moment their
collateral supports it. Intent expressed in March gets executed at June prices,
June interest rates, and a June market the user never evaluated.

**Failed transactions are public too.** A `borrowWithSig` transaction that
reverted still exposes its calldata to anyone watching the mempool or reading
the block. Reverted-and-forgotten signatures are live.

### 2.4 The user cannot revoke. There is no off-switch.

The user did the only thing available to them — stopped signing — and it did not
protect them. There is no `cancel`, no nonce to burn, no way to say "the March
authorisation is withdrawn." The only revocation mechanism today is withdrawing
all collateral, which is not revocation, just removing the thing being stolen.
For a user who wants to keep a position open, we offer nothing.

### 2.5 `ecrecover` returns `address(0)` on failure, and we compare it to a caller-supplied value.

```solidity
require(ecrecover(digest, v, r, s) == borrower, "bad sig");
```

For a malformed signature — `v` outside `{27, 28}`, or `r`/`s` out of range —
`ecrecover` does not revert. It returns `address(0)`. Since `borrower` is an
unvalidated function parameter, an attacker calls:

```solidity
borrowWithSig(address(0), amount, 0, bytes32(0), bytes32(0));
```

and `require(address(0) == address(0))` **passes with no signature at all**. The
call reaches `_borrow(address(0), amount)`.

Whether that mints free debt or merely corrupts accounting depends on `_borrow`
(which I do not have). Either way it is a check that can be satisfied without a
key, and it must not be reachable. This is the single most common way a
hand-rolled `ecrecover` check becomes a total authentication bypass, and it is
present here.

### 2.6 Signature malleability.

secp256k1 signatures come in pairs: `(v, r, s)` and `(v ^ 1, r, n - s)` recover
to the same address for the same digest. Anyone can convert one into the other
without the private key.

This has not hurt us yet because we do not deduplicate. But it is a trap for the
fix: **do not patch this by storing `keccak256(v, r, s)` or the raw signature
bytes in a "used" mapping.** An attacker flips `s` and produces a different key
for the same authorisation, walking straight through the replay guard. Any
uniqueness must be keyed on a **nonce inside the signed struct**, never on the
signature bytes.

It also silently breaks off-chain defences. If you build monitoring or a relayer
dedup cache keyed on signature bytes as a stopgap, it is bypassed by a one-line
transformation.

### 2.7 The cached `DOMAIN_SEPARATOR` breaks on a chain split.

`DOMAIN_SEPARATOR` is computed once in the constructor and frozen, with
`block.chainid` baked in. `chainId` is in EIP-712 specifically so that a hard
fork changes the domain and invalidates signatures on the forked chain. Caching
it defeats that: after a split, `block.chainid` changes but our stored separator
does not, so every signature stays valid on **both** chains against duplicated
state. Given a chain named ArbiLend targets, this is not hypothetical — L2s
reorganise, migrate and fork.

(Cross-chain replay to a *different* chain is already blocked, since the March
chain's id is baked into the digest. It is specifically the fork case that is
open.)

### 2.8 The signature does not name who may submit it, or when.

Even after we add a nonce, `msg.sender` remains unauthenticated, so the
*attacker chooses the moment of execution*. They can front-run our relayer and
land the borrow at a worse oracle price, at a rate spike, or immediately before
a liquidation cascade — all with a signature that is otherwise perfectly valid
and single-use. The user authorised *what*, never *when* or *by whom*.

### 2.9 The struct does not bind the market.

`Borrow(address borrower, uint256 amount)` names no asset, no market, no
interest-rate mode, no maximum acceptable borrow rate. If ArbiLend ever lists a
second market or a second collateral type on this contract, a signature intended
for one is valid for another. Fix the schema now, while there is only one
market and one version bump to spend.

---

## 3. What we ship

### Phase 0 — today, before anything else

1. **Pause `borrowWithSig`.** Not because of the June incident, but because
   §2.2 means the bleed is ongoing. Leave `borrow` (the direct, `msg.sender`
   path) and `repay` up so users are not trapped.
2. **Enumerate every live authorisation.** Filter all historical transactions to
   our contract for the `borrowWithSig` selector, decode
   `(borrower, amount, v, r, s)`. That list *is* the set of outstanding bearer
   instruments. Compute the §2.2 exposure figure. It is the number that goes in
   the incident report.
3. **Find the other replays.** Group historical calls by
   `keccak256(borrower, amount)`. Any group with more than one entry is a
   replay we have not noticed yet. Also normalise `s` (§2.6) before grouping, in
   case anyone flipped it. Check each affected user for liquidations in the
   window.
4. **Notify affected users.** Everyone who ever used `borrowWithSig` is exposed,
   not just the ticket filer.

### Phase 1 — the contract fix

Four things must change together. A nonce alone is not sufficient: if the
typehash and domain stay the same, legacy digests remain producible and the
March signature would still validate against nonce 0.

- Add `nonce` and `deadline` to the struct (changes the typehash).
- **Bump the domain version `"1"` → `"2"`.** This is the clean kill switch for
  every legacy signature at once — the domain separator changes, so all old
  digests become unproducible. Far more reliable than blacklisting individually,
  and it costs nothing.
- Recompute the domain separator when `block.chainid` changes (§2.7).
- Replace raw `ecrecover` with a checked recover (§2.5, §2.6).

```solidity
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

bytes32 private constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline,address relayer)"
);

bytes32 private constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
uint256 private immutable _CACHED_CHAIN_ID;

mapping(address => uint256) public nonces;

event BorrowAuthorisationUsed(address indexed borrower, uint256 nonce, bytes32 digest);
event NoncesInvalidated(address indexed borrower, uint256 newNonce);

constructor(...) {
    _CACHED_CHAIN_ID = block.chainid;
    _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator();
}

function _buildDomainSeparator() private view returns (bytes32) {
    return keccak256(abi.encode(
        DOMAIN_TYPEHASH,
        keccak256("ArbiLend"),
        keccak256("2"),          // version bump: voids every pre-fix signature
        block.chainid,           // re-read, not frozen
        address(this)
    ));
}

// EIP-712 requires the separator to track the live chain id (fork safety, §2.7)
function DOMAIN_SEPARATOR() public view returns (bytes32) {
    return block.chainid == _CACHED_CHAIN_ID
        ? _CACHED_DOMAIN_SEPARATOR
        : _buildDomainSeparator();
}

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    address relayer,          // address(0) == open to anyone
    bytes calldata signature
) external {
    require(borrower != address(0), "zero borrower");                 // §2.5
    require(block.timestamp <= deadline, "expired");                  // §2.3
    require(relayer == address(0) || relayer == msg.sender, "relayer"); // §2.8

    uint256 nonce = nonces[borrower]++;                               // §2.1 — consumed

    bytes32 digest = keccak256(abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR(),
        keccak256(abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline, relayer))
    ));

    // reverts on address(0), rejects high-s and bad v; supports ERC-1271 wallets
    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

    emit BorrowAuthorisationUsed(borrower, nonce, digest);
    _borrow(borrower, amount);
}

/// Lets a user revoke outstanding authorisations without touching collateral (§2.4)
function invalidateNonces(uint256 newNonce) external {
    require(newNonce > nonces[msg.sender], "not forward");
    nonces[msg.sender] = newNonce;
    emit NoncesInvalidated(msg.sender, newNonce);
}
```

Notes on the choices:

- **`SignatureChecker` over `ECDSA.recover`.** It does everything `ECDSA` does
  (reverts rather than returning `address(0)`, rejects `s > n/2` and `v ∉
  {27,28}`) and additionally accepts ERC-1271 signatures from smart-contract
  wallets. Those users are silently excluded today; adding support later would
  cost another migration. Do it in the same version bump.
- **`bytes calldata signature` over split `(v, r, s)`.** Required for ERC-1271,
  and it removes the split-parameter footgun.
- **Sequential nonces** are the simplest correct choice and give you
  `invalidateNonces` for free. If relayers need to hold several authorisations
  concurrently, switch to an unordered bitmap
  (`mapping(address => mapping(uint256 => uint256))`, Permit2-style) — it also
  allows cancelling one authorisation without invalidating the rest. Sequential
  first unless you know you need the bitmap.
- **`relayer` field.** `address(0)` preserves today's open behaviour; naming our
  relayer takes execution timing away from an attacker (§2.8). Recommended
  default: have the frontend put our relayer's address in it.
- **Add the market/asset field now** if a second market is anywhere on the
  roadmap (§2.9). Changing the typehash is free while we are already changing it.

### Phase 2 — migration

- Deploy fresh, or upgrade in place; either works, as long as the typehash **and**
  the domain version both change in the same release. Do not add nonces while
  leaving the old domain intact — legacy digests would still validate.
- Keep the old `borrowWithSig` permanently disabled. Never re-enable it.
- Frontend: users re-sign on next borrow. Old signatures are dead; that is the
  point.
- Publish an EIP-5267 `eip712Domain()` view so wallets display the new domain
  correctly.

### Phase 3 — tests that must exist before this ships

- Submit a valid authorisation twice → second call reverts. **This is the
  regression test for this ticket; write it first.**
- Borrow, repay in full, resubmit the same signature → reverts. (Reproduces
  March→April→June exactly.)
- Same signature four times in one transaction → reverts on the second.
- `deadline` in the past → reverts.
- `borrower = address(0)` with `v=0, r=0, s=0` → reverts. (§2.5)
- Malleable variant `(v ^ 1, r, n - s)` of a *consumed* signature → reverts.
- After `invalidateNonces`, a previously signed, unused authorisation → reverts.
- `relayer` set to address A, submitted by B → reverts.
- Fuzz `chainid`: separator changes when `block.chainid` changes; a signature
  made under the original chain id fails after the change. (§2.7)
- A signature carrying the **old** typehash/domain → reverts against the new
  contract.

---

## 4. What to tell the user

Plainly, and without asking them for anything further:

> The June borrow was not authorised by you, and your key was not compromised.
> Our contract had a flaw: it checked that your March signature was genuine, but
> never recorded that it had already been used. Your signature became public the
> moment your March borrow was mined — that is normal and unavoidable — and
> because we never marked it as spent, it stayed re-usable. When you repaid in
> April, that freed up the borrowing room again, and in June a third party
> copied the signature out of your March transaction and submitted it a second
> time. They needed nothing from you to do it. This is our defect, not yours.

Remedy:

- Void the June debt and all interest and fees accrued on it.
- Unlock the collateral and confirm in writing that no liquidation risk arose
  (or, if one did, make them whole for it — see the forensic step in §1).
- If the 5,000 USDC landed in their wallet, unwind symmetrically: they return
  the principal, we cancel the debt and eat the fees, interest and gas. Say this
  explicitly so it does not become a second dispute.
- Tell them their old signature is being permanently invalidated by the upgrade
  and they will re-sign once for their next borrow.
- They do not need the boarding pass. Say so — the chain data proves it by
  itself, and it closes the ticket without them having to defend themselves.

And the wider disclosure: everyone who has used gasless borrowing is in the same
position until Phase 1 ships. That notice should go out with the pause, not
after the fix.
