# ArbiLend `borrowWithSig`: the June borrow

## Short answer for the ticket

The user is right. They signed one borrow, and our contract let someone else use that same signature a second time. They did nothing wrong and no key was stolen. The June debt comes from a bug in our contract. We should cancel it and repay any interest, fees or liquidation losses that came from it.

## 1. How the June borrow happened

The signed message is `Borrow(address borrower, uint256 amount)`. That is all the signature covers. It says "this borrower agrees to borrow 5,000 USDC". It does not say which borrow, how many times, or until when.

- **No nonce.** A nonce is a one-time counter. Nothing in the signed message or in contract storage marks the signature as used. After the March borrow, the same `(borrower, amount, v, r, s)` still gives the same digest, and `ecrecover` still returns the user's address. The check passes again.
- **No deadline.** The signature never expires.
- **No caller restriction.** `borrowWithSig` is `external` with no check on `msg.sender`. Anyone can call it, not just our relayer.
- **The signature is public.** The March transaction's calldata is on-chain, so anyone could copy `(v, r, s)` from it.

So the unknown address copied the March calldata and sent it again in June. The verification "looks right" because it is right. It correctly proves the user signed that message. The problem is that one signature can be used forever.

**Check where `_borrow` sends the USDC.** If it sends it to `msg.sender` or the relayer, the attacker kept the 5,000 USDC, and this was theft. If it sends it to `borrower`, the user's wallet should show 5,000 USDC arriving in June. Then this was griefing (harm with no direct profit): it adds debt, interest, and a push toward liquidation. Also check whether anyone who liquidated this position is linked to the June sender. Either way the user is owed the same remedy, but the answer tells us whether funds were stolen.

## 2. What else this exposes us to

1. **Every signature ever submitted can be replayed right now, as often as collateral allows.** This affects every user, not only this one. The attacker can call it again tomorrow, for this user or any other, until each position hits its borrow limit. That forces users toward liquidation, and a liquidator can profit from it. **This is live.**
2. **Signatures in the mempool can be front-run.** A relayer's pending transaction can be copied and sent first with higher gas. Since `borrower` is inside the signed data, the copy still borrows for the right user. But if funds go to `msg.sender`, the front-runner takes them.
3. **Signatures never expire.** A signature the relayer never submitted (failed, dropped, or held back) can be used months later, at a time the borrower did not choose. The user has no way to cancel it.
4. **Chain fork replay.** `DOMAIN_SEPARATOR` is computed once in the constructor. If the chain ever forks, the cached value still holds the old `chainId`, so signatures work on both forks. OZ `EIP712` handles this: it rebuilds the separator when `block.chainid` changes.
5. **Signature malleability.** For any valid `(v, r, s)`, `(v', r, n - s)` is also valid, where `n` is the curve order. Raw `ecrecover` does not reject the "high-s" version. Replay makes this moot today. It matters once we add nonces if anything (indexers, relayer dedup, "already used" logic) is keyed by signature bytes instead of by nonce.
6. **`ecrecover` returns `address(0)` for bad input.** For example, when `v` is not 27 or 28. The contract does not reject a zero result, so `borrowWithSig(address(0), X, 0, 0, 0)` passes. Whether this is harmful depends on `_borrow` and whether `address(0)` can have collateral. Reject it anyway.
7. **The signature does not name the recipient, relayer or fee.** The borrower cannot control where funds go or who submits. This is fine only if `_borrow` always pays `borrower`. Otherwise it must be signed.

## 3. What to ship

### Immediately (before the fix)
- **Pause `borrowWithSig`** with a pause or guardian flag, or by upgrading to a version that reverts. Every past signature can be used against its signer until this is done. If the contract cannot be paused or upgraded, tell all users to reduce borrowing capacity (withdraw spare collateral, or repay so they are near the limit) and announce it.
- Scan the history for `borrowWithSig` calls whose `(borrower, amount, v, r, s)` matches an earlier call, or whose `s` is the high-s version of an earlier one. Every match after the first is a replay. Make every affected user whole, not just this one.

### The fix

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

contract ArbiLend is EIP712 {
    bytes32 public constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,uint256 amount,address receiver,uint256 nonce,uint256 deadline)"
    );

    mapping(address => uint256) public nonces;

    event NonceInvalidated(address indexed borrower, uint256 newNonce);

    // bump version: separates v2 sigs from v1 domain explicitly
    constructor(/* ... */) EIP712("ArbiLend", "2") { /* ... */ }

    function borrowWithSig(
        address borrower,
        uint256 amount,
        address receiver,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "expired");
        require(borrower != address(0), "zero borrower");

        uint256 nonce = nonces[borrower]++; // consume before external calls

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH, borrower, amount, receiver, nonce, deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash); // chainId-fork safe

        // ECDSA.recover inside: rejects high-s, bad v, zero address; also supports ERC-1271 wallets
        require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

        _borrow(borrower, amount, receiver); // funds go to signed receiver, never msg.sender
    }

    /// lets a borrower kill any outstanding signed-but-unsubmitted borrow
    function invalidateNonce() external {
        emit NonceInvalidated(msg.sender, ++nonces[msg.sender]);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
```

What each change fixes:

| Change | Fixes |
|---|---|
| `nonce` in the signed data plus `nonces[borrower]++` | Replay, including the June incident. Each signature works once. |
| `deadline` | Signatures lasting forever. Old signatures can't be held and used later. |
| `receiver` signed; `_borrow` pays it, never `msg.sender` | Front-running and relayer/copier theft |
| OZ `EIP712` `_hashTypedDataV4` | Stale domain separator after a chain fork |
| OZ `ECDSA` via `SignatureChecker` | High-s malleability, bad `v`, `address(0)` recovery. Also adds smart-wallet (ERC-1271) support. |
| `invalidateNonce()` | Gives users a way to cancel |
| New typehash plus domain version `"2"` | All old v1 signatures stop working automatically. Their digest no longer matches. |

If the contract uses a proxy, check the upgrade storage layout for the new `nonces` mapping. If it is immutable, deploy v2, move markets over, and remove v1 permanently. v1 stays exploitable while it holds positions with spare capacity.

Update the relayer and frontend to sign the new type. Read `nonces(borrower)` and set a short `deadline` (for example, 30 minutes).

### Tests to add before shipping
- Submit a signature, then submit the same one again. The second must revert.
- A high-s copy of a valid signature reverts.
- A signature after its deadline reverts.
- A signature from chain A reverts on chain B, and after a simulated fork (`vm.chainId` change).
- `v = 0` / garbage signature with `borrower = address(0)` reverts.
- A front-run by a different `msg.sender` still pays the signed `receiver`.
- `invalidateNonce()` makes a pending signature revert.

## What to tell the user

> You are correct: you authorised one borrow and only one. A flaw in our contract let a third party reuse your March signature in June without your involvement. It was not caused by anything you did, and your wallet was not compromised. We are cancelling the June debt and reimbursing any interest, fees, or liquidation losses it caused. The feature has been paused and a fix that makes every signature single-use and time-limited is being deployed.

(Only send the "paused / fix deployed" line once it is true.)
