# What happened

The June borrow was a replay of the March authorization. The signature check is cryptographically valid, but it answers only this question:

> Did `borrower` sign the words “borrow this `amount` from this contract on this chain”?

It does **not** answer “has this authorization already been used?” The signed struct contains no nonce or authorization identifier, and the contract records no consumed authorization. Its digest is therefore identical every time the same `borrower` and `amount` are supplied. Repaying the loan changes the debt balance, but it does not change or revoke the signed digest.

The March transaction also made the signature public in calldata. Anybody who saw it—in an explorer, indexer, archive node, mempool, log, or copied transaction—could call the public function. `msg.sender` is not checked and is not part of the signature. The unknown June sender therefore needed neither the borrower's key nor the relayer's key; it merely copied the public March calldata. The boarding pass is consistent with that explanation but is not needed to establish it.

This is a protocol authorization failure, not evidence that the user authorized a second loan. The signature proves that the user authorized the signed terms at least once. In this implementation it was accidentally treated as a permanent bearer authorization.

The replay can succeed whenever `_borrow`'s normal checks allow another loan—for example, after repayment restores borrowing capacity. It can also be repeated several times without an intervening repayment if collateral and liquidity limits permit. The immediate consequence is forced debt, interest, and liquidation risk. We must also determine where the second 5,000 USDC was sent. If `_borrow` always pays the borrower, this is forced leverage/griefing; if it pays `msg.sender` or accepts an unsigned recipient, the replay is direct theft.

# Other exposure in this construction

1. **Unlimited and non-expiring replay.** Every signature ever accepted by this function remains usable forever and any number of times. A signature that was created but never submitted is likewise valid forever. A deadline limits how long a leaked signature is dangerous, but only a nonce/consumption record makes it one-time.

2. **Front-running and arbitrary execution.** As written, relaying is permissionless. Anyone who obtains a signature before its intended submission can execute it first and choose its execution time. This is acceptable only if the product deliberately supports arbitrary relayers and the caller cannot affect proceeds or terms. If execution must be restricted to a nominated relayer, that relayer must be signed and checked. Relayer allowlisting alone does not supply replay protection.

3. **Unsigned economic terms.** Only `borrower` and `amount` are authorized. Every value that can affect the result must either be immutable/hardcoded or be included in the typed data: at minimum the asset/market and proceeds receiver when those are variable, and as applicable maximum rate/fee, rate mode, maturity, collateral selection, or other bounds. Otherwise a valid signature can be executed with terms the borrower did not sign. The amount must be the token's base-unit amount (`5_000e6` for a 6-decimal USDC deployment).

4. **Raw `ecrecover` edge cases.** `ecrecover` accepts non-canonical high-`s` signature twins and returns `address(0)` for malformed signatures. Consequently, an invalid signature passes the equality test when `borrower == address(0)`, subject to what `_borrow` does with that address. Malleability also means that `used[keccak256(signatureBytes)]` is **not** a safe patch: the same authorization can have different signature bytes. Consumption must be keyed by the signed nonce (or authorization digest), and canonical signature validation should be used.

5. **Cached-domain fork replay.** The current domain usefully binds normal signatures to this chain ID and this verifying-contract address, so it ordinarily prevents replay on a different chain ID or contract. However, permanently caching the constructor's chain ID leaves both sides of a later persistent chain split using the same pre-fork separator. A pre-fork authorization can then be accepted on both branches. A standard EIP-712 implementation rebuilds the separator when `block.chainid` changes.

# What we should ship

First, pause or disable the existing `borrowWithSig` entry point immediately. A safer overload, frontend change, private relayer, or new deployment does not neutralize the old public function or the signatures already exposed through it. If this is an upgradeable deployment, the upgraded implementation must make the legacy selector unreachable/revert. If it is immutable, the old market must be paused/decommissioned before migrating to a new market.

Then ship a versioned, one-time authorization. A representative implementation is:

```solidity
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from
    "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from
    "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArbiLend is EIP712, ReentrancyGuard {
    struct BorrowAuthorization {
        address borrower;
        address receiver;
        address asset;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 private constant BORROW_TYPEHASH = keccak256(
        "Borrow(address borrower,address receiver,address asset,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address borrower => uint256 nonce) public nonces;
    address public immutable USDC;

    constructor(address usdc) EIP712("ArbiLend", "2") {
        USDC = usdc;
    }

    function borrowWithSig(
        BorrowAuthorization calldata a,
        bytes calldata signature
    ) external nonReentrant {
        require(a.borrower != address(0), "zero borrower");
        require(a.receiver == a.borrower, "bad receiver");
        require(a.asset == USDC, "bad asset");
        require(block.timestamp <= a.deadline, "expired");

        uint256 current = nonces[a.borrower];
        require(a.nonce == current, "bad nonce");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_TYPEHASH,
            a.borrower,
            a.receiver,
            a.asset,
            a.amount,
            a.nonce,
            a.deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        require(
            SignatureChecker.isValidSignatureNow(
                a.borrower, digest, signature
            ),
            "bad signature"
        );

        // Consume before _borrow or any other external interaction. A revert
        // rolls this increment back; nonReentrant prevents reentrant reuse.
        nonces[a.borrower] = current + 1;
        _borrow(a.borrower, a.receiver, a.asset, a.amount);
    }
}
```

`SignatureChecker` supports both canonical EOA signatures and ERC-1271 contract wallets. If contract wallets are explicitly out of scope, current OpenZeppelin `ECDSA.recover` is sufficient. If proceeds may intentionally go to another address, keep `receiver` signed but remove the equality restriction; never derive it from the caller. If only a particular executor may submit, add `address executor` to the type hash and require `msg.sender == a.executor`. If permissionless gas sponsorship is intentional, do not bind an executor.

The monotonic per-borrower nonce makes authorizations execute in order. If the product needs several independently signed requests to execute out of order, use signed unique nonces with a consumed-nonce bitmap instead. In either design, expose a way for the borrower to invalidate pending nonces (including a correctly nonce-protected relayed cancellation if gasless cancellation is required). Increment/mark the nonce before external interactions and retain a reentrancy guard.

The domain version must be bumped (for example, from `"1"` to `"2"`) so old typed signatures cannot validate against the new verifier. Use OpenZeppelin `EIP712._hashTypedDataV4` rather than a permanently cached custom separator. A version bump is defense in depth during migration; it does not make the still-deployed legacy function safe, which is why disabling that function is mandatory.

# Incident response and acceptance tests

For this user, we should say plainly that the June debt came from replay of their valid one-time March instruction due to our missing on-chain replay protection. We should freeze interest and liquidation effects for the disputed debt while correcting it, reverse the unauthorized debt or compensate resulting loss under the incident policy, preserve both transactions as evidence, and confirm where the June proceeds went.

We should scan all historical `borrowWithSig` calls by digest/borrower/amount and reconcile repeated authorizations; byte-identical signature matching is useful for this incident but is not sufficient generally because ECDSA signatures are malleable. Users should be warned that all legacy borrow signatures remain dangerous until the old verifier is disabled.

Before reopening signature borrows, tests must prove that:

- the first valid authorization succeeds and its second use fails, including after repayment;
- concurrent/reentrant reuse fails;
- expired, skipped, consumed, and cancelled nonces fail;
- the wrong borrower, receiver, asset, amount, contract, chain, and (if used) executor fail;
- malformed, high-`s`, invalid-`v`, and zero-address signatures fail;
- domain version 1 signatures fail against version 2;
- changing chain ID changes the effective domain separator;
- the exact USDC base units and every mutable economic term are covered by the signed data; and
- the legacy function selector cannot borrow on the old deployment.
