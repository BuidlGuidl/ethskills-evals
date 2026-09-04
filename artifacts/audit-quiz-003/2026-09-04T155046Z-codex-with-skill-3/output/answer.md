# Incident explanation and fix

## What happened

The June transaction did not require a new signature or a compromised key. It was a replay of the valid March authorization.

The signed EIP-712 message contains only `(borrower, amount)`. It contains no nonce, unique authorization ID, deadline, or other single-use value, and `borrowWithSig` records nothing as consumed. Consequently, the March signature means, in effect, “this borrower authorizes a 5,000 USDC borrow from this contract” an unlimited number of times for as long as this domain remains valid. Repayment changes the loan accounting but does not revoke or consume the signature.

The March signature was public once its transaction was mined: anyone could copy `(v, r, s)` from calldata and call the permissionless function. The unfamiliar address did exactly that in June. The relayer's identity and the borrower's location are immaterial because neither is checked or signed. The byte-identical signature is strong evidence of replay, not evidence of a new authorization.

The user is therefore correct: they authorized the typed action once in the ordinary meaning of the request, but the contract incorrectly implemented that authorization as reusable.

## Remaining exposure

This is a critical authorization-replay flaw, not a one-off relayer incident.

- Every previously published `borrowWithSig` signature can be replayed by anyone, repeatedly, subject only to whatever collateral and borrowing checks `_borrow` currently enforces. An attacker can recreate debt after repayment, exhaust borrowing capacity, cause interest charges, and potentially push accounts toward liquidation. If any borrow proceeds or destination can benefit the caller, the impact may be direct theft; even when funds always go to the borrower, it is a serious griefing and liquidation vector.
- A signature can be copied from the mempool and submitted before the intended relayer. With a nonce, this becomes at least a front-running/availability issue unless the intended relayer is also bound; without a nonce, both transactions can succeed and the attacker can keep replaying it.
- There is no expiry or user cancellation mechanism. A leaked, delayed, or intentionally withheld authorization remains usable indefinitely.
- A future “used signature” patch keyed by the raw `(v, r, s)` bytes would still be unsafe. Raw `ecrecover` accepts malleable high-`s` variants, so the same authorization can have another valid byte representation. Consumption must be keyed by an authorization nonce/ID, and signature recovery should enforce canonical signatures.
- The constructor-cached domain separator creates a fork replay issue. It correctly separates ordinary deployments by chain ID and contract address, but if the chain forks and a branch changes chain ID, the cached separator remains the deployment-time value. A pre-fork authorization may remain valid on both branches. The domain should be derived with the current chain ID, as OpenZeppelin's EIP-712 implementation does.
- Direct `ecrecover` also returns `address(0)` for malformed signatures. If `borrower == address(0)` can reach meaningful behavior, the present comparison can pass. Canonical recovery plus an explicit zero-address rejection removes this edge case.

The existing domain already includes `chainId` and `verifyingContract`, so ordinary cross-chain and cross-contract replay is otherwise correctly constrained. `abi.encodePacked` is also appropriate for the fixed EIP-712 `\x19\x01 || domainSeparator || structHash` envelope; there is no dynamic-value collision here.

## What to ship

Disable the old entry point immediately (pause it if the deployed system supports pausing), and ship an upgraded/new entry point whose signed data includes a per-borrower nonce and deadline. Consume the nonce before entering `_borrow`. Use OpenZeppelin `EIP712` and `ECDSA` rather than a permanently cached separator and raw `ecrecover`.

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

        // Consume authorization before any interaction in _borrow. A revert in
        // _borrow reverts this increment as well.
        borrowNonces[borrower] = nonce + 1;
        _borrow(borrower, amount);
    }
}
```

Version `"2"` deliberately invalidates every signature made for the vulnerable `"1"` schema. The old `borrowWithSig` must be removed, made to revert, or remain permanently paused; leaving it callable leaves the vulnerability intact. For a proxy, changing the EIP-712 version/schema while retaining the proxy address achieves the same invalidation, provided the upgrade uses a storage-safe OpenZeppelin implementation. For an immutable deployment, migrate to a new contract and disable the old market's borrowing path as far as the protocol permits.

Also ship these operational and interface changes:

1. Have the signing client fetch `borrowNonces[borrower]`, choose a short deadline, display both clearly, and sign the exact version-2 typed data.
2. If only your relayer should be able to execute an authorization, add `address relayer` to the type and struct hash and require `msg.sender == relayer`. Do not add this if permissionless relaying is an intentional availability feature; nonce protection is required either way.
3. Include every parameter that can affect the borrow's economic result in the signed struct, especially asset/market, recipient, rate/slippage limit, fees, and any delegation field if those exist outside this excerpt. Never let the submitter choose an unsigned effect-bearing value.
4. Add a borrower-accessible nonce invalidation/cancellation method (for example, advancing to a greater nonce) if users need to cancel outstanding signatures. A sequential nonce intentionally invalidates any other pending signatures with lower nonces; use unordered nonce bitmaps if multiple independently executable outstanding orders are required.
5. Test: same-signature replay, replay after repayment, expired signatures, wrong/current nonce, nonce consumption around reentrancy, high-`s` and malformed signatures, zero borrower, domain separation across contracts/chains, chain-ID changes, and old-version rejection.

Until the vulnerable entry point is disabled, assume all historical signatures remain live. Review historical calldata to enumerate affected borrowers, monitor/restrict repeat borrows, and handle this user's June debt as an unauthorized replay caused by the contract's missing single-use controls—not as evidence that the user signed again or that either key was compromised.
