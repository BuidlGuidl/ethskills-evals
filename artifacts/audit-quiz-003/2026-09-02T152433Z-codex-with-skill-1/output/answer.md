# Incident conclusion

The June transaction was possible because the signature authenticates a borrow, but the contract never consumes that authorization.

The signed digest is a deterministic function of only:

- the EIP-712 domain;
- `borrower`; and
- `amount`.

There is no nonce, authorization ID, used-digest flag, or expiry. The March transaction published the complete signature in public calldata. From then on, anyone could copy that calldata and call `borrowWithSig`. The function does not require `msg.sender` to be the protocol relayer, so the unknown address needed neither private key nor cooperation from the relayer; it only paid gas.

Repayment does not affect signature validity. It merely restored the account's ability to borrow. Thus the same March authorization passed `ecrecover` again in June and `_borrow` created new debt. The byte-identical `(v,r,s)` is strong evidence of this exact replay. The boarding pass, the relayer's denial, and the absence of key compromise are all consistent with it.

What to tell the customer:

> We confirmed that the June debt was caused by a replay vulnerability in our gasless-borrow contract. Your March signature was valid, but our contract failed to mark it as used, so a third party could copy the public March transaction data and submit it again. This does not indicate that your wallet key was compromised, and you did not need to be online for the June transaction. We have disabled the affected path while we replace it. We are treating the duplicate debt and any resulting interest, fees, or collateral effects as a protocol incident and will remediate them under our incident policy.

# Exposure beyond this incident

This is not limited to one replay after one repayment:

- Every successful historical V1 signature is public and remains valid forever.
- A signature can be replayed repeatedly, including back-to-back, until collateral checks, liquidity, or borrow caps stop it. It becomes usable again after repayment, new collateral, or other restored capacity.
- An attacker can force debt, worsen health factors, cause interest and liquidation penalties, consume market liquidity/caps, and potentially create bad debt or socialized losses.
- Anyone can front-run the intended relayer. Rotating or securing the relayer does not fix a permissionless contract entry point.
- There is no way in the current contract for a borrower to revoke an outstanding signature.
- There is no deadline, so an authorization can execute years later under very different rates, collateral prices, or market conditions. A deadline limits staleness but does **not** replace a nonce.
- Only `borrower` and `amount` are signed. Every value that can affect the action must be signed or fixed by code: at least the proceeds recipient, asset/market identifier, and any caller-selectable fee, rate mode, maximum rate, or slippage/terms bound. If `_borrow` sends proceeds to `msg.sender` or to an unsigned receiver, replay can be direct theft; if proceeds are forced to the borrower, it is still forced-debt and liquidation griefing.

There are also two independent signature-hardening issues:

1. Raw `ecrecover` accepts malleable high-`s` signatures. This did not cause the byte-identical June replay, but it means `used[keccak256(signatureBytes)]` is an unsafe patch: the alternate `(v,s)` form can represent the same authorization with different bytes. Track a nonce/authorization, not signature bytes, and use OpenZeppelin's canonical signature checks.
2. Invalid `ecrecover` input returns `address(0)`. Because `borrower` is supplied by the caller, malformed input can satisfy the current comparison when `borrower == address(0)`. Reject the zero borrower and use a library that rejects invalid signatures.

The existing domain does prevent ordinary replay on a different chain ID or contract address. However, caching the separator in the constructor is fragile across a chain split or chain-ID change: both sides retain the old separator, and the new chain does not dynamically adopt its new ID. Use OpenZeppelin `EIP712`, which rebuilds the separator when the chain ID changes. If this is a proxy, constructor-based domain storage is wrong for an additional reason; use `EIP712Upgradeable` and initialize the domain in proxy storage.

# Immediate containment

1. Pause or permanently disable the legacy `borrowWithSig` path immediately. Keep repayment and other risk-reducing operations available. If it cannot be paused independently, stop new borrowing in the affected market while preserving safe exits.
2. Treat every V1 signature as exposed. Enumerate all past `borrowWithSig` calls, group identical digests, identify replays and affected accounts, and monitor attempts while containment completes.
3. Do not try to fix this by changing relayers or by merely adding a V2 function. The V1 selector must become uncallable.
4. Correct the user's replay-created debt and account for related interest, fees, liquidation loss, or collateral effects under the incident-response policy.

# Code to ship

For an EOA-only product, use OpenZeppelin `EIP712` and `ECDSA`. The replacement should have this shape (add all other execution-relevant fields before release):

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ArbiLend is EIP712 {
    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address borrower => uint256 nonce) public borrowNonces;

    constructor(/* ... */) EIP712("ArbiLend", "2") {
        // ...
    }

    function borrowWithSig(
        address borrower,
        address receiver,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(borrower != address(0), "zero borrower");
        require(block.timestamp <= deadline, "expired");
        require(nonce == borrowNonces[borrower], "bad nonce");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH,
            borrower,
            receiver,
            amount,
            nonce,
            deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        require(ECDSA.recover(digest, signature) == borrower, "bad sig");

        // Consume before _borrow or any external interaction. A revert rolls this back.
        borrowNonces[borrower] = nonce + 1;
        _borrow(borrower, receiver, amount);
    }
}
```

If proceeds must always go to the borrower, remove `receiver` from the API entirely and enforce that in `_borrow`; otherwise it must remain signed. Similarly add `asset`/`marketId` and every mutable economic term to both the type string and `abi.encode`, in exactly the same order and types.

If smart-contract wallets are supported, replace `ECDSA.recover` with OpenZeppelin `SignatureChecker.isValidSignatureNow(borrower, digest, signature)`. ERC-1271 validation is itself an external call: increment the checked nonce **before** calling `SignatureChecker` (a failed check reverts the increment), and use a reentrancy guard as defense in depth. Do not cache ERC-1271 validity because a wallet's authorization logic can change.

Add a borrower-controlled cancellation method that can advance the nonce, for example:

```solidity
function invalidateBorrowNonces(uint256 newNonce) external {
    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
    borrowNonces[msg.sender] = newNonce;
}
```

Sequential nonces intentionally invalidate older pending requests when a later nonce is consumed or cancelled. If the product requires multiple independently executable outstanding requests, use unique authorization IDs with a used/cancelled mapping, or bitmap nonces, instead. In either design, consumption must be keyed by the signed authorization—not by signature bytes—and occur before external effects.

Restricting submission to a designated relayer is optional product policy, not the replay fix. If required, enforce a relayer role on-chain or sign an `executor` field and require `msg.sender == executor`. Permissionless relaying is safe when the nonce prevents replay and every outcome-affecting field is signed or fixed.

# Rollout requirements

- Bump the EIP-712 version to `"2"`, change the type hash, and reject every V1 signature. Users must sign the new schema.
- On an upgradeable proxy, use `EIP712Upgradeable`, append or namespace nonce storage without corrupting the existing layout, and atomically initialize/upgrade while disabling the legacy selector. Test against the deployed storage layout.
- On an immutable deployment, deploy a new contract and actually disable, drain, or migrate the old market; a safe new contract does not neutralize the callable old one.
- Update the signer UI so it displays the receiver, asset/market, amount, nonce, deadline, and economic bounds.
- Consider a domain salt/epoch if the deployment model can recreate contract state at the same address and chain ID. It is defense in depth, not a substitute for nonce and deadline.

Required regression tests include: second use of one signature; replay after repayment; two uses in one transaction/reentrant callback; expired and cancelled signatures; wrong nonce; altered amount/receiver/market/terms; wrong contract and chain domain; high-`s`, invalid-`v`, and zero-signer cases; ERC-1271 acceptance/rejection if supported; chain-ID-change domain behavior; and proof that all V1 calls fail after the upgrade.
