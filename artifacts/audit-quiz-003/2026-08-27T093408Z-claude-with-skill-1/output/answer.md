# ArbiLend `borrowWithSig` — replayable borrow authorisation

**Verdict: the user is right. Nobody's key leaked, our relayer is not lying, and the
boarding pass is irrelevant. The June borrow required no action by the user and no
secret from anyone. `borrowWithSig` accepts the same signature an unlimited number of
times, and the March signature has been sitting in public calldata since March.**

Severity: critical. This is not one bad transaction — **every signature ever passed to
`borrowWithSig`, for every user, is a live borrow authorisation right now.** Pause the
function before reading the rest of this.

---

## 1. How the June borrow was possible

The bug is what the signed message *does not* contain.

```solidity
bytes32 constant BORROW_TYPEHASH = keccak256("Borrow(address borrower,uint256 amount)");
```

The struct binds two things: who borrows, and how much. That is the entire content of
the user's authorisation. It does not bind *which* borrow, *when*, or *how many times*.

The verification code is, in isolation, correct — that is exactly why it looks right to
you. `ecrecover` genuinely returns the user's address, because the user genuinely signed
`(borrower = them, amount = 5000e6)`. What the contract concludes from that is "this
address authorised a 5,000 USDC borrow." What it *should* conclude is "this address
authorised **one specific** 5,000 USDC borrow, the one back in March, which has already
happened." There is nothing in the digest that distinguishes those two statements, so
the contract cannot tell them apart, and it will keep answering "yes, authorised" every
time it is asked, forever.

The mental model to correct: **a signature is not a transaction.** A transaction has a
nonce and a sender, so the chain enforces once-only execution for you. A detached
signature has neither. It is a bearer instrument — a coupon. Whoever holds the bytes can
present them. And the bytes are not secret: the moment the March relayer transaction was
mined, `(borrower, amount, v, r, s)` became permanent public data in that transaction's
calldata.

So the June sequence was:

1. Someone scanned the chain for calls to `borrowWithSig` on our contract.
2. They ABI-decoded the arguments out of the March transaction's calldata.
3. They re-submitted the identical arguments from their own EOA, paying their own gas.

That is a ten-line script against public data. It needs no key, no compromise, no
insider, and no cooperation from our relayer. It explains every fact in the ticket
including the byte-identical `(v, r, s)` and the unrecognised sender — the sender is
unrecognised because `borrowWithSig` never checks `msg.sender` at all. Anyone can be the
relayer.

Repaying in April did nothing, because repayment does not touch the signature. If
anything it *helped* the attacker: it freed up the borrowing capacity the replay then
consumed.

### Why would anyone do this?

Note that `_borrow(borrower, amount)` credits the *borrower*, so the attacker received no
USDC directly. Two readings, and they are not mutually exclusive:

- **Probe.** Someone confirming the replay works before scaling it up. If so, we are
  ahead of the real attack by a matter of days.
- **Liquidation setup.** The profit is downstream. Forced debt against untouched
  collateral degrades the victim's health factor; the attacker then liquidates them and
  takes the liquidation bonus. Since replays are unlimited, this can be done atomically:
  replay the signature `k` times in a single transaction until the position is
  underwater, liquidate it in the same transaction, with flash-loaned capital and no
  price risk. The victim's own collateral pays the attacker's fee.

---

## 2. What else this construction exposes us to

Everything below is live today. The June incident used only the first item.

**a. Replay is unbounded, not one-shot.** There is no counter anywhere. A signature can
be replayed until the borrower's collateral is exhausted or the market runs dry —
including many times in one transaction, which is what makes the atomic
self-liquidation above work.

**b. Historic exposure is the sum of every past signature.** Index every
`borrowWithSig` call on this contract and you have the complete list of currently-valid
borrow authorisations. Aggregate worst case ≈ Σ over all users of min(their signed
amount × replays affordable against their collateral, available liquidity). Users who
signed for large amounts and still hold collateral are the immediate blast radius.

**c. Protocol-level, not just per-user.** Mass replay across many users drives utilisation
to 100%, spikes the borrow rate for everyone, and blocks lender withdrawals. That is a
denial-of-service on the whole market, achievable by a griefer with no capital.

**d. No expiry.** Even with a nonce added, a signature that was never submitted stays
valid forever. A user who signs, changes their mind, and never broadcasts has no way to
take it back. There is no cancellation path in the contract.

**e. `ecrecover` returns `address(0)` on failure.** `require(ecrecover(...) == borrower)`
passes when `borrower == address(0)` and the signature is garbage. Whether that is
exploitable depends on `_borrow`'s handling of the zero address (accounting corruption
at minimum), but the check itself is wrong regardless and must not survive the fix.

**f. Signature malleability.** For any valid `(v, r, s)` there is a second valid
`(v ^ 1, r, n - s)` recovering the same address. This matters chiefly as a **trap for
the obvious wrong fix**: "mark `keccak256(v, r, s)` as used" or "mark the digest as used"
does not work, because the attacker flips to the malleable twin and gets a fresh,
unseen key for the same authorisation. The replay guard must be keyed on a **nonce
inside the signed struct**, not on the signature bytes.

**g. Cached `DOMAIN_SEPARATOR`.** It is computed once in the constructor with
`block.chainid` baked in. If this chain ever hard-forks, the cached value keeps the
*old* chain id, so signatures stay valid across both forks — cross-chain replay in
exactly the situation EIP-712 includes `chainId` to prevent.

**h. The struct binds no asset, no receiver, no rate.** Today there is presumably one
market and funds go to the borrower. The instant we add a second asset, a `receiver`
parameter, or an upgrade, existing signatures silently gain new meanings. A signature
should authorise a fully-specified action, not a shape that later code fills in.

**i. Smart-contract wallets cannot use this at all.** Raw `ecrecover` means Safe /
4337 / any ERC-1271 wallet is excluded. Not a vulnerability, but fix it in the same
change since we are touching the verification path anyway.

**j. No relayer allowlist.** Not the root cause and not a substitute for the real fix,
but a trusted-relayer check would have made this attack noisy instead of silent, and is
worth having as defence in depth and as a monitoring hook.

---

## 3. What we ship

### Immediately (today, before the code fix)

1. **Pause `borrowWithSig`.** Guard-flag it or pause the contract. Direct `borrow` can
   stay up. Until this is off, the exposure in (b) is uncapped.
2. **Enumerate the exposure.** Index all historical `borrowWithSig` calls → the list of
   live replayable authorisations and the users at risk. Contact the high-exposure ones.
3. **Alert** on any `borrowWithSig` from a non-relayer `msg.sender`, so we know if it is
   attempted again during the window.

### The fix

Put a nonce and a deadline *inside the signed struct*, and fully specify the action.
Changing the typehash is deliberate: old signatures produce a different digest and are
dead by construction, so the entire historical backlog is invalidated for free. Bump the
EIP-712 `version` to `"2"` as well, belt and braces.

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

contract ArbiLend is EIP712 {                      // EIP712 base handles chain-id
                                                    // recomputation on fork (item g)
    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,address asset,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address => uint256) public nonces;

    constructor(...) EIP712("ArbiLend", "2") { ... }

    function borrowWithSig(
        address borrower,
        address receiver,
        address asset,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature      // bytes, not (v,r,s) — needed for ERC-1271
    ) external {
        require(block.timestamp <= deadline, "expired");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH, borrower, receiver, asset, amount, nonces[borrower]++, deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // SignatureChecker: reverts on address(0) recovery (item e), rejects high-s
        // malleable signatures (item f), and falls back to ERC-1271 (item i).
        require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

        _borrow(borrower, receiver, asset, amount);
    }

    /// Lets a user kill outstanding signatures they no longer want honoured (item d).
    function invalidateNonces(uint256 newNonce) external {
        require(newNonce > nonces[msg.sender], "non-increasing");
        nonces[msg.sender] = newNonce;
    }
}
```

Points worth being explicit about:

- `nonces[borrower]++` is read **and incremented** inside the same call that consumes it.
  The increment must happen before `_borrow` to be reentrancy-safe.
- Sequential nonces mean a user's pending signatures must be relayed in order, and one
  stuck signature blocks the rest. If we ever need out-of-order relay, switch to a
  bitmap nonce (`mapping(address => mapping(uint256 => uint256))`, word + bit, as
  Permit2 and Seaport do). Not needed for the current one-signature-at-a-time flow —
  flagging so we choose deliberately rather than discover it later.
- `deadline` should be minutes-to-hours in the signing UI, not `type(uint256).max`. An
  unbounded deadline re-creates item (d) with extra steps.
- Add the relayer allowlist (item j) as a separate, independently-togglable check. It is
  defence in depth; the nonce is the fix.

### Tests that must exist before this ships

- Replaying a consumed signature reverts. Replaying it twice in one transaction reverts.
- The malleable twin `(v ^ 1, r, n - s)` of a consumed signature reverts.
- A signature past its `deadline` reverts.
- `borrower == address(0)` with a garbage signature reverts.
- `invalidateNonces` kills a signed-but-unrelayed signature.
- A March-format signature (old typehash, old domain version) reverts against the new
  contract. **This is the regression test for the actual incident** — write it first.
- ERC-1271 wallet path accepts a valid contract signature and rejects an invalid one.

### Restitution and disclosure

- Void the June debt and any accrued interest on it. If any part of the position was
  liquidated, unwind it and make the user whole for the liquidation penalty — the fault
  is entirely ours.
- Do the same for any other user the index in step 2 turns up.
- Users must re-sign after the upgrade; their old signatures will no longer verify. Say
  so in the migration notice, and say *why* — it is the mechanism that closes the hole.
- Publish a disclosure. The replay is trivially rediscoverable from public calldata, so
  we gain nothing by being quiet and lose credibility if someone else finds it first.

---

## 4. Draft reply to the user

> Thank you for the report, and I'm sorry — you're right, and the fault is ours.
>
> You did not authorise the June borrow. What happened is a flaw in our contract, not in
> your wallet: the signature you created in March was recorded permanently in public
> transaction data, and our contract failed to mark it as already used. In June a third
> party copied that signature out of the public record and submitted it again. Our
> contract accepted it because it had no way to tell a fresh authorisation from a spent
> one. This required no access to your keys, no action by you, and no compromise on
> either side. Your wallet is secure and you do not need to rotate keys.
>
> We are voiding the June debt in full, along with all interest accrued on it, and
> restoring your collateral position to where it stood before. [If liquidated: we are
> also refunding the liquidation penalty in full.]
>
> We have disabled signature-based borrowing while we ship a fix. The fix makes every
> signature single-use and time-limited, and it invalidates all previously signed
> authorisations — including your March one — so this cannot recur. When it is live you
> will be asked to sign a new authorisation for any future gasless borrow.
>
> We'll follow up with a public write-up.

Do not tell the user the June transaction was "unauthorised access" or "suspicious
activity on their account." It was neither. Our contract authorised it, correctly, per
rules we wrote badly.
