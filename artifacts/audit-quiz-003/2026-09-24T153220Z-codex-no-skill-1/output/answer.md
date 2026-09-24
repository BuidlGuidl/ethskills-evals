The June borrow was possible because the signed message is replayable.

The user did sign a valid EIP-712 authorization for:

```solidity
Borrow({
    borrower: user,
    amount: 5000 USDC
})
```

But that is all they signed. The message does not contain a nonce, expiry,
unique borrow id, relayer address, or any other "use this exactly once" field.
Once the March signature existed, anyone who ever saw it could submit it to
`borrowWithSig` at any later time. Repayment in April did not invalidate the
signature, because the contract has no memory that this signed authorization was
already consumed.

So the June transaction did not require the user's key, the relayer's key, or a
new signature. The unknown sender copied the same `(v, r, s)` and the same
`borrower`/`amount` authorization, the contract reconstructed the same digest,
`ecrecover` returned the user's address again, and `_borrow(user, 5000 USDC)`
ran again. From the contract's point of view, March and June were both valid
executions of the same timeless authorization.

The user's position is correct: they authorized one borrow in the ordinary human
sense, but the contract interpreted that authorization as reusable forever.

## Other exposure

The same construction exposes the market to more than this one replay:

- The same signature can be replayed repeatedly, not just twice, until the
  user's collateral or market liquidity stops it.
- Any party that can observe or obtain the signature can submit it. That includes
  a malicious relayer, a compromised relayer log, a frontend/backend leak, a
  copied transaction, mempool/calldata observers after the first execution, or
  anyone the user accidentally shared the signature with.
- The user has no way to cancel an old off-chain authorization, because there is
  no nonce state to invalidate.
- The authorization never expires, so old signatures remain dangerous months or
  years later.
- The signature is not bound to a particular relayer or submitter. That may be a
  desired gasless design choice, but if only our relayer is meant to execute
  borrows then the signed data must say so.
- The signed intent is underspecified. If the real product has multiple assets,
  markets, receivers, rate modes, fees, collateral accounts, or chains/forks
  that matter to the user's decision, those fields should be in the typed data
  too. The user should sign the full borrow intent, not just borrower and amount.
- Raw `ecrecover` should not be used directly. It does not enforce canonical
  low-`s` signatures and returns `address(0)` on failure. That is not the cause
  of this incident, but it is still a correctness footgun. Use OpenZeppelin
  `ECDSA.recover` or equivalent checks.

## Fix to ship

Ship a new `borrowWithSig` authorization format with nonce consumption and an
expiry. At minimum:

```solidity
bytes32 constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
);

mapping(address => uint256) public nonces;

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) external {
    require(block.timestamp <= deadline, "expired sig");

    uint256 nonce = nonces[borrower]++;

    bytes32 structHash = keccak256(
        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
    );
    bytes32 digest = keccak256(
        abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
    );

    address signer = ECDSA.recover(digest, v, r, s);
    require(signer == borrower, "bad sig");

    _borrow(borrower, amount);
}
```

Using a monotonically increasing per-borrower nonce means each signature is valid
for one execution only. Using `deadline` means unsubmitted signatures age out.
Because a revert rolls back `nonces[borrower]++`, consuming the nonce before
`_borrow` is fine and also avoids reentrancy surprises around signature reuse.

If borrowers need parallel outstanding authorizations, use unordered nonces
instead:

```solidity
mapping(address => mapping(uint256 => bool)) public usedNonce;

require(!usedNonce[borrower][nonce], "nonce used");
usedNonce[borrower][nonce] = true;
```

Then include that `nonce` in the signed struct.

For a production patch, I would ship the following exact changes:

1. Replace the current `Borrow(address borrower,uint256 amount)` typed data with
   a new version that includes `nonce` and `deadline`.
2. Include every user-meaningful borrow parameter in the typed data: asset or
   market id, amount, borrower, receiver if different, and any max fee or rate
   constraint the user is relying on.
3. Decide whether arbitrary submitters are allowed. If not, add
   `address relayer` to the signed struct and require `msg.sender == relayer`.
4. Add `nonces` or `usedNonce` storage and consume the nonce on successful
   signature validation before calling `_borrow`.
5. Use OpenZeppelin `ECDSA.recover` and reject `borrower == address(0)`.
6. Add an explicit cancellation function, either `incrementNonce()` for ordered
   nonces or `cancelBorrowSig(uint256 nonce)` for unordered nonces.
7. Update the frontend and relayer to sign the new EIP-712 type and display the
   nonce, deadline, asset/market, amount, and receiver to the user.
8. Disable or remove the old `borrowWithSig` entry point. If it must remain for
   compatibility, pause it immediately and migrate to a new function/typehash;
   there is no safe way to make already-issued nonce-less signatures one-time
   after the fact unless you have a complete registry of every historical
   signature/digest and can reliably block them.

For the support ticket, the honest explanation is: the June transaction was a
replay of the March authorization. The cryptographic signature was genuine, but
our contract failed to make the authorization single-use or time-limited.
