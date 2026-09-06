# What happened

The June transaction was a replay of the March authorization. The signature check proves only that the borrower once signed the tuple `(borrower, 5_000 USDC)` for this EIP-712 domain. It does **not** prove that this is the first use of that authorization, that it is still current, or that the caller is the protocol's relayer.

There is no nonce (or other one-time identifier) in the signed data and no on-chain state marking the authorization consumed. There is also no deadline. Consequently, the March signature remains valid forever and every successful call leaves it valid for another call. Repaying changes the loan state, but it does not change the signed digest or revoke the signature. Because `borrowWithSig` is public and neither the signature nor the function restricts `msg.sender`, anyone who learns the signature can submit it. A copied signature is enough; no private-key compromise is required. The identical `(v,r,s)` is especially strong evidence of replay.

The boarding pass and the unknown sender are therefore consistent with the code. The borrower did not have to be online and the sender did not have to be the original relayer. We should tell the user that this was an authorization-replay vulnerability in our contract, not evidence that they signed again.

# Other exposure

The same signature can be replayed repeatedly, not just twice, whenever `_borrow`'s collateral/liquidity checks permit it. An attacker can wait until a repayment, collateral top-up, price change, or restored credit makes an old authorization executable, then recreate debt. This can force interest, liquidation, and collateral loss. If borrowed funds can be directed to or otherwise benefit the caller, the impact can also be direct theft; even if proceeds always go to the borrower, forced debt and liquidation remain harmful.

There are several adjacent problems:

- There is no expiry, so leaked, logged, phished, or previously broadcast authorizations are lifetime bearer instruments.
- The authorization is not bound to an intended relayer. Any observer, compromised service, calldata/indexing consumer, or mempool participant can submit it and choose its timing. If permissionless submission is intentional this is acceptable only after nonce and deadline protections; otherwise the relayer must also be signed or access-controlled.
- Raw `ecrecover` accepts malleable high-`s` signatures and has awkward invalid-signature behavior. That did not cause this incident—the exact same bytes were reused—but it means a future defense keyed by `(v,r,s)` or signature bytes can be bypassed with the alternate valid signature. Consumption must be keyed by signed nonce/digest, and recovery should use OpenZeppelin `ECDSA`.
- The domain separator is permanently cached with the deployment chain ID. It separates this contract from ordinary cross-contract and cross-chain replay today because it includes both `chainId` and `verifyingContract`, but after a contentious chain split the same cached domain and signature can remain valid on both branches. OpenZeppelin `EIP712` recomputes the separator when the runtime chain ID changes.
- The current scheme supports only EOAs. If smart-contract wallets are in scope, validation must also support ERC-1271 (for example with OpenZeppelin `SignatureChecker`).

# What to ship

Ship a new authorization schema with a per-borrower nonce and deadline, use a fresh EIP-712 domain version, and consume the nonce before calling `_borrow`. The version change is important: it makes every outstanding legacy signature—including the March one—invalid after the upgrade. Do not retain the old entry point as a fallback.

For an EOA-only implementation using current OpenZeppelin contracts:

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ArbiLend is EIP712 {
    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address borrower => uint256 nonce) public borrowNonces;

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
        require(nonce == borrowNonces[borrower], "bad nonce");

        bytes32 structHash = keccak256(
            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
        );
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == borrower, "bad sig");

        // Checks/effects/interactions: consume before any external interaction in _borrow.
        borrowNonces[borrower] = nonce + 1;
        _borrow(borrower, amount);
    }

    // Lets a borrower invalidate an unsubmitted signature (and batches of old ones).
    function invalidateBorrowNonces(uint256 newNonce) external {
        require(newNonce > borrowNonces[msg.sender], "nonce not increased");
        borrowNonces[msg.sender] = newNonce;
    }
}
```

The client must read `borrowNonces[borrower]` immediately before signing and include that exact nonce and a short, user-visible deadline in the typed data. A relayer may submit the transaction, but it must not be allowed to alter any signed field. Concurrent authorizations for one borrower will contend under a sequential nonce; if the product needs several outstanding authorizations, use a signed random `bytes32 authorizationId` and `mapping(address => mapping(bytes32 => bool)) used`, marking it used before `_borrow`.

If only a designated relayer may submit, add `address relayer` to the type string and struct hash and require `msg.sender == relayer`, or enforce a relayer role on the entry point. Signing the relayer permits rotation per authorization; role gating is operationally simpler. Nonce and deadline are required either way—relayer restriction alone does not prevent a trusted or compromised relayer from replaying.

For ERC-1271 support, replace EOA recovery with `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. Keep the nonce consumption unchanged.

# Deployment and incident actions

1. Pause the vulnerable signed-borrow path immediately if the protocol has that capability. Do not rely on deleting known signature bytes or blocking the unknown sender.
2. Deploy/upgrade to the version-2 domain and remove or permanently disable the legacy function. For a proxy, use OpenZeppelin's upgradeable `EIP712` initializer, preserve storage layout, and append the nonce mapping; do not use the constructor shown above.
3. Test that first use succeeds; exact replay fails; the high-`s` variant fails; expired, wrong-nonce, wrong-amount, wrong-contract, wrong-chain, and unauthorized-relayer cases fail; nonce cancellation works; and reentrancy cannot reuse a nonce.
4. Search historical calldata for every signature/digest used more than once and for repeated `(borrower, amount)` authorizations, then assess affected accounts. Assume every legacy authorization observable off-chain or on-chain is compromised because the old format cannot be safely revoked individually.
5. Restore service only after legacy signatures are cryptographically invalid under the deployed code. Address the user's June debt and any resulting interest/liquidation as a protocol incident caused by replay, not as a valid second authorization.
