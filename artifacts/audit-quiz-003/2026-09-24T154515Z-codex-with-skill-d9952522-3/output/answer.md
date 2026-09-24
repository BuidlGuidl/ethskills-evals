# What happened

The June borrow was possible because the signed message is reusable.

The user did sign a valid EIP-712 authorization in March:

```solidity
Borrow(address borrower,uint256 amount)
```

For that user and `5,000 USDC`, the digest is exactly the same every time. The contract does not include a nonce, deadline, cancellation state, or “already used” marker in the signed data or in storage. It only asks: “does this signature recover to `borrower` for this amount on this contract/domain?” In June, the answer was still yes.

Once the March transaction was mined, the `(v, r, s)` was public calldata. The June sender did not need the user’s key and did not need access to our relayer. They only needed to copy the March signature and call `borrowWithSig` again. The fact that the user repaid in April does not invalidate the old signature, because repayment updates debt accounting, not signature authorization state.

So the user is right: they authorized one borrow in the ordinary human sense, but the contract treated their signature as an authorization for unlimited identical borrows.

# Other exposure

This same construction exposes us to more than this one June replay:

1. **Unlimited replay of the same borrow**

   The same signature can be submitted repeatedly until `_borrow` fails due to collateral, liquidity, caps, pause state, or some other limit. A single leaked or previously submitted signature can keep reopening debt.

2. **Anyone can submit the signature**

   `borrowWithSig` is `external` and the signature does not bind an intended relayer or executor. That may be desirable for gas abstraction, but it means any address that sees the signature can choose when to execute it.

3. **No expiry**

   A signature from March is still valid in June, next year, or whenever the market state makes execution attractive. Users have no way to express “valid only for the next 10 minutes” or “only while this quote is current.”

4. **No cancellation path**

   If a user signs and then changes their mind, or suspects a signature leaked, there is no nonce they can invalidate.

5. **Mempool/front-run replay**

   If a user gives a signature to our relayer, anyone who obtains it from logs, calldata, an API leak, a browser extension, or the mempool can submit it first or submit it again later.

6. **Raw `ecrecover` edge cases**

   The code does not enforce lower-half `s`, valid `v`, or nonzero recovered signer. That is not the root cause of this incident, but it is still unsafe. Signature malleability can create alternate valid signatures for the same digest, which can break future “used signature bytes” mitigations. Invalid signatures can also recover `address(0)`, so we should explicitly reject zero borrowers/recovered addresses.

7. **Cached domain separator fork risk**

   The domain includes `chainId` and `verifyingContract`, which is good. But because `DOMAIN_SEPARATOR` is cached forever in the constructor, a chain fork or chain-id change can make old signatures valid in unintended fork contexts. Use OpenZeppelin's EIP-712 implementation or recompute the separator when `block.chainid` changes.

# What to ship

Ship a new `borrowWithSig` authorization format with a per-borrower nonce and deadline, verified with OpenZeppelin `EIP712` and `ECDSA`.

The signed type should be changed to something like:

```solidity
bytes32 private constant BORROW_TYPEHASH =
    keccak256("Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)");
```

Maintain nonce state:

```solidity
mapping(address => uint256) public nonces;
```

Verification should:

```solidity
function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    require(borrower != address(0), "invalid borrower");
    require(block.timestamp <= deadline, "signature expired");

    uint256 nonce = nonces[borrower];

    bytes32 structHash = keccak256(
        abi.encode(
            BORROW_TYPEHASH,
            borrower,
            amount,
            nonce,
            deadline
        )
    );

    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(digest, v, r, s);
    require(signer == borrower, "bad sig");

    nonces[borrower] = nonce + 1;

    _borrow(borrower, amount);
}
```

Important implementation details:

- Increment the nonce before calling `_borrow`, after signature verification, so reentrancy cannot reuse the same nonce.
- Use OpenZeppelin `ECDSA.recover` instead of raw `ecrecover`.
- Use OpenZeppelin `EIP712` / `_hashTypedDataV4` instead of a permanently cached constructor-only domain separator.
- Add a user-facing cancellation method such as `incrementNonce()` or `cancelNonce(uint256 nonce)` so users can invalidate outstanding signatures.
- Update the frontend/off-chain signer to display and sign `borrower`, `amount`, `nonce`, `deadline`, and the EIP-712 domain.
- Do not rely on `usedSignatures[keccak256(signatureBytes)]` as the primary fix. Raw ECDSA signatures are malleable unless strictly canonicalized, and nonce-based authorization is the standard, clearer control.

Optionally, if only our relayer should be able to execute a signature, add an `executor` or `relayer` field to the signed struct and require `msg.sender == executor`. If permissionless execution is intentional, leave it out; the nonce and deadline are still mandatory.

# Support response

Tell the user that their key does not appear to have been compromised. The June borrow used the same valid March signature, copied from public transaction calldata, and our contract mistakenly allowed that signature to be used more than once. The bug is in our signature authorization design: it lacked a nonce and expiry, so repayment did not retire the authorization.

We should treat the June borrow as an unauthorized replay enabled by the protocol, not as a new user authorization.
