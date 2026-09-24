# Explanation for the support ticket

The June borrow was possible because `borrowWithSig` accepts a valid signature but never consumes it.

The March signature was over only:

```solidity
Borrow(address borrower,uint256 amount)
```

So the message the contract verifies is effectively: "this borrower authorizes a borrow of 5,000 USDC from this contract on this chain." It is not: "this borrower authorizes exactly one borrow" or "this authorization expires after the March transaction."

Once the March relayed transaction landed, the signature bytes were public in calldata. Anyone could copy the March `(v, r, s)` and call `borrowWithSig(borrower, 5000e6, v, r, s)` again. The recovered address in June is genuinely the user's address because it is the same valid signature. The relayer operator can also be telling the truth: the June caller did not need the operator, the user's key, or any backend compromise. They only needed the old on-chain calldata.

From the user's perspective, they signed one borrow. From the contract's current rules, they created a reusable authorization for that same borrow tuple. That is the bug.

# Additional exposure

This is not limited to this one user.

Every historical `borrowWithSig` signature remains valid forever unless some other part of `_borrow` happens to reject it. Any signature that has ever appeared in calldata can be replayed by any address. The practical impact is repeated unwanted debt, interest accrual, loss of collateral through liquidation, liquidity drain, and support disputes where the chain shows a valid borrower signature even though the borrower did not intend a new loan.

The current authorization also has no expiry or cancellation path. A user cannot revoke an old signature, and repayment does not invalidate it. A signature from months or years ago can be reused when the user's collateral, prices, borrow limits, or protocol parameters have changed.

The signature is not bound to a relayer. That means anyone who sees or receives the signature can submit it. Even before the intended relayer submits, a third party can front-run with the same signature. If the product intends only approved relayers to submit gasless borrows, that is not expressed in the signed data or enforced in the function.

The signed struct only includes `borrower` and `amount`. If the market has multiple assets, receivers, rate modes, fee settings, collateral accounts, referral codes, or other borrow terms, those must be signed too. Anything not included in the struct is not user-authorized and may be changed by the caller or by later protocol state.

The direct `ecrecover` use is also fragile. Invalid signatures recover `address(0)`, so the function should reject zero borrowers and zero recovered signers. Raw `ecrecover` also permits signature malleability unless the `s` value is constrained; this especially matters if anyone tries to patch replay by marking raw signature bytes as used. Use OpenZeppelin `ECDSA` instead.

The domain separator is better than many broken examples because it includes `chainId` and `verifyingContract`, so normal cross-chain and cross-contract replay is mostly addressed. However, caching it once in the constructor can become wrong across a chain-id-changing fork. OpenZeppelin's `EIP712` implementation handles this correctly.

# What we should ship

First, disable the legacy `borrowWithSig` path immediately. If the contract is upgradeable, pause or remove that entry point. If it is not upgradeable, pause the affected market or migrate to a fixed market and stop accepting legacy signatures. There is no safe way to distinguish "the original intended use" from "a replay" under the current signature format.

Then ship a new signature scheme that includes a per-borrower nonce, an expiry, and the complete borrow terms:

```solidity
bytes32 private constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,address receiver,address asset,uint256 amount,uint256 nonce,uint256 deadline)"
);

mapping(address => uint256) public borrowNonces;

function borrowWithSig(
    address borrower,
    address receiver,
    address asset,
    uint256 amount,
    uint256 deadline,
    bytes calldata signature
) external {
    require(borrower != address(0), "bad borrower");
    require(receiver != address(0), "bad receiver");
    require(block.timestamp <= deadline, "signature expired");

    uint256 nonce = borrowNonces[borrower];

    bytes32 structHash = keccak256(abi.encode(
        BORROW_TYPEHASH,
        borrower,
        receiver,
        asset,
        amount,
        nonce,
        deadline
    ));

    bytes32 digest = _hashTypedDataV4(structHash);
    address signer = ECDSA.recover(digest, signature);
    require(signer == borrower, "bad sig");

    borrowNonces[borrower] = nonce + 1;

    _borrow(borrower, receiver, asset, amount);
}
```

Implementation requirements:

1. Use OpenZeppelin `EIP712` for the domain separator and `ECDSA` or `SignatureChecker` for verification. Use `SignatureChecker` if smart contract wallets must be supported.
2. Increment or otherwise consume the nonce before calling into borrow logic that may transfer tokens or make external calls.
3. Add a `cancelBorrowSig(uint256 nonce)` or `useNonce()` function so users can invalidate a pending signature without borrowing.
4. Include every user-approved borrow term in the typed data: at minimum borrower, receiver, asset or market id, amount, nonce, and deadline. Add rate mode, max fee, minimum received, collateral account, or relayer if those affect the user's obligation.
5. If only specific relayers should submit, include `relayer` in the signed struct and require `msg.sender == relayer`, or enforce an allowlist separately. Do not rely on relayer secrecy.
6. Do not patch this with `usedSignatures[keccak256(v,r,s)]`. Raw signatures are malleable. A nonce-based EIP-712 message is the correct primitive.
7. Add tests proving that the same signature cannot be used twice, cannot be used after its deadline, cannot be used with changed amount/asset/receiver, cannot be submitted by the wrong relayer if relayer binding is enabled, and cannot be bypassed with a malleated signature.

For this ticket, the accurate user-facing answer is: the June transaction was a replay of their March authorization made possible by a missing nonce and expiry in our gasless borrow design. Their key did not need to be compromised, and our relayer did not need to have sent the transaction.
