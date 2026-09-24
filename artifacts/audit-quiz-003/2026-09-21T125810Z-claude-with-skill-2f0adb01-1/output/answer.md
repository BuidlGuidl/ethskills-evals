# ArbiLend `borrowWithSig`: how the June borrow happened, and the fix

## TL;DR for the ticket

The user is right. They signed one borrow, and our contract accepted that one signature twice. The bug is in our code. Their key was not stolen and they did nothing wrong. Close the ticket in their favour: remove the June debt and cover any interest, fees or liquidation losses it caused.

Before replying, check one thing in the June tx: **where did the 5,000 USDC go?**
- **If `_borrow` sends funds to `borrower`**, the user received 5,000 USDC they never asked for, and the attacker gained nothing. That was griefing (harm with no profit). The user's collateral was put at risk and they were charged interest. The simple fix is to let them repay with that USDC and refund the interest and any losses.
- **If `_borrow` sends funds to `msg.sender` or the relayer**, the attacker took 5,000 USDC and left the user with the debt. We owe the user the whole debt plus costs. This case is also far more urgent for everyone else (see below).

## 1. How the June borrow was possible

The signed message is `Borrow(address borrower, uint256 amount)` and nothing else. It has:

- **No nonce** (a one-time counter). Nothing records that a signature was already used. The contract checks "did `borrower` sign (borrower, 5000)?", and the March signature says yes every time it is shown.
- **No deadline.** The signature never expires.
- **No limit on who can submit.** `borrowWithSig` is `external` and does not check `msg.sender`, so any address can call it.

The March transaction's calldata (`borrower, amount, v, r, s`) has been public on-chain since March. In June, someone copied it and sent it again from their own address. `ecrecover` correctly returned the user's address, because the user really did sign those exact bytes. The check was never "did this user sign it?". The check that's missing is "has this signature already been used?".

This is a textbook **signature replay**. Every piece looks right on its own:
- the recovered address is genuine,
- no key leaked,
- the relayer is innocent.

## 2. What else this exposes us to (not yet exploited)

1. **Every borrowWithSig signature ever submitted can be replayed right now, again and again.** This is not a one-off. The same March signature can be sent 10 more times tomorrow, and so can the signature of every other user who ever used gasless borrow. An attacker can push any of these users to their borrow limit and get them liquidated. If funds go to `msg.sender`, the attacker simply drains them. **This is live until the function is paused.**
2. **Signature malleability** (two valid forms of the same signature). Raw `ecrecover` accepts both `(r, s, v)` and `(r, n−s, v^1)` for the same signature. A naive fix like "mark `keccak256(v,r,s)` as used" leaves a second valid signature per message, which can still be replayed once more. The fix has to track a **nonce per borrower**, not the signature bytes. It should also use OZ `ECDSA`, which rejects high-`s` values.
3. **`ecrecover` returns `address(0)` for garbage signatures.** A call with `borrower = address(0)` and junk `v,r,s` passes the `require`. Whether that matters depends on `_borrow(address(0), …)`, but it has to be checked explicitly.
4. **Chain fork replay.** `DOMAIN_SEPARATOR` is computed once, in the constructor. If the chain ever splits, both chains keep the same separator, and signatures replay on the other fork. OZ `EIP712` recomputes it when `block.chainid` changes.
5. **Proxy deployments.** If ArbiLend sits behind a proxy and `DOMAIN_SEPARATOR` is a storage variable set in the constructor, it only exists in the implementation's storage. The proxy reads `0`, so every proxy instance shares the same "domain", which allows replay across markets. If it is `immutable`, it is tied to the implementation's address, not the proxy's. Either way, the domain is wrong. Use an initializer or the OZ upgradeable `EIP712`.
6. **The signature doesn't bind the recipient, market or asset.** If there are several markets or assets, or funds go to `msg.sender`, whoever submits the signature decides where the value lands. The signed message should contain everything that determines the outcome.
7. **Sibling functions.** Any other `*WithSig` function built the same way (`withdrawWithSig`, `repayWithSig`, `setDelegate…`) has the same bug. A replayable **withdraw** means stolen collateral. Audit all of them.

## 3. What we ship

### Immediately (today)
- **Pause `borrowWithSig`** (and any sibling `*WithSig` function) using the pause or guardian role. If there is no pause and the contract can't be upgraded, pause the whole market or disable new borrows for it. Until then, every old signature can be replayed.
- Scan the chain for other duplicate `(borrower, amount, v, r, s)` submissions, and for the same signature in its flipped malleable form. Make every affected user whole.

### The code fix
Adding `nonce` and `deadline` to the typehash changes every digest. That automatically **kills every signature ever signed under the old scheme**. No migration is needed.

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA}  from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// behind a proxy: EIP712Upgradeable + __EIP712_init("ArbiLend", "2") in initialize()

contract ArbiLend is EIP712 {
    bytes32 public constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address => uint256) public nonces;

    constructor(...) EIP712("ArbiLend", "2") { ... }   // bump version

    function borrowWithSig(
        address borrower,
        address receiver,
        uint256 amount,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        require(block.timestamp <= deadline, "expired");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH, borrower, receiver, amount, nonces[borrower]++, deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);   // chainid-aware domain

        // reverts on address(0) / high-s / bad v
        require(ECDSA.recover(digest, v, r, s) == borrower, "bad sig");

        _borrow(borrower, receiver, amount);             // funds go where the borrower signed
    }

    // let a user kill a signed-but-unsubmitted authorisation
    function invalidateNonce() external { nonces[msg.sender]++; }

    function DOMAIN_SEPARATOR() external view returns (bytes32) { return _domainSeparatorV4(); }
}
```

What each change does:

| Change | Stops |
|---|---|
| `nonces[borrower]++` inside the signed hash | replay of the same signature (the June incident), and malleable duplicates, because the nonce is spent whichever `s` is used |
| `deadline` | signatures that stay valid forever |
| `receiver` in the signed hash | the submitter redirecting where funds go |
| OZ `ECDSA.recover` | `address(0)` recovery, high-`s` malleability |
| OZ `EIP712` / `_hashTypedDataV4` | fork replay (separator re-derived on chainid change); correct proxy domain when using the upgradeable variant |
| version `"2"` + new typehash | old March-style signatures become unusable |
| `invalidateNonce()` | users can cancel a signature they handed out but no longer want used |

Also:
- If there are multiple markets or assets per contract, add `market`/`asset` to the typehash.
- Update the frontend and relayer to sign the new typed data. They should read `nonces(borrower)` and set a short `deadline`, e.g. 30 minutes.
- Apply the same pattern to every other `*WithSig` function.
- Tests:
  - resubmitting the same calldata reverts,
  - the malleable `(r, n−s, v^1)` form reverts,
  - an expired deadline reverts,
  - `borrower = 0` with a junk signature reverts,
  - a signature for chain A reverts on a fork with a different chainid,
  - the proxy's `DOMAIN_SEPARATOR()` includes the proxy's address.

### Reply to the user (draft)
> You're correct: you authorised one borrow. The June borrow reused your March signature, which our contract wrongly allowed to be submitted a second time. That's a bug on our side, not a problem with your wallet or keys. We've disabled the affected function, we're shipping a fix that makes every signature usable only once and time-limited, and we are [cancelling the June debt / reimbursing X] including all interest and any losses. You don't need to do anything.
