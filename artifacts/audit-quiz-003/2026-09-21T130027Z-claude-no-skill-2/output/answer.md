# ArbiLend `borrowWithSig`: June borrow incident

## Short version for the user

The user is right. They authorised one borrow, and our contract let someone use that same authorisation a second time. Their key was not stolen and they did nothing wrong. This is a bug in our contract (a **signature replay**). We should cancel the June debt, or pay them back for it, and we should say clearly that the fault is ours.

## How the June borrow happened

The signed message is just `Borrow(borrower, amount)`. It has nothing that makes it single-use and nothing that makes it expire:

- **No nonce.** A nonce is a per-user counter that goes up each time a signature is used. Without one, the contract has no way to know whether a signature was already used.
- **No deadline.** The signature stays valid forever.
- **No record of used signatures.** Nothing is stored anywhere.

So the March `(v, r, s)` for `(user, 5000e6)` still recovers to the user today, and it will keep doing so. `borrowWithSig` is also `external` and has no caller check, so **anyone** can submit it, not only our relayer. The March transaction is public on-chain. Anyone could copy its calldata and send it again in June, and that is what the byte-identical signature shows happened. The check "recovered address == borrower" is correct. It proves the user signed *a* borrow of 5,000. It does not prove they signed *this* one.

## What else this exposes us to (not hit yet)

1. **Unlimited replays, not just one.** The same signature can be sent again and again. Each replay adds another 5,000 of debt, up to whatever limit `_borrow`'s health check allows. An attacker can push a victim right to the edge of liquidation and let a small price move liquidate them, then profit as the liquidator or just cause damage. This applies to **every signature anyone has ever given us**, even for positions repaid long ago. All of them are still live.
2. **Where the money goes.** Check `_borrow` now. If it sends the borrowed USDC to `msg.sender` (the relayer path), the June attacker **took 5,000 USDC** and the user is left with the debt. That is theft, not griefing, and anyone can repeat it against any past signer. If it sends to `borrower`, the user holds the 5,000 USDC and the harm is unwanted debt, interest and liquidation risk. Also, the signature does not name a receiver, so whoever submits it controls any part of the flow that uses `msg.sender`.
3. **Front-running.** Anyone watching the mempool (pending transactions) can take a signature meant for our relayer and submit it first, or submit it in a different context from the one the user expected.
4. **Signature malleability.** For every valid `(v, r, s)` there is a second valid one, `(v', r, n − s)`. Raw `ecrecover` accepts both. So if someone "fixes" this by storing used signature hashes, the attacker just sends the other form. The fix has to be a nonce, not a check on the signature bytes.
5. **`ecrecover` returns `address(0)` on bad input.** If `borrower == address(0)`, any garbage signature passes. Whether that matters depends on `_borrow`, but it should be rejected outright.
6. **Stale domain after a chain fork.** `DOMAIN_SEPARATOR` is computed once in the constructor. If the chain ever forks (the chain ID changes), signatures would be valid on both forks. This is minor next to the other items, but free to fix.

## Exactly what we ship

**Right now:**
- Pause `borrowWithSig`, or have it revert if the contract can be upgraded. Until then, every past signature can be used to add debt to its signer.
- Check `_borrow`'s receiver to tell whether funds were taken (item 2 above). Search the chain for other replayed `borrowWithSig` calls, meaning repeated `(borrower, amount, v, r, s)`, and contact those users too.
- Cancel or pay back this user's June debt and any interest charged on it.

**Contract fix:**

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA}  from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

bytes32 constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,address receiver,uint256 nonce,uint256 deadline)"
);

mapping(address => uint256) public nonces;

constructor(...) EIP712("ArbiLend", "2") { ... } // recomputes domain if chainid changes

function borrowWithSig(
    address borrower, uint256 amount, address receiver, uint256 deadline,
    uint8 v, bytes32 r, bytes32 s
) external {
    require(block.timestamp <= deadline, "expired");
    bytes32 structHash = keccak256(abi.encode(
        BORROW_TYPEHASH, borrower, amount, receiver, nonces[borrower]++, deadline
    ));
    address signer = ECDSA.recover(_hashTypedDataV4(structHash), v, r, s); // rejects high-s, reverts on address(0)
    require(signer == borrower, "bad sig");
    _borrow(borrower, amount, receiver); // funds go to the signed receiver, never msg.sender
}

// lets a user cancel any signature they gave out but don't want used
function invalidateNonce() external { nonces[msg.sender]++; }
```

What each part does:
- **`nonce`**: each signature works exactly once (fixes items 1 and 4).
- **`deadline`**: a signature that is lost or never used stops working on its own.
- **`receiver`**: the user chooses where the money goes, not whoever submits the transaction (fixes items 2 and 3).
- **OZ `ECDSA`**: rejects the second form of a signature and the `address(0)` result (fixes items 4 and 5).
- **OZ `EIP712`**: recomputes the domain if the chain ID changes. Moving to version `"2"` also means no old signature matches the new domain (fixes item 6).
- Front-ends and the relayer must read `nonces(borrower)` and sign the new struct.

The new struct and domain change what gets signed, so **every old signature stops working** as soon as this is live. Deploy it by upgrading the contract in place if it is upgradeable. If it is not, deploy a new contract, permanently disable the old entry point, and move users over. Add a test that submits the same signature twice and expects the second call to revert.
