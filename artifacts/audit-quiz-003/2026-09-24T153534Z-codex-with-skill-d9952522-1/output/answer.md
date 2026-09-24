# What happened

The June borrow was possible because the signed message is replayable.

The user did sign a valid EIP-712 authorization for:

```solidity
Borrow(address borrower,uint256 amount)
```

That message says only: "this borrower authorizes this amount." It does not say:

- this authorization can be used only once
- this authorization expires
- this authorization is for the March transaction
- this authorization is for our relayer only

Once the March borrow was submitted, the `(v, r, s)` became public in calldata. Anyone could copy those bytes and call `borrowWithSig(borrower, 5000e6, v, r, s)` again later. The June caller did not need the user's private key and did not need access to our relayer. They only needed the old public signature.

So the verification is doing exactly what the code asks it to do: it proves that the user signed that borrow message at some point. It does not prove that the signature has not already been used. Repaying in April cleared the debt, but it did not consume or invalidate the March authorization, because the contract has no nonce or used-signature state.

What we should tell the user: their account key does not need to have been compromised. This is a replay bug in our signature authorization design. The byte-identical June signature is consistent with a third party copying the March transaction calldata and replaying it after the user had repaid.

# What else this exposes us to

The same construction allows every previously signed borrow authorization to be reused indefinitely, by anyone who can see or obtain the signature.

Concretely:

- A signature for `5,000 USDC` can be replayed repeatedly until the account hits collateral, borrow-cap, liquidity, or health-factor limits.
- Replays can happen long after the user believes the action is finished, including after full repayment.
- Any address can submit the replay. The function is intentionally relayer-open, and the signature is not bound to `msg.sender` or a specific relayer.
- Attackers can time replays for maximum harm, for example after collateral value falls, before liquidation, or after the user tops up collateral.
- All old signatures are still live unless we explicitly invalidate the old signing domain or disable this entry point.
- There is no deadline, so signatures do not naturally age out.
- Raw `ecrecover` also leaves us exposed to signature malleability and zero-address edge cases. This incident used the byte-identical signature, but we should not build any future "used signature bytes" fix around raw `(v, r, s)` uniqueness. A malleated signature can recover the same signer with different bytes unless low-`s` validation is enforced.
- The domain separator is cached in the constructor. It includes `chainId` and `verifyingContract`, which is good, but a chain fork can make a cached separator stale. Use OpenZeppelin's EIP-712 implementation or recompute when `block.chainid` changes.

# What we ship

First, stop the bleeding:

- Pause or disable the current `borrowWithSig` path.
- Treat all signatures made under the old `Borrow(address borrower,uint256 amount)` type as unsafe.
- Invalidate the old signing domain before re-enabling gasless borrows. The cleanest way is a new typed-data version, for example domain version `"2"`, or a new verifying contract if the current one cannot change its domain.

Then ship a new authorization format with single-use nonces and expirations:

```solidity
bytes32 constant BORROW_TYPEHASH =
    keccak256("Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)");

mapping(address => uint256) public nonces;

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    require(block.timestamp <= deadline, "signature expired");
    require(borrower != address(0), "bad borrower");

    uint256 nonce = nonces[borrower]++;

    bytes32 structHash = keccak256(
        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
    );

    bytes32 digest = _hashTypedDataV4(structHash);
    address recovered = ECDSA.recover(digest, v, r, s);
    require(recovered == borrower, "bad sig");

    _borrow(borrower, amount);
}
```

Implementation requirements:

- Use OpenZeppelin `EIP712` for `_hashTypedDataV4`.
- Use OpenZeppelin `ECDSA.recover`, not raw `ecrecover`, so invalid and malleable signatures are rejected correctly.
- Consume the nonce before calling `_borrow`, so reentrancy cannot reuse the same nonce during execution.
- Include every user-controlled or economically meaningful field in the signed struct. If the real borrow flow has an asset, market id, rate mode, receiver, collateral account, referral code, or max fee, those fields must be signed too.
- If signatures are meant only for our relayer, add `address relayer` to the signed struct and require `msg.sender == relayer`. If the product goal is permissionless relaying, do not add this, but accept that anyone can submit a valid unused signature.
- Add a user-accessible nonce-cancel function, such as `incrementNonce()`, so users can invalidate outstanding signatures.
- Update the frontend and relayer to display and sign the new typed data, including nonce and deadline.
- Add tests proving that the same signature cannot be used twice, cannot be used after its deadline, cannot be malleated, cannot be used with changed fields, and cannot be replayed through the old entry point.

Do not fix this by storing `usedSignatures[keccak256(abi.encodePacked(v, r, s))]`. That is incomplete because signature bytes are not a canonical authorization identity. The authorization identity should be the borrower's nonce under the current EIP-712 domain.
