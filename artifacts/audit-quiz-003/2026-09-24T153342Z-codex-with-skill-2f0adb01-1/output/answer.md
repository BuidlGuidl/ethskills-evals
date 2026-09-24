# What happened

The June borrow was a replay of the March authorization.

The signed EIP-712 message is only:

```solidity
Borrow(address borrower,uint256 amount)
```

For the same `borrower` and `amount`, the `structHash` is identical forever. The domain separator binds the signature to this chain and this contract, but it does not make the authorization single-use. There is no nonce, no deadline, and no consumed-signature state.

So once the March transaction was included on-chain, the signature was public in calldata. Anyone could copy the exact same `(v, r, s)` and call `borrowWithSig(borrower, 5000e6, v, r, s)` again. The recovered address is genuinely the borrower because the signature is genuine. That does not mean the borrower authorized the June borrow as a separate action; it means the contract interprets the same old authorization as still valid.

What to tell the user: their key did not need to be compromised, and our relayer did not need to be involved. The contract accepted a previously valid signature more than once. This is a protocol replay bug, not evidence that the user signed again.

# What else this exposes

Every historical `borrowWithSig` signature is a standing borrow authorization for that same `borrower` and `amount` until the contract stops accepting it. It can be replayed repeatedly, not just once, subject only to whatever `_borrow` and the user's collateral allow.

Because the caller is not signed or allowlisted, any address can relay the signature. That may be intended for gasless UX, but it means the signature is a bearer instrument once disclosed. Public calldata from the first borrow is enough.

Because there is no deadline, old signatures remain valid after repayment, after collateral prices change, after the user's risk tolerance changes, and indefinitely into the future.

Because the signed struct only contains `borrower` and `amount`, any borrow-relevant parameter not shown here is unsigned. If the real `_borrow` path lets the caller influence asset, recipient, rate mode, market id, referral, slippage, or similar terms, those must also be part of the signed typed data or fixed by the contract.

The raw `ecrecover` usage also leaves avoidable edge cases. Invalid signatures recover `address(0)`, and ECDSA signatures are malleable unless low-`s` is enforced. Do not patch this by storing used `(v, r, s)` bytes; a malleated signature can be byte-different while recovering to the same signer. Use OpenZeppelin `ECDSA` and nonce-based replay protection.

The cached constructor `DOMAIN_SEPARATOR` is mostly doing the right chain/contract binding today, but it is still weaker than OpenZeppelin's `EIP712` implementation because it does not rebuild the separator if the chain id changes after a fork. That is a latent cross-fork replay concern.

# What to ship

Ship a new signature scheme and disable the legacy one.

The typed data must include at least a per-borrower nonce and a deadline:

```solidity
bytes32 private constant BORROW_TYPEHASH =
    keccak256("Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)");

mapping(address => uint256) public borrowNonces;

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    bytes calldata signature
) external {
    require(block.timestamp <= deadline, "signature expired");
    require(borrower != address(0), "zero borrower");

    uint256 nonce = borrowNonces[borrower]++;

    bytes32 structHash = keccak256(
        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
    );

    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(digest, signature);
    require(signer == borrower, "bad sig");

    _borrow(borrower, amount);
}
```

Use OpenZeppelin `EIP712` for `_hashTypedDataV4()` and OpenZeppelin `ECDSA` for recovery. Increment or consume the nonce before calling `_borrow`, so reentrancy cannot reuse the same nonce.

If users need multiple outstanding signed borrows, use an explicit signed `nonce` plus a consumed-nonce mapping or bitmap:

```solidity
require(!usedBorrowNonces[borrower][nonce], "nonce used");
usedBorrowNonces[borrower][nonce] = true;
```

If only the protocol's relayer should be able to submit, also include `relayer` in the signed struct and require `msg.sender == relayer`, or enforce an on-chain relayer allowlist. If any address may relay, leave that open deliberately but treat signatures as public bearer authorizations.

Also add a cancellation path, for example `cancelBorrowNonce(uint256 nonce)` or `incrementBorrowNonce()`, so a borrower can invalidate an unused authorization. For gasless users, support a signed cancellation message with the same nonce rules.

Operationally:

1. Pause or disable the current `borrowWithSig` immediately.
2. Do not accept legacy `Borrow(address borrower,uint256 amount)` signatures again.
3. If the contract is upgradeable, upgrade in place and make the old entry point revert or route only to the new nonce/deadline scheme.
4. If it is immutable, deploy a new market or signature gateway and migrate users; the old method cannot be made safe without changing on-chain verification.
5. Treat the June debt as caused by replay acceptance in our contract. The right customer response is remediation of the unauthorized replayed debt, not telling the user their key was compromised.

