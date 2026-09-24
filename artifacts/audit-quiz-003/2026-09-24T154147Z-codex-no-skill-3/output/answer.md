The June borrow was possible because the signed message is replayable.

The March signature did not authorize "one borrow transaction"; on-chain, it
authorized the statement:

```solidity
Borrow({ borrower: user, amount: 5000e6 })
```

under this contract's EIP-712 domain. Since the struct contains no nonce, no
expiry, and no one-time-use state, that statement remains true forever. Anyone
who can see the March transaction calldata can copy the same `borrower`,
`amount`, `v`, `r`, and `s` into a later transaction. The recovered address will
still be the user's address, because the signature is genuine. No private key
compromise and no relayer compromise are needed.

So the user's account is consistent with the chain data: they signed exactly
one authorization, but our contract allowed that authorization to be consumed
more than once. The unknown June sender only needed the public March calldata.

This construction also exposes us to a few related failures that may not have
shown up yet:

1. Unlimited repeat borrows: the same signature can be replayed again and
   again until the user's account no longer has enough collateral or the market
   rejects the borrow.

2. Indefinite stale-signature execution: because there is no deadline, an old
   authorization can be used months or years later, after the user's collateral,
   health factor, rates, asset prices, or intent have changed.

3. Public relayer bypass: because `borrowWithSig` is `external` and does not
   bind or check a relayer, every submitted signature becomes a public bearer
   instrument. Any address can front-run, back-run, or replay it.

4. No cancellation path: if a user signs a borrow and changes their mind before
   it is mined, they have no nonce they can invalidate on-chain.

5. Signature-malleability footgun: raw `ecrecover` accepts both high-`s` and
   low-`s` forms unless we enforce canonical signatures. If we tried to patch
   this by marking `(v, r, s)` as used, a malleated equivalent signature could
   potentially bypass that exact-signature check. We should recover with a
   library that enforces low-`s` and valid `v`, such as OpenZeppelin `ECDSA`.

6. Missing zero-address hardening: `ecrecover` returns `address(0)` on invalid
   signatures. If `borrower == address(0)` is not rejected somewhere else,
   invalid signatures could pass the `require`. The borrow path should reject
   the zero borrower explicitly.

What we should ship:

1. Pause or disable the current `borrowWithSig` immediately. Existing
   signatures made under the old type must be treated as compromised bearer
   authorizations because anyone who has seen them can reuse them.

2. Add a per-borrower nonce to the signed struct and consume it atomically.

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
    require(borrower != address(0), "zero borrower");
    require(block.timestamp <= deadline, "expired");

    uint256 nonce = nonces[borrower]++;

    bytes32 structHash = keccak256(
        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
    );
    bytes32 digest = keccak256(
        abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
    );

    require(ECDSA.recover(digest, v, r, s) == borrower, "bad sig");

    _borrow(borrower, amount);
}
```

3. Use OpenZeppelin `ECDSA.recover` or equivalent checks instead of raw
   `ecrecover`, so malformed and malleable signatures are rejected.

4. Add an explicit cancellation/invalidation function, for example:

```solidity
function invalidateBorrowSigNonce(uint256 newNonce) external {
    require(newNonce > nonces[msg.sender], "nonce not increasing");
    nonces[msg.sender] = newNonce;
}
```

5. Consider binding any other user-relevant intent into the signed struct:
   asset/market if the contract can borrow multiple assets, receiver if funds
   can be sent somewhere other than `borrower`, max acceptable rate or mode if
   those can vary, and optionally an authorized relayer if we want only our
   relayer to submit.

6. Do not rely on `usedSignatures[v][r][s]` as the main fix. It blocks the exact
   byte-identical replay but is weaker than nonces, gives users no clean
   cancellation model, and is dangerous unless signature malleability is also
   handled correctly.

7. Use a new typehash and update the client/relayer signing flow to fetch and
   display the current nonce and deadline. Old signatures must not validate
   against the patched code.

8. Add regression tests that prove: the same signature cannot be used twice;
   an expired signature fails; an invalidated nonce fails; high-`s` or otherwise
   malformed signatures fail; `borrower == address(0)` fails; and, if we bind a
   relayer, submission from any other address fails.

What to tell the user:

The June transaction was not proof that they signed again or that their key was
stolen. Their March signature was valid, but our contract failed to make that
authorization single-use. Because the original signature appeared in public
transaction calldata, a third party could replay it in June and the contract
would accept it as valid. This is a protocol replay bug in the gasless borrow
authorization flow, and the correct fix is to add nonces, expirations, canonical
signature recovery, and cancellation for signed borrows. We should treat the
June debt as caused by our replay bug rather than as user error or a key
compromise.
