# borrowWithSig: what happened in June, what else is exposed, and the fix

## Short answer for the ticket

The user is right. They authorised exactly one borrow. Our contract accepted the same signature a second time. That is a bug in our contract. It is not their fault and no key was stolen. The June debt should be written off or paid by us. Their position should be protected from liquidation while this is sorted out.

Suggested wording:

> "Your March signature was valid for one borrow. Because of a flaw in our contract, a third party was able to submit that same signature again in June. You did not authorise the June borrow, and your keys were not compromised. We are removing the June debt, compensating you for any losses, and have disabled the affected function."

(Before sending, check where the June 5,000 USDC went. See point 3 below.)

## How the June borrow happened: signature replay

The signed message is only `Borrow(borrower, amount)`. Nothing in it makes a signature single-use or time-limited:

- **No nonce** (a per-user counter that goes up each time a signature is used). The March signature is still valid today.
- **No deadline.** It never expires.
- **Nothing is recorded as used.** `borrowWithSig` checks the signature and borrows. It never marks the signature as spent.
- **Anyone can call it.** There is no check on `msg.sender`.

The March transaction put `(borrower, amount, v, r, s)` into public calldata on-chain. Anyone can copy those bytes and call `borrowWithSig` again. `ecrecover` returns the user's address every time, because the user really did sign that exact digest, and the digest is identical in March, June, or any later month. "The recovered address is genuinely theirs" is true, and that is exactly the problem. A valid signature proves the user signed the message once. It does not prove they wanted it executed again.

The unknown sender's likely motive: extra debt pushes the position toward liquidation. The attacker (or a bot) then liquidates it and collects the liquidation bonus. Check whether a liquidation followed, or was attempted, from a related address.

## What else this same construction exposes us to

1. **Every past `borrowWithSig` is still live, for every user.** Each signature ever submitted can be replayed right now, as many times as collateral allows, not just once. An attacker can loop until the position is at max borrow, then liquidate it. This is a protocol-wide incident, not a one-user ticket.
2. **Repeatable, not one-off.** This user can be hit again tomorrow with the same bytes. Repaying the debt doesn't help, because it just frees room for another replay.
3. **Where do the borrowed funds go?** The signature doesn't name a receiver. If `_borrow` sends USDC to `msg.sender` (the relayer or caller) and not to `borrower`, this isn't just griefing. It is direct theft: anyone replays and keeps the 5,000 USDC. Check `_borrow` and the June tx's token transfers now. Even if funds go to the borrower today, sign the receiver explicitly so a future refactor can't break it.
4. **Signature malleability.** For any valid `(v, r, s)`, the pair `(v', r, n - s)` is also valid (flipped `v`, mirrored `s`). Raw `ecrecover` accepts both. If someone "fixes" replay by storing used signature hashes, the flipped signature bypasses that check. Nonces are the right fix, and we should use OZ `ECDSA`, which rejects high-`s` values.
5. **`ecrecover` returns `address(0)` on garbage input.** With `borrower = address(0)`, any junk signature passes `== borrower`. Whether that hurts depends on `_borrow`, but it should be rejected outright. OZ `ECDSA.recover` reverts in that case.
6. **Domain separator cached at deploy.** `block.chainid` is fixed in the constructor. After a chain fork, signatures stay valid on both chains. Also, if this contract sits behind a proxy, the constructor's `address(this)` is the implementation's address, not the proxy's, and the constructor never runs in the proxy's storage. Use OZ `EIP712`, which recomputes the separator if the chain id changes, and verify the proxy situation.
7. **No way to cancel.** A user can't revoke a signature they've handed to the relayer but that hasn't been submitted yet.
8. **No deadline.** A signature held by the relayer (or leaked from its queue) can be submitted months later, at a price and health state the user never agreed to.

## What we ship

### Immediately (today)

- **Pause/disable `borrowWithSig`** on the deployed contract (pause flag, guardian, or upgrade). As long as it's live, every historic signature can be replayed.
- **Scan all past `borrowWithSig` calls.** Find repeated `(borrower, amount, v, r, s)` tuples and any calls from non-relayer senders. Identify every victim, not just this one.
- **Freeze liquidations** of affected positions, or cover them, and write off or compensate the replayed debt.
- Confirm where the June funds went (point 3).

### Contract fix

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract ArbiLend is EIP712, Nonces {
    bytes32 public constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    // version bumped to "2": every old-format signature is dead on arrival
    constructor(/* ... */) EIP712("ArbiLend", "2") { /* ... */ }

    function borrowWithSig(
        address borrower,
        address receiver,
        uint256 amount,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        require(block.timestamp <= deadline, "expired");
        require(borrower != address(0), "zero borrower");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH, borrower, receiver, amount, _useNonce(borrower), deadline
        ));
        // ECDSA.recover: reverts on address(0), rejects high-s (malleable) sigs
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s);
        require(signer == borrower, "bad sig");

        _borrow(borrower, receiver, amount); // funds go to the signed receiver, never msg.sender
    }

    // lets a user kill any signed-but-unsubmitted borrow
    function invalidateNonce() external {
        _useNonce(msg.sender);
    }
}
```

What each piece does:

| Change | Closes |
|---|---|
| `nonce` in the signed struct and consumed via `_useNonce` | Replay (the June incident). Each signature works exactly once. |
| `deadline` | Stale signatures executing months later |
| `receiver` in the signed struct | Caller or relayer redirecting funds |
| OZ `ECDSA.recover` | Malleability, `address(0)` recovery |
| OZ `EIP712` (`_hashTypedDataV4`) | Cached chain id and fork replay; correct separator |
| Version `"1"` → `"2"` | Any old signature, even on a mistakenly reused path |
| `invalidateNonce()` | User can cancel a pending signature |

`Nonces` also exposes `nonces(address)` publicly, so the frontend and relayer read the current nonce before asking the user to sign.

### Also

- Update the frontend and relayer to the new typed data (receiver, nonce, deadline, version "2"). Use short deadlines, e.g. 30 minutes.
- Tests: replaying the same signature reverts; an expired deadline reverts; a flipped-`s` signature reverts; `borrower = 0` reverts; a wrong receiver reverts; a signature from chain A fails on chain B.
- Optionally support ERC-1271 (on-chain signature checks for smart-contract wallets) via OZ `SignatureChecker`.
- Get the change audited before re-enabling. Also check any other `*WithSig` or permit-style functions in the codebase for the same pattern (repay, withdraw, delegate).
