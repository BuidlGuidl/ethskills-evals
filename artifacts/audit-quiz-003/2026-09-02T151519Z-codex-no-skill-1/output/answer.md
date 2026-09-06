# Incident explanation and remediation

## What happened in June

The June transaction was a replay of the user's valid March authorization.

The signed EIP-712 message is effectively:

```text
ArbiLend v1, on this chain, at this contract:
borrow 5,000 USDC for <borrower>
```

It does **not** say "only once," "before a particular time," or "only when submitted by our relayer." The contract also records no fact that the authorization was consumed. Consequently, after the March borrow was repaid, exactly the same digest and signature still passed `ecrecover`, and `_borrow` created the debt again. Repayment changes the account's debt, but it does not revoke a signature.

Anyone can read `(v, r, s)` from the public March transaction and call the public function. The unknown June sender therefore needed neither the borrower's private key nor access to the operator. The boarding pass and the absence of key compromise are consistent with the on-chain evidence. The signature is authentic; the contract interpreted its scope too broadly.

This is an authorization-replay vulnerability, not evidence that the borrower authorized a second loan. We should tell the user that their one-time authorization was accepted twice because of a protocol defect, and treat the June debt and any resulting interest, fees, or liquidation effects as unauthorized under the intended product semantics.

## Other exposure

- The same signature can be submitted again, without limit, whenever the position has enough borrowing capacity. An attacker can also race the intended first submission or repeatedly use it after later repayments/collateral deposits.
- A signature that is never submitted promptly remains valid indefinitely. A relayer, mempool observer, compromised database, or any later holder can execute it when prices, rates, collateral, or the user's circumstances are less favorable.
- The signed data does not constrain mutable execution terms. If `_borrow` depends on an interest-rate model, fees, oracle prices, collateral selection, proceeds recipient, slippage-like limits, or another market choice not already fixed by this verifying contract and `borrower`, the signer did not approve bounds for those values.
- Raw `ecrecover` does not reject high-`s` malleable signatures or invalid `v` values as robustly as a maintained signature library. A valid ECDSA signature may have an alternative byte representation with the same signer. This is not needed for the observed replay, but it means a future patch that marks only `keccak256(signatureBytes)` as used would still be bypassable. Consumption must be keyed by an authorization nonce/digest, not signature bytes.
- The domain prevents ordinary replay into a different contract address or chain ID, but the separator is cached forever. If a chain fork changes `block.chainid`, this contract continues accepting signatures under the old domain; copies on both sides can share the same stored separator and signatures can be replayed across the fork. Deployments that reproduce both the chain ID and contract address have the same issue.
- `ecrecover(...) == borrower` supports only EOAs. If contract-wallet borrowers are or may become supported, this scheme lacks ERC-1271 validation. Also reject `address(0)` explicitly: `ecrecover` returns zero for malformed signatures, so a zero borrower would otherwise satisfy the equality check if `_borrow` permits it.

Permissionless submission is not itself a flaw if gasless borrowing is meant to work with any relayer. If only the operator should submit, `msg.sender` must also be authorized or included in the signed message—but that is a policy choice and is not a substitute for replay protection.

## What to ship

Immediately pause or disable the existing `borrowWithSig` entry point. Search all successful calls for repeated signed digests and remediate affected accounts. Do not leave the old path callable alongside a corrected overload: every already disclosed v1 signature would remain reusable through it.

Replace it with a new authorization type and bump the EIP-712 domain version so existing v1 signatures cannot be interpreted as v2 authorizations:

```solidity
bytes32 constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
);

mapping(address => uint256) public borrowNonces;

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
    bytes32 digest = _hashTypedDataV4(structHash);
    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

    // Consume before code that can make an external call. A revert rolls this back.
    borrowNonces[borrower] = nonce + 1;
    _borrow(borrower, amount);
}
```

Use audited OpenZeppelin `EIP712` plus `SignatureChecker` (or `ECDSA.recover` if borrowers are guaranteed to be EOAs), rather than raw `ecrecover`. These enforce canonical EOA signatures; `SignatureChecker` additionally supports ERC-1271 wallets. OpenZeppelin's EIP-712 implementation also derives a separator appropriate to the current chain and contract, avoiding a permanently stale chain ID. Use checked nonce increment semantics and a sufficiently wide nonce (`uint256`).

The nonce is the actual one-use control. A simple monotonically increasing per-borrower nonce is appropriate: the signed nonce must equal `borrowNonces[borrower]`, and it is incremented atomically before borrowing. The deadline limits how long an unused authorization remains dangerous. Expose a borrower-authorized `invalidateBorrowNonces(newNonce)`/cancellation path if users need to revoke outstanding signatures; require `newNonce > currentNonce`, and emit events for use and invalidation.

The production type should also bind every user-controlled or economically material parameter used by `_borrow`. Depending on the implementation, that can include the asset or market ID, destination of proceeds, collateral/account identifier, maximum acceptable interest rate or fee, referral/delegation data, and any execution mode. Include a relayer only if product policy deliberately restricts who may submit. Keep `verifyingContract`, live `chainId`, a unique protocol name, and the bumped version in the domain.

Finally, add tests that prove: the same authorization cannot succeed twice; repayment does not reset its nonce; expired, wrong-nonce, wrong-chain, wrong-contract, and altered-parameter signatures fail; cancellation works; high-`s`/bad-`v` signatures fail; reentrancy cannot reuse a nonce; and both EOA and ERC-1271 behavior match the supported account model.
