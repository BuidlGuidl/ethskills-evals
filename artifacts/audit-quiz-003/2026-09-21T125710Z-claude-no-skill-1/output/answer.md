# borrowWithSig: replayed March signature

## Short version for the user

You're right. You authorised one borrow. The contract has a bug: it never records that a signature was used, so anyone could take your March signature from the public chain and submit it again. Your key wasn't compromised, and you didn't sign anything new. The June debt is our fault. We'll cancel it, and we'll cover any interest, fees or liquidation loss it caused.

## How the June borrow happened

The signed message is only `Borrow(borrower, amount)`. Two things are missing from it:

- **A nonce** (a counter that makes each signature usable once).
- **A deadline** (an expiry time).

The contract also keeps no record of signatures it has already accepted. So `(borrower, 5000e6, v, r, s)` from March is a valid borrow approval **forever**, for any number of uses.

The March transaction's calldata is public. Anyone can copy `v, r, s` out of it and call `borrowWithSig` again, because the function doesn't check `msg.sender`. That's what the unknown address did in June:

- The same bytes recover the same address, so the check `ecrecover(...) == borrower` passes.
- The check itself is correct. It proves the user signed this message *at some point*. It doesn't prove they want it executed *now*, or more than once.

Once the user repaid in April, their collateral was free again, so `_borrow` let the replayed borrow through.

**Where did the 5,000 USDC go?** Check `_borrow`:

- **If it pays `msg.sender`:** the attacker took 5,000 USDC directly. That's theft, and the user is owed the debt cancelled, not just the funds returned.
- **If it pays `borrower`:** the USDC should be sitting in the user's wallet. The attacker gains little directly. The usual motive is to push up the user's loan-to-collateral ratio and then **liquidate** them for the liquidation bonus. Check whether the same address, or a linked one, liquidated them afterwards.

## What else this construction exposes (not hit yet)

1. **Every past `borrowWithSig` user is exposed right now.** Every signature ever submitted can be replayed at any time. That includes repaid loans and loans that are still open (replaying stacks a second debt on top). An attacker can do this in bulk and liquidate the positions that become unhealthy.
2. **Signatures never expire and can't be cancelled.** A signature a relayer received but never submitted is a standing loaded gun. Neither the user nor we can revoke it.
3. **Anyone can submit the borrow, at a time they choose.** Even a single use can be front-run or delayed until the market is bad for the borrower, for example just before a price drop so the borrower gets liquidated.
4. **Signature malleability.** Raw `ecrecover` accepts "high-s" signatures. Every signature has a second valid form: `s' = n - s`, with `v` flipped. If someone patched this by storing `usedSig[keccak256(v,r,s)]`, the attacker would replay once more with the flipped form. Any fix must be nonce-based, not based on the signature bytes.
5. **`ecrecover` returns `address(0)` for garbage input** instead of reverting. With `borrower = address(0)` the check passes. Today that probably reverts deeper in `_borrow` because address(0) has no collateral, but that's luck, not design.
6. **Chain fork replay.** `DOMAIN_SEPARATOR` is fixed at deploy time. After a chain split, both chains accept the same signatures, because the stored separator still contains the old `chainid`.
7. **Smart-contract wallets can't use this at all** (no EIP-1271 support). This limits who can use the feature; it isn't a security hole.

## What we ship

### Right now (before the fix is deployed)

- **Pause `borrowWithSig`** (or the whole market if it has no separate pause). Every historical signature can be replayed until then.
- **Scan all past `borrowWithSig` calls** for repeated `(borrower, amount, v, r, s)` values, or for the same signature bytes appearing in more than one transaction. The June case is probably not the only one.
- **Make affected users whole:** cancel the debt, and refund interest and any liquidation loss.

### Contract fix

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA}  from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ArbiLend is EIP712 {
    bytes32 public constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,uint256 amount,address receiver,uint256 nonce,uint256 deadline)"
    );

    mapping(address => uint256) public nonces;

    event NonceInvalidated(address indexed borrower, uint256 newNonce);

    constructor(/* ... */) EIP712("ArbiLend", "2") { /* ... */ }

    function borrowWithSig(
        address borrower,
        uint256 amount,
        address receiver,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        require(block.timestamp <= deadline, "expired");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH, borrower, amount, receiver, nonces[borrower]++, deadline
        ));
        // OZ ECDSA: rejects high-s and v not in {27,28}; reverts on address(0)
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s);
        require(signer == borrower, "bad sig");

        _borrow(borrower, amount, receiver);
    }

    /// lets a borrower kill any signature they've handed out but not yet used
    function invalidateNonce() external {
        emit NonceInvalidated(msg.sender, ++nonces[msg.sender]);
    }
}
```

What each piece fixes:

| Change | Fixes |
|---|---|
| `nonce` in the signed struct, incremented on use | replay (#1). Each signature works once, and malleated copies (#4) fail because the nonce has already moved on. |
| `deadline` | signatures that live forever (#2), and delayed submission at a bad moment (#3) |
| `invalidateNonce()` | lets users cancel signatures that haven't been used (#2) |
| `receiver` in the signed struct | the borrower decides where funds go. A relayer or attacker can't redirect them. |
| `ECDSA.recover` | high-s malleability (#4) and the silent `address(0)` result (#5) |
| OZ `EIP712` (`_hashTypedDataV4`) | recomputes the domain separator if `chainid` changes (#6) |
| version bumped `"1"` → `"2"`, and a new typehash | **every old signature becomes invalid automatically**, including the March one |

Optional:
- Add `address relayer` to the struct and require `msg.sender == relayer`. Then only our relayer can submit, which removes front-running and timing games entirely.
- Add EIP-1271 support (OZ `SignatureChecker`) if smart-contract wallets matter.

### Rollout

1. Deploy the fixed contract, or upgrade the existing one, with version `"2"`.
2. Make sure the old `borrowWithSig` entry point is **removed**, not just left in place next to the new one.
3. Update the front end and relayer:
   - sign the new struct;
   - read `nonces(borrower)` before asking the user to sign;
   - use a short deadline (for example 15–30 minutes).
4. Add a test that submits the same signature twice and expects the second call to revert. Add another test with the high-s form of a valid signature, also expecting a revert.
5. Unpause.
