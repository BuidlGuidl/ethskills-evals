# Incident explanation

The June transaction did not require a new signature or a compromised key. The March signature is a valid signature over only this tuple:

```
(domain, borrower, amount)
```

Nothing in that signed message says “use once,” identifies a particular authorization, or says when it expires. The contract also records nothing when it accepts the signature. Consequently, after the March transaction, the exact same inputs still produce the exact same digest and recover the same borrower. Repayment changes the loan balance, but it does not consume or revoke the signature. It therefore made room for the old authorization to create debt again.

Transaction calldata is public. The unknown sender could have obtained `(borrower, amount, v, r, s)` from the March transaction and submitted it in June. `borrowWithSig` is callable by anyone, so the relayer's key or infrastructure need not have been involved. The boarding pass and the fact that the recovered signer is the user are entirely consistent with this explanation: the June caller replayed the user's authentic March authorization.

We should tell the user that this was an authorization-replay defect in our contract, not evidence that they signed in June or lost control of their key. On the facts given, the June debt should not be characterized as a second authorization by the user; incident response should freeze further signature borrowing and remediate the resulting position according to our incident/compensation policy.

# Other exposure

The signature is currently a permanent bearer instrument. Anyone who learns it can submit it:

- repeatedly, not merely once, including several times in adjacent transactions or blocks;
- immediately by copying a pending relayer transaction from the public mempool and front-running it;
- later whenever repayment, added collateral, a higher credit limit, or changed market conditions allow another borrow;
- after it has been leaked by a wallet, UI, log, database, analytics system, RPC provider, or prior calldata.

Existing collateral and borrow-limit checks may cap the damage at a given moment, but they do not repair authorization semantics. An allowlisted relayer would reduce who can call the function, but would not make an authorization single-use and would create a relayer-key trust point; it is not the fix.

The current EIP-712 domain does provide useful separation: ordinarily the signature is not valid for another verifying-contract address or a chain with a different chain ID. That does **not** prevent replay against this contract on this chain. A cached constructor domain separator is also awkward if the chain ID changes, and proxy/deployment details must be handled correctly.

There are two additional hardening issues:

- Raw `ecrecover` accepts malleable/non-canonical forms unless checked and returns `address(0)` on failure. At minimum, reject a zero borrower and use a recovery library that enforces a valid `v` and low-`s` signatures. Signature malleability is not the cause of this incident, and digest/nonce consumption would still be needed.
- Every action-affecting value must be signed. If the real borrow operation also has an asset/market, recipient, rate or slippage limit, relayer fee, or other user-selectable term, those fields must be in the typed struct (unless they are immutably fixed by this verifying contract). A nonce alone does not prevent an unsigned parameter from being altered.

# Fix to ship

First, pause or disable the existing `borrowWithSig` entry point. Merely adding a new safe function while leaving the old one callable leaves every old signature replayable. If this is an immutable deployment, deploy a replacement and pause/deprecate the old market through the available controls; do not ask users to migrate while the vulnerable route remains capable of adding debt.

Ship a new, versioned EIP-712 authorization with a per-borrower nonce and deadline. A representative implementation is:

```solidity
bytes32 private constant BORROW_TYPEHASH = keccak256(
    "Borrow(address borrower,uint256 amount,uint256 nonce,uint256 deadline)"
);

mapping(address => uint256) public nonces;

function borrowWithSig(
    address borrower,
    uint256 amount,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature
) external nonReentrant {
    require(borrower != address(0), "zero borrower");
    require(block.timestamp <= deadline, "expired");
    require(nonce == nonces[borrower], "invalid nonce");

    bytes32 structHash = keccak256(
        abi.encode(BORROW_TYPEHASH, borrower, amount, nonce, deadline)
    );
    bytes32 digest = _hashTypedDataV4(structHash);
    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature), "bad sig");

    // Consume before any externally interacting loan logic. A revert rolls this back.
    nonces[borrower] = nonce + 1;
    _borrow(borrower, amount);
}
```

Use audited EIP-712 and signature utilities (for example OpenZeppelin `EIP712`, `ECDSA`, and, if contract-wallet borrowers are supported, `SignatureChecker`). Use an upgrade-safe variant when this is behind a proxy. These utilities construct the domain separator using the current chain ID and verifying contract correctly. Set a new domain version such as `"2"` as defense in depth and to make the schema/protocol change explicit. Most importantly, remove or permanently revert the version-1 verification path.

The actual type should additionally bind every security-relevant term, for example:

```solidity
Borrow(
    address borrower,
    address asset,
    uint256 amount,
    address receiver,
    uint256 maxRate,
    uint256 relayerFee,
    uint256 nonce,
    uint256 deadline
)
```

Only include fields that exist in the product, but leave none of those terms controlled solely by calldata. If proceeds must always go to the borrower and there is no fee, enforce that in the contract rather than adding unnecessary flexibility.

A monotonically increasing nonce gives simple, ordered single-use authorizations. The signing client must read `nonces[borrower]`, show all signed terms to the user, choose a short deadline, and submit both with the signature. Provide an authenticated `invalidateNonce`/`cancelUpTo` mechanism so a borrower can invalidate outstanding signatures; since the product promises gasless operation, cancellation can itself be a carefully domain-separated signed action submitted by a relayer. If concurrent independent authorizations are a requirement, use a borrower-scoped unordered nonce bitmap or unique salt with `used[borrower][nonce]`, rather than weakening replay protection.

Before unpausing, test at least these properties:

1. A valid authorization succeeds exactly once; an identical second call reverts even after full repayment.
2. Expired, wrong-nonce, altered-amount, altered-recipient/fee/market, wrong-chain, and wrong-contract messages revert.
3. Front-running the exact signed call can at most execute the same intended action once and cannot redirect proceeds or change fees; the relayer's later copy reverts.
4. Invalid, high-`s`, malformed, and zero-address signatures revert, while supported smart-contract-wallet signatures work.
5. Cancellation invalidates outstanding authorizations, nonce consumption is atomic on failure, and upgrade/proxy domain behavior is correct.

Finally, inventory successful historical calls and exposed signatures, monitor for duplicate digests/call data, preserve the March and June transactions for the incident record, and treat every version-1 signature as permanently compromised public data. There is no reliable way to distinguish a “legitimate relayer” copy from an attacker copy after such a signature has been published; invalidating the entire old authorization format is required.
