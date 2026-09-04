# Incident explanation and required fix

## What happened

The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this domain. It does not prove that this is the first execution of that authorization.

`borrowWithSig` has no nonce or other one-use identifier and records no consumed authorization. Repaying the loan changes the lending position, but it does not invalidate the signature. There is also no deadline, so the signature remains valid indefinitely. Consequently, the byte-identical March signature still recovered the borrower's address in June and passed the same `require`.

No key compromise, borrower activity in June, or relayer compromise is needed. Ethereum transaction calldata is public. Anyone who saw the March transaction could copy its `(v,r,s)` and arguments and call the public `borrowWithSig` function. The function does not restrict callers or bind an intended relayer, so the unrecognized sender is expected under this attack. A boarding pass is immaterial to the on-chain cause: the June caller needed the old public signature, not the borrower's key.

This is a critical authorization-replay vulnerability. The user is correct that they authorized one borrow. The contract incorrectly treated that authorization as a reusable license.

## Additional exposure

The same signature can be submitted repeatedly, not just once after repayment. Subject to collateral, liquidity, caps, and `_borrow`'s checks, an arbitrary caller can use it to create repeated or cumulative debt, force interest costs, push the account toward liquidation, and potentially cause collateral loss or protocol bad debt. If proceeds are always delivered to the borrower, that does not make the action harmless: the attacker can still grief the borrower and manipulate their risk. If any unsigned execution parameter elsewhere controls the proceeds recipient, asset, market, fees, or collateral, the impact can become direct theft.

Other weaknesses are:

- There is no expiry, so leaked or harvested authorizations remain dangerous forever.
- There is no caller/relayer binding. Any observer can execute or front-run an authorization. That is acceptable only if permissionless relay is an explicit design choice; it does not solve replay.
- `ecrecover` is used directly. It accepts malleable high-`s` signatures and has awkward invalid-signature behavior. A mapping keyed by signature bytes would therefore be an unsafe patch: the alternate `(v,s)` representation can recover the same signer while having different bytes. `borrower == address(0)` should also be rejected explicitly.
- The domain separator is permanently cached with the deployment-time chain ID. The current domain includes both `chainId` and `verifyingContract`, which normally prevents cross-chain and cross-contract replay, but a chain fork can leave the cached separator valid on both branches. Use an implementation that rebuilds the separator when the runtime chain ID changes.
- Any value that affects execution but is absent from the typed struct is not authorized by the borrower. The production schema must cover the asset/market, receiver, fees or rate bounds, and any other user-controlled execution terms if those are not already fixed by this verifying contract.

## What to ship

Immediately pause signature borrows if the system supports it. Then upgrade or migrate so the old `borrowWithSig(address,uint256,uint8,bytes32,bytes32)` selector is permanently disabled. Adding a safe overload while leaving the old function callable does not fix the incident. Treat every previously published legacy signature as compromised/replayable and monitor for prior replays.

Ship EIP-712 verification with a per-borrower nonce, a deadline, canonical signature recovery, and a domain separator that is chain-aware at runtime. For example, using current OpenZeppelin `EIP712`, `Nonces`, and `ECDSA`:

```solidity
contract ArbiLend is EIP712, Nonces {
    using ECDSA for bytes32;

    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    constructor(/* ... */) EIP712("ArbiLend", "2") {
        // ...
    }

    function borrowWithSig(
        address borrower,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(borrower != address(0), "zero borrower");
        require(block.timestamp <= deadline, "expired");
        require(nonce == nonces(borrower), "bad nonce");

        bytes32 structHash = keccak256(
            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
        );
        address signer = _hashTypedDataV4(structHash).recover(signature);
        require(signer == borrower, "bad sig");

        _useNonce(borrower); // consume authorization before executing the action
        _borrow(borrower, amount);
    }
}
```

The nonce must be read and signed by the client. Each successful authorization consumes it exactly once. Solidity transaction atomicity rolls the nonce change back if `_borrow` reverts. Incrementing before `_borrow` also prevents reuse during any reentrant execution path.

If smart-contract wallets are supported, use OpenZeppelin `SignatureChecker.isValidSignatureNow` (EIP-1271 support) instead of ECDSA-only recovery. If only the designated operator may relay, either enforce an access-controlled relayer role or add `address relayer` to the signed type and require `msg.sender == relayer`. If relay is intentionally permissionless, document that any caller may submit the authorization; keep the nonce and deadline regardless.

For a real multi-market implementation, the signed request should be closer to:

```solidity
keccak256(
    "Borrow(address borrower,address asset,uint256 amount,address receiver,"
    "uint256 nonce,uint256 deadline)"
)
```

and must include every mutable term used by `_borrow`. If users need cancellation without making another borrow, add `invalidateNonce`/nonce advancement callable by the borrower. An unordered nonce bitmap is an alternative when multiple independently signed requests must coexist; consume the selected bit before execution.

Finally, update the signer/client and tests together. Tests must prove: the same authorization cannot execute twice; it cannot execute after its deadline; the wrong nonce, borrower, amount, asset, receiver, contract, or chain fails; nonce consumption is safe under reentrancy; high-`s` signatures fail; and the legacy selector is unreachable after upgrade. During rollout, initialize/version the new domain deliberately, stop all legacy relaying, and verify that the upgrade actually invalidates old signatures rather than merely changing the frontend.

## What to tell the user

Their private key was not used in June. A third party copied the publicly visible signature from the March transaction. Because our contract omitted one-time-use and expiry checks, it accepted that old authorization again after repayment. This was a protocol authorization bug, not evidence that the user signed a second loan. We should handle the resulting debt and any collateral or interest consequences under the incident-response process, rather than represent the June borrow as newly authorized by the user.
