The June borrow was possible because the signature authorizes a message, not a single execution.

The signed EIP-712 payload was only:

```solidity
Borrow(address borrower,uint256 amount)
```

For that borrower and `5000 USDC`, the digest is identical every time. The contract does not include a nonce, deadline, relayer, recipient, loan id, market id, or any "already used" state in the signed message or verification path. So the March signature remained valid after it was used once, after the loan was repaid, and after the original relayer was out of the picture.

Once the March borrow was submitted on-chain, `(v, r, s)` was public in calldata. Anyone who saw it later could copy the exact same signature into a new `borrowWithSig(borrower, 5000e6, v, r, s)` call. `ecrecover` correctly returned the user's address because the user really did sign that digest. The bug is that the digest did not say "this borrow authorization may be used once"; it said "this borrower authorizes this amount", forever.

So the user's statement is consistent with the chain data: they only signed once, their key does not need to have been compromised, and our relayer does not need to have sent the June transaction. The protocol accepted a replay of the original authorization.

What else this exposes us to:

1. Any borrow signature can be replayed indefinitely, as long as `_borrow` succeeds. A repaid loan can be reopened; an active position can potentially be increased multiple times until collateral or protocol limits stop it.

2. Any party can submit the signature. The current design does not bind the authorization to our relayer or to `msg.sender`. That may be intentional for permissionless gas abstraction, but it means every signature seen by any backend, wallet, browser, indexer, RPC provider, mempool observer, or chain-data reader is a reusable bearer authorization.

3. Signatures never expire. A signature from months or years ago remains valid if the borrower still has collateral and the market still exists.

4. If there are multiple markets inside the same verifying contract, or if `_borrow` has parameters not included in the signed struct, those unsigned choices can be changed by the submitter. The signed struct must cover every value that affects the user's debt, received assets, market, rate mode, recipient, or risk.

5. Raw `ecrecover` has edge cases. It permits malleable signatures unless we enforce low-`s`, and it returns `address(0)` for invalid signatures. If `borrower == address(0)` is not rejected elsewhere, an invalid signature could satisfy the equality check. Even if this specific path is blocked today, we should not keep raw `ecrecover` here.

6. The cached constructor `DOMAIN_SEPARATOR` is mostly protecting us against ordinary cross-contract and cross-chain replay because it includes `chainId` and `verifyingContract`, but it is still brittle around chain forks or chain-id changes. Use a standard EIP-712 implementation that recomputes or invalidates the separator correctly.

What we should ship:

1. Replace the signed type with a single-use, expiring authorization:

```solidity
bytes32 private constant BORROW_TYPEHASH =
    keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

mapping(address => uint256) public nonces;
```

If the protocol has multiple borrow assets, markets, collateral accounts, rate modes, or destination parameters, include those too. If only our relayer should be able to execute the authorization, include `address relayer` in the struct and require it to equal `msg.sender`, or add an explicit relayer allowlist. If any relayer is acceptable, do not bind `msg.sender`.

2. Consume the borrower's nonce during signature verification, before entering the borrow logic:

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
    require(borrower != address(0), "zero borrower");
    require(receiver != address(0), "zero receiver");
    require(block.timestamp <= deadline, "expired");

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

Use OpenZeppelin `EIP712` and `ECDSA` rather than hand-rolled domain and raw `ecrecover`. Incrementing before `_borrow` prevents reentrant reuse of the same nonce; if `_borrow` reverts, the whole transaction reverts and the nonce is not consumed.

3. Add tests for the actual incident:

- March signature succeeds once.
- Reusing byte-identical `(v, r, s)` reverts because the nonce has changed.
- Reuse after full repayment still reverts.
- Expired signatures revert.
- A signature for one amount, borrower, receiver, market, or asset cannot be used for another.
- Invalid or malleable signatures are rejected.

4. Treat all existing outstanding signatures as compromised/replayable. The current contract cannot distinguish "already used" from "not yet used" for old signatures, so the practical mitigation is to disable or pause the old `borrowWithSig` entry point, deploy/upgrade to the nonce-based version, and require users to re-sign under the new typed data. If upgradeability is not available, stop accepting gasless borrows on this market and migrate to a fixed contract.

The support answer to the user should be: the June transaction was a replay of their March authorization. Their signature was genuine, but our contract failed to make that authorization single-use or time-limited, so a third party could copy the public March calldata and open the same borrow again.
