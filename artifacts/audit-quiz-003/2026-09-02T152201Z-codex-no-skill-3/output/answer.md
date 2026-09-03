# Incident explanation

The June transaction did not require a new signature or a compromised key. It replayed the valid March authorization.

The signed digest is a function only of this contract's EIP-712 domain, `borrower`, and `amount`. None of those values changed between March and June. There is no nonce, no record that the authorization was consumed, and no deadline. Repaying the March loan changes the loan state, but it does not invalidate the signed message. Consequently, the exact same `(v, r, s)` remains valid forever and every successful call can invoke `_borrow` again.

Nor is the transaction sender authenticated. `msg.sender` is not in the signed data and `borrowWithSig` is public, so anyone who obtains the signature can submit it. Transaction calldata is public: the March transaction permanently published the signature on-chain (and it was also visible in the public mempool before inclusion). The unknown address could simply copy that calldata and replay it. The boarding pass and the relayer operator's statement are both consistent with this explanation.

The accurate response to the user is therefore: **their key need not have been compromised; the contract incorrectly treated a one-time authorization as an unlimited, non-expiring authorization.** This is a protocol authorization/replay defect, not evidence that the user initiated the June loan.

# Remaining exposure

This is not limited to this user or to one replay.

- Every signature ever accepted by this endpoint can be replayed repeatedly, now or later, whenever `_borrow`'s state checks permit it. A failed attempt does not destroy it; an attacker can wait for repayment, added collateral, restored liquidity, or changed risk limits and try again. Several copies can also be submitted in separate transactions.
- Every pending signature can be copied from a public mempool and front-run. Restricting submission to the operator would reduce who may call the function, but would not give the authorization one-time semantics and would make the relayer a trusted availability/security boundary.
- A deadline alone would only shorten the replay window. A nonce alone would prevent reuse after execution, but an unexecuted leaked signature would remain usable indefinitely. Both controls are needed.
- Raw `ecrecover` accepts signature forms that a hardened ECDSA library should reject, notably malleable high-`s` signatures. A valid signature can have a byte-different equivalent. Therefore replay protection must be keyed by a signed nonce/authorization, not by `(v,r,s)` or `keccak256(signature)`. Also reject the zero borrower explicitly; `ecrecover` returns `address(0)` on failure.
- The domain separator was frozen in the constructor. `verifyingContract` and `chainId` give useful contract/network separation, but a cached separator does not track a later chain-ID change. On a fork that retains the same chain ID and contract address, pre-fork signatures are valid on both sides. Use a maintained EIP-712 implementation that rebuilds/caches against the current `block.chainid`; no domain design can distinguish two live forks that deliberately retain the same chain ID, so operations should pause/cancel authorizations during such a fork.
- Every choice that affects the user's economics must be signed. If the real borrow path has an asset/market identifier, proceeds recipient, interest/rate bound, fee, collateral account, or similar caller-supplied setting, add it to the typed struct. Otherwise a submitter can alter any unsigned choice. Bind a `relayer` only if the product intentionally promises that a particular relayer alone may execute; permissionless relaying itself is safe once the authorization is complete and single-use.

# Fix to ship

Immediately pause or disable the current `borrowWithSig`. Do not merely add a new endpoint while leaving the old one callable: all already exposed version-1 signatures remain replayable for as long as that endpoint can change state. Assess all historical calls/signatures for repeated borrows and handle the June debt as an unauthorized replay under the incident policy.

Ship a new typed authorization with, at minimum, a borrower-scoped nonce and deadline, change the EIP-712 version (for example to `"2"`), use a current-chain-aware domain implementation, and use a strict signature verifier. An illustrative implementation is:

```solidity
// OpenZeppelin imports appropriate to the repository's pinned release.
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract ArbiLend is EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address borrower => uint256 nonce) public nonces;

    constructor(/* ... */) EIP712("ArbiLend", "2") {}

    function borrowWithSig(
        address borrower,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(borrower != address(0), "zero borrower");
        require(block.timestamp <= deadline, "authorization expired");
        require(nonce == nonces[borrower], "invalid nonce");

        bytes32 structHash = keccak256(
            abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
        );
        address signer = _hashTypedDataV4(structHash).recover(signature);
        require(signer == borrower, "bad signature");

        // Consume before entering the borrowing path. A revert in _borrow also
        // reverts this increment, while reentrancy cannot reuse the nonce.
        nonces[borrower] = nonce + 1;
        _borrow(borrower, amount);
    }
}
```

Use checked increment behavior (the Solidity 0.8 default), and preserve checks-effects-interactions plus a reentrancy guard where `_borrow` makes external calls. If contract-wallet borrowers are supported, verify with OpenZeppelin `SignatureChecker`/ERC-1271 rather than ECDSA recovery alone.

A sequential per-borrower nonce is the simplest safe design. The client must read `nonces(borrower)`, include that exact value and a short, explicit deadline in the EIP-712 payload, display all signed economic fields to the user, and never sign two simultaneously live borrows with the same nonce. If the product requires multiple independently executable authorizations or out-of-order execution, instead sign an arbitrary unique nonce/salt and store `used[borrower][nonce]`; check and set that mapping before `_borrow`. Do not track signature bytes as the replay key.

Finally, provide revocation. For sequential nonces, an on-chain method that advances the caller's nonce invalidates all signatures using lower/current nonces; if borrowers must remain gasless, offer a separately typed, replay-protected cancellation through the relayer. For arbitrary nonces, allow the borrower to mark specified nonces used. Cancellation is defense in depth and does not replace expiry.

Deployment must form a hard boundary:

1. Pause the vulnerable endpoint and keep it disabled permanently.
2. Deploy/upgrade the version-2 code and initialize its nonce state safely. If using a proxy, follow the EIP-712 upgradeable initializer pattern and storage-layout rules; do not rely on a constructor in the implementation.
3. Make clients and relayers sign/accept only the exact version-2 domain and schema, with nonce, deadline, and every relevant economic parameter. Reject version-1 payloads everywhere.
4. Test exact replay, malleated-signature replay, expiry, wrong nonce, wrong chain/contract, zero borrower, front-running by an arbitrary submitter, reentrancy, and nonce rollback when `_borrow` reverts.

Changing the domain version prevents old signatures from validating in the new verifier. Disabling the old verifier is what actually removes their on-chain execution path; both steps are required.
