# Support conclusion

The June transaction did not require either private key. It replayed the March authorization.

The signed EIP-712 value is only `(borrower, amount)`. Nothing in it identifies a particular use of the authorization, and the contract records no consumed authorization. Repayment changes the loan balance, but it does not change the signed digest or invalidate the signature. Consequently, after repayment the exact March `(v,r,s)` still recovers the user's address and `borrowWithSig` opens the same debt again. Anyone who obtained the signature—most simply by reading the public March transaction calldata—could submit it. The June sender and the boarding pass are therefore consistent with the user's account, as is the absence of a key compromise.

This is a critical authorization-replay vulnerability. A signature currently means “the bearer may borrow 5,000 USDC for this address any number of times, forever,” not “authorize one 5,000 USDC borrow.” Subject to the market's collateral and accounting checks, an attacker can replay it whenever repayment or added collateral restores borrowing capacity.

## Other exposure

- Every historical successful signature, and every signature leaked before submission, is a permanent public bearer authorization. It can be replayed repeatedly, including long after the user intended it to expire.
- The authorization is not bound to the intended relayer. Anyone can submit it or copy/front-run it. This explains why the relayer's key and systems need not be involved. If execution timing, relayer fees, or any caller-dependent behavior matters, this is independently dangerous.
- Raw `ecrecover` accepts non-canonical high-`s` signatures. An attacker can derive a second `(v,r,s)` for the same authorization. Therefore a patch that merely stores `keccak256(abi.encode(v,r,s))` as “used” can still be bypassed. Recovery also needs an explicit nonzero/canonical-signature implementation.
- There is no expiry, so even a correctly single-use authorization cannot naturally become stale or be bounded to the period the user expected.
- The constructor-cached domain contains the deployment chain ID, which is good under normal conditions, but it does not adapt if the chain ID changes after a fork. The old cached domain can make signatures valid in an unintended fork/domain. Use an EIP-712 implementation that recomputes the separator when the runtime chain ID differs.
- EOAs are the only borrowers supported by raw `ecrecover`. If smart-contract wallets are or may become borrowers, validation should support ERC-1271 as well.

`amount` and `borrower` are correctly included, and the domain includes both `chainId` and `verifyingContract`, so changing the amount or ordinarily replaying the signature against another address/chain/contract is not the issue here.

## What to ship

Upgrade or replace the contract with all of the following changes as one release:

1. Change the signed type to include a per-borrower nonce, deadline, and intended executor (the relayer).
2. Require the supplied nonce to equal the borrower's current nonce and consume it before `_borrow` or any other state-changing/external execution. A revert restores the nonce, so invalid signatures cannot burn it.
3. Reject expired authorizations.
4. Use OpenZeppelin `EIP712` plus `SignatureChecker` (which uses canonical ECDSA validation for EOAs and ERC-1271 for contract wallets), rather than raw `ecrecover`.
5. Change the EIP-712 domain version from `"1"` to `"2"`.
6. Remove or permanently disable the old nonce-less entry point. Merely adding a new entry point leaves the exploit open.

A concrete Solidity shape is:

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from
    "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

contract ArbiLend is EIP712 {
    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline,address executor)"
    );

    mapping(address borrower => uint256 nonce) public nonces;

    error BadSignature();
    error AuthorizationExpired();
    error InvalidNonce();
    error WrongExecutor();

    constructor(/* ... */) EIP712("ArbiLend", "2") {
        // existing initialization
    }

    function borrowWithSig(
        address borrower,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        address executor,
        bytes calldata signature
    ) external {
        if (msg.sender != executor) revert WrongExecutor();
        if (block.timestamp > deadline) revert AuthorizationExpired();
        if (nonce != nonces[borrower]) revert InvalidNonce();

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH,
            borrower,
            amount,
            nonce,
            deadline,
            executor
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        // Consume before ERC-1271 validation and before _borrow. Any later revert
        // rolls this write back; early consumption also closes reentrant reuse.
        nonces[borrower] = nonce + 1;

        if (!SignatureChecker.isValidSignatureNow(borrower, digest, signature)) {
            revert BadSignature();
        }

        _borrow(borrower, amount);
    }

    // Lets a user revoke all still-pending lower nonces without a borrow.
    function invalidateBorrowNonces(uint256 newNonce) external {
        if (newNonce <= nonces[msg.sender]) revert InvalidNonce();
        nonces[msg.sender] = newNonce;
    }
}
```

If permissionless submission is an intentional product requirement, omit `executor` from both the type and function instead of accepting an unsigned executor. Nonce and deadline remain mandatory. If several concurrent outstanding authorizations are required, use unordered/bitmap nonces rather than a sequential counter, with a borrower-only cancellation function.

For a proxy, use the upgradeable OpenZeppelin variants and an initializer, append storage without changing the existing layout, and set the new domain version during reinitialization. For an immutable deployment, deploy version 2, pause/disable signature borrowing on version 1, and migrate the market. Do not advertise the new route as safe while version 1 can still originate debt.

Before reopening, tests should prove: the same signature succeeds once only; replay after repayment fails; an expired signature fails; the wrong executor fails; nonce cancellation works; high-`s` ECDSA fails; an ERC-1271 wallet works (if supported); nonce consumption precedes callbacks; chain/domain/contract mismatches fail; and the legacy selector is unreachable.

## What to tell the user

“Your key was not used in June. A defect in our authorization contract allowed the one signature you supplied in March, which became visible in transaction data, to be submitted again by anyone. Repaying the March loan did not invalidate that signature. The June debt was therefore created by replaying your valid March authorization, not by a new authorization from you. We are disabling the affected route, addressing the resulting unauthorized debt under our incident process, and deploying single-use, expiring authorizations before restoring gasless borrowing.”
