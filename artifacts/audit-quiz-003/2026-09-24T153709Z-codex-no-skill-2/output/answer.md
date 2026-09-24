The June borrow was possible because the signed message has no freshness or
single-use property.

The user signed:

```solidity
Borrow(address borrower,uint256 amount)
```

For that user and that amount, the EIP-712 digest is the same forever on this
contract and chain. The contract checks only that the signature was produced by
`borrower`; it never checks whether that authorization has already been used,
whether it has expired, or whether it was meant to be submitted by a particular
relayer.

So the March transaction placed a valid `(v, r, s)` in public calldata. From
that point on, anyone could copy those bytes and call `borrowWithSig` again with
the same `borrower` and `amount`. After the user repaid in April, the old
signature was still valid. In June, the unknown address simply replayed the
March authorization. The recovered address being genuinely the user's address is
expected; this was not key compromise, it was a replay of a still-valid
authorization.

What to tell the user: they are right that they only authorized one borrow in
the ordinary sense, but the contract encoded that authorization as reusable. The
June borrow was accepted because our signature scheme failed to make the borrow
authorization one-time-use.

The same construction also exposes us to:

- Unlimited replay of the same signed borrow, until the account's collateral or
  risk limits stop it.
- Replay after repayment, as happened here, because repayment does not revoke
  old signatures.
- Submission by any address, not just our relayer, because `borrowWithSig` is
  permissionless and the relayer is not part of the signed message.
- Calldata harvesting: once a valid borrow is included on-chain, the signature is
  public and can be copied by bots or any observer.
- Signature malleability edge cases if we later try to mark raw signatures as
  used. `ecrecover` should be replaced with a library recovery function that
  rejects invalid `v` values and high-`s` signatures. The real replay fix should
  be nonce-based, not "used signature hash" based.
- Indefinite liability from old off-chain signatures. A signature from months or
  years ago remains executable if the account later has collateral again.

The fix we should ship is a new signed-borrow format with a per-borrower nonce
and an expiry, plus strict signature recovery. If we want the promise that only
our relayer can submit these, bind the relayer into the signed message as well.

Example:

```solidity
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

bytes32 constant BORROW_TYPEHASH =
    keccak256(
        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline,address relayer)"
    );

mapping(address => uint256) public nonces;

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    address relayer,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    require(block.timestamp <= deadline, "expired sig");
    require(relayer == address(0) || msg.sender == relayer, "wrong relayer");

    uint256 nonce = nonces[borrower];

    bytes32 structHash = keccak256(
        abi.encode(
            BORROW_TYPEHASH,
            borrower,
            amount,
            nonce,
            deadline,
            relayer
        )
    );

    bytes32 digest = keccak256(
        abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
    );

    address signer = ECDSA.recover(digest, v, r, s);
    require(signer == borrower, "bad sig");

    nonces[borrower] = nonce + 1;
    _borrow(borrower, amount);
}
```

Operationally, we also need to:

1. Stop accepting the old `Borrow(address borrower,uint256 amount)` signature
   path. It is not safely patchable without breaking replay.
2. Update the frontend, relayer, and signing prompt to include `nonce`,
   `deadline`, and, if desired, `relayer`.
3. Show the nonce and expiry clearly in the user-facing signing flow.
4. Consider adding a user-accessible nonce invalidation function, such as
   `cancelBorrowSig(uint256 newNonce)` or `invalidateBorrowNonces(uint256 count)`,
   so users can revoke outstanding off-chain authorizations.
5. Treat the June debt as caused by a protocol replay bug, not by user key
   compromise.

The essential invariant after the fix is: one successful signed borrow consumes
exactly one borrower nonce, so the exact same authorization cannot ever open a
second debt.
