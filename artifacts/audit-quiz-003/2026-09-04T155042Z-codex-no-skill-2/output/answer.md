# Incident explanation

The June transaction is a replay, not evidence that the borrower signed again or that either private key was compromised.

The March signature authorizes only the tuple `(borrower, amount)`. Nothing in the signed digest says "use once", identifies a particular request, or gives an expiry. The contract also records no fact about having consumed that authorization. Repayment changes the loan balance, but it does not change the signed digest and does not invalidate the signature. Thus the exact same calldata still passes `ecrecover` after repayment (and would pass before repayment too, subject only to whatever checks `_borrow` performs).

The original March transaction put the signature in public transaction calldata. Anyone running an RPC node, explorer, indexer, or mempool listener could copy it. `borrowWithSig` has no caller restriction, so the unknown address did not need the relayer's key or the borrower's key; it merely submitted those public bytes and paid gas. The boarding pass and the relayer operator's account are therefore entirely consistent with the on-chain evidence.

We should tell the user that their interpretation is correct: they authorized one borrow, while our contract accidentally treated that authorization as reusable. This is a protocol authorization bug. We should pause this entry point, remove the replayed debt and any resulting interest/liquidation consequences, and handle any user loss under the incident process rather than describing this as a key compromise.

# Other exposure in the current construction

* **Unlimited replay.** Every signature ever accepted remains usable indefinitely and any number of times, not merely once after repayment. An attacker can repeat it until collateral, liquidity, borrow caps, or `_borrow` checks stop them. All historical signatures should be considered exposed because successful transactions reveal them on-chain; signatures seen only in a public mempool may be exposed too.
* **Front-running and arbitrary timing.** Even on first use, anybody who sees a pending relayer transaction can copy the signature, pay a higher fee, and execute it first. More generally, a holder can wait for a disadvantageous time because there is no deadline. A nonce makes two competing executions mutually exclusive, but it does not by itself prevent an arbitrary caller from winning or choosing the timing.
* **Under-specified intent.** The signature binds only borrower and amount. Any security-sensitive inputs or mutable execution conditions used by `_borrow` are not approved by the borrower. The authorization should bind the receiver of the funds, asset/market (if the verifying contract does not uniquely determine it), and protections such as a maximum rate/fee or minimum amount received where applicable. Otherwise a valid signature may execute under materially different terms from those displayed when it was signed.
* **No cancellation mechanism.** The borrower cannot invalidate an outstanding authorization on-chain. With a sequential nonce, advancing/invalidation support is needed if users may sign requests without immediately submitting them; unordered nonces are preferable when multiple outstanding requests must be independently executable or cancellable.
* **Raw `ecrecover` hardening gaps.** It does not reject high-`s` malleable signatures or malformed `v` values by itself, and it does not support ERC-1271 smart-contract wallets. Malleability can produce a second byte representation for the same authorization. A nonce still prevents it from being executed twice, but canonical signature validation should be used. Also explicitly reject the zero signer/borrower; `ecrecover` returns `address(0)` on failure.
* **Cached-chain domain behavior.** `verifyingContract` and `chainId` already stop ordinary replay on another contract or another chain, which is good. However, permanently caching `block.chainid` means a chain-ID change leaves the contract verifying the old domain, enabling the same signed messages on both sides of a fork and making newly signed messages using the new chain ID fail. A standard EIP-712 implementation recomputes/cache-invalidates the separator when the chain ID changes. If this is behind a proxy, the EIP-712 implementation must also use the proxy address as `verifyingContract`, not an implementation constructor's address.

# Fix to ship

Disable the old `borrowWithSig` in the same upgrade in which the replacement is enabled. Leaving the legacy selector callable leaves every old signature replayable and means the vulnerability is not fixed. Pause it immediately if the protocol has a pause control. Increment the EIP-712 domain version (for example, to `"2"`) and use a new type. This deliberately invalidates all version-1 authorizations.

The replacement must include a nonce and deadline in the signed struct, verify them, and consume the nonce atomically before the external/effectful borrow path. It must bind every user-controlled consequence. For a design in which only the designated relayer may submit, also bind `relayer` and enforce `msg.sender == relayer`:

```solidity
// OpenZeppelin 5.x primitives; EIP712 handles chain-id changes and the domain.
// SignatureChecker supports both canonical EOA signatures and ERC-1271 wallets.
contract ArbiLend is EIP712, Nonces {
    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,address relayer,uint256 nonce,uint256 deadline)"
    );

    constructor(/* ... */) EIP712("ArbiLend", "2") {}

    function borrowWithSig(
        address borrower,
        address receiver,
        uint256 amount,
        address relayer,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(borrower != address(0), "zero borrower");
        require(receiver != address(0), "zero receiver");
        require(msg.sender == relayer, "wrong relayer");
        require(block.timestamp <= deadline, "expired");
        // Consume before SignatureChecker: ERC-1271 validation is an external
        // call and must not be able to re-enter using this same nonce.
        _useCheckedNonce(borrower, nonce);

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH,
            borrower,
            receiver,
            amount,
            relayer,
            nonce,
            deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        require(
            SignatureChecker.isValidSignatureNow(borrower, digest, signature),
            "bad signature"
        );

        // A failed signature or failed borrow reverts the nonce consumption.
        _borrow(borrower, receiver, amount);
    }
}
```

The actual struct should add any market identifier and economic limits that are not invariant in this particular deployment. If permissionless relay is an intentional feature, omit `relayer` from both the type and function and document that anyone may execute; the nonce and deadline are still mandatory. If only the operator should relay, merely adding `onlyRelayer` is not a substitute for a nonce: operator mistakes, compromise, duplicate submissions, or later policy changes would still replay signatures. Bind and enforce the relayer as shown.

Sequential nonces are sufficient if authorizations are expected to execute in order. The client obtains `nonces(borrower)`, displays receiver, amount, terms, relayer, and expiry to the signer, then submits that exact typed data. To support several independently pending orders, ship an unordered nonce/bitmap design instead, with an explicit borrower-callable nonce invalidation function.

For a proxy deployment, use `EIP712Upgradeable`/`NoncesUpgradeable`, initialize them through the proxy, and append storage safely according to the proxy's upgrade pattern; do not add the constructor above to an already deployed proxy implementation.

Before unpausing, we should test: exact-signature replay; malleated-signature replay; two transactions racing with one nonce; expired signatures; wrong nonce, receiver, amount, relayer, chain, and contract; nonce rollback when signature validation or `_borrow` reverts; malicious ERC-1271 reentrancy plus ordinary ERC-1271 success/failure; chain-ID domain behavior; upgrade/storage-layout safety; and confirmation that the legacy selector always reverts. We should then scan all historical successful `borrowWithSig` calls for duplicated digests/signatures and reconcile every affected account—not only this ticket.
