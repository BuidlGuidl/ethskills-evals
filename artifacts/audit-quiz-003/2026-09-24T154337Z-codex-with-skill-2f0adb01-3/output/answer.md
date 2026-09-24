The June borrow was possible because the signed message is replayable.

The user did not sign "borrow 5,000 USDC once". They signed a typed message whose entire payload is only:

```solidity
Borrow(address borrower,uint256 amount)
```

For that borrower and that amount, the digest is the same forever on this contract and chain. The contract does not record that the March authorization was already used, does not include a nonce, and does not include an expiry. After the March transaction landed, the signature was public in calldata. Anyone could copy the byte-identical `(v, r, s)` and call `borrowWithSig(borrower, 5000e6, v, r, s)` again in June. `ecrecover` correctly recovered the borrower because the signature was genuine; the bug is that the same genuine signature remained valid for another borrow.

So the support answer is: this does not require the user to have been online in June, does not require their key to be compromised, and does not require our relayer to have sent the transaction. The March signature became a bearer authorization that any address could replay.

This same construction also exposes us to:

- Unlimited repeated borrows using any old valid signature, until the user's collateral or borrow limits stop it.
- Replays after full repayment, after the user's risk profile changes, or years later, because there is no deadline.
- Public calldata harvesting: every successful `borrowWithSig` reveals a reusable signature to the entire chain.
- Relayer trust-model breakage: the function is `external` and the signed payload does not bind an intended relayer, so "our relayer only" is not enforced on-chain.
- No user cancellation path. A user who realizes an authorization leaked cannot invalidate it except by changing keys or moving collateral, because there is no nonce/cancel mechanism.
- Signature malleability and edge-case risk from raw `ecrecover`. Today the incident used the exact same bytes, but raw `ecrecover` accepts malleable high-`s` signatures and returns `address(0)` for invalid inputs. If we later try to fix replay by storing used signature bytes, malleability can bypass that. Use a canonical ECDSA library instead.
- Fork/domain-separator staleness risk because the domain separator is cached at construction. It includes `block.chainid`, which is good, but a chain fork can make a cached separator stale. OpenZeppelin's EIP712 implementation handles this pattern correctly.

What we should ship:

1. Replace the signed type with a one-time authorization:

```solidity
bytes32 private constant BORROW_TYPEHASH =
    keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

mapping(address => uint256) public nonces;
```

Include every parameter the user cares about in the signed struct. At minimum that is `borrower`, `amount`, `nonce`, and `deadline`. If borrowed funds can be sent anywhere other than the borrower, include `receiver`. If this contract supports multiple assets or markets, include `asset`/`marketId`. If the UI promises a specific relayer, include `relayer` and require `msg.sender == relayer`, or enforce an on-chain trusted relayer allowlist.

2. Consume the nonce before executing the borrow:

```solidity
function borrowWithSig(
    address borrower,
    address receiver,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    require(block.timestamp <= deadline, "signature expired");

    uint256 nonce = nonces[borrower]++;

    bytes32 structHash = keccak256(
        abi.encode(
            BORROW_TYPEHASH,
            borrower,
            receiver,
            amount,
            nonce,
            deadline
        )
    );

    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(digest, v, r, s);
    require(signer == borrower, "bad sig");

    _borrow(borrower, receiver, amount);
}
```

Incrementing before `_borrow` prevents the same nonce being reused through reentrancy or nested execution. If `_borrow` reverts, the whole transaction reverts and the nonce increment reverts too.

3. Use OpenZeppelin `EIP712` and `ECDSA` instead of a hand-rolled cached `DOMAIN_SEPARATOR` and raw `ecrecover`. This gives canonical low-`s` signature handling, rejects invalid signatures cleanly, and recomputes the domain separator correctly when needed.

4. Add explicit cancellation:

```solidity
function cancelBorrowSig(uint256 newNonce) external {
    require(newNonce > nonces[msg.sender], "nonce too low");
    nonces[msg.sender] = newNonce;
}
```

That lets a user invalidate any outstanding off-chain borrow authorizations.

5. Treat the old signature scheme as compromised. Pause or disable the old `borrowWithSig` entry point, deploy/upgrade to the nonce-based version, and do not accept legacy `Borrow(address,uint256)` signatures again. Existing signatures under the old type cannot be made safe because the contract has no way to distinguish first use from replay.

For the user, the concise explanation is: their March signature was real, but our contract failed to make it single-use. The June transaction replayed the same public March authorization; it was a protocol bug, not evidence that the user borrowed again or that their key was compromised.
