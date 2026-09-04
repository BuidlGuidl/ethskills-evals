# Incident explanation and remediation

## What happened

The June transaction did not require either private key to be compromised. The
March transaction published the complete signature in public calldata. Anyone
could copy it from the chain and call `borrowWithSig` themselves because the
function intentionally accepts calls from any address.

The signature is valid for this EIP-712 message:

```text
Borrow(borrower, 5000 USDC)
```

It does **not** say "borrow once," identify the March loan, expire, or depend on
the loan's repaid status. `ecrecover` therefore correctly recovered the user's
address in both March and June. Repayment changed the user's debt accounting,
but it did not consume or invalidate the signed message. The unknown address
simply replayed the publicly visible March calldata. A boarding pass is
consistent with this explanation but is not needed to establish it.

What we should tell the user is: **they authorized the signature, but our
contract incorrectly treated a one-time authorization as reusable. The fresh
debt was caused by a replay vulnerability in our authorization design, not by
evidence that their key was compromised or that they signed again.**

## Remaining exposure

This is not limited to replay after repayment.

- The same signature can be submitted repeatedly, including several times in
  consecutive transactions, for as long as `_borrow` permits more debt. It can
  consume collateral headroom, cause interest and fees, and potentially force
  liquidation. Every historical signature remains valid indefinitely.
- There is no cancellation mechanism and no deadline. A user cannot revoke an
  unsubmitted signature, and a copied or delayed authorization can be exercised
  years later.
- A relayer is not authenticated here. An approved relayer's transaction can be
  copied from the public mempool and front-run by anybody. Restricting the caller
  would reduce who can submit, but would not itself make an authorization
  one-time: an approved or compromised relayer could still replay it.
- The signed data must cover every user-controlled, security-relevant borrow
  term. If `_borrow` or later versions allow a recipient, market/asset,
  interest-rate bound, collateral choice, fee, or similar parameter that is not
  signed, the submitter can alter that parameter. If proceeds can be directed
  separately from `borrower`, the recipient must be signed in particular.
- The constructor-cached domain is normally scoped to this chain and contract,
  which prevents ordinary cross-contract and cross-chain replay. However, it
  remains tied to the deployment-time chain ID. On a chain fork or chain-ID
  change, signatures can remain valid under the stale domain, and a same-address
  deployment on a chain using that domain can create replay risk. Proxy
  deployments also require the domain to be initialized for the proxy, not an
  implementation contract.
- Raw `ecrecover` does not reject all non-canonical signatures and returns the
  zero address on failure. This is not the cause of this incident, but signature
  malleability can defeat a bad future fix that records used `(v,r,s)` bytes
  instead of consuming a nonce. `borrower == address(0)` must also be rejected.
- `ecrecover` only supports EOAs. If contract-wallet borrowers are supported,
  ERC-1271 validation is needed.

## What to ship

Pause or disable the current entry point immediately. An upgrade is not complete
while the old `borrowWithSig` remains callable: all old signatures would still
be replayable through it. Inventory historical calls and current positions for
duplicate digests/identical signatures, stop liquidations and accrual associated
with suspected replays, and remediate affected accounts under the incident
policy.

Replace the authorization with a new, versioned EIP-712 message containing a
per-borrower nonce and a deadline. Include every security-relevant term. A
minimal form is:

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
    require(SignatureChecker.isValidSignatureNow(borrower, digest, signature),
            "bad sig");

    // Consume before any external interaction in _borrow. A revert rolls this back.
    borrowNonces[borrower] = nonce + 1;
    _borrow(borrower, amount);
}

function invalidateBorrowNonce(uint256 newNonce) external {
    require(newNonce > borrowNonces[msg.sender], "nonce not advanced");
    borrowNonces[msg.sender] = newNonce;
}
```

Use audited OpenZeppelin `EIP712` plus `SignatureChecker` (or `ECDSA` if only
EOAs are deliberately supported), rather than raw `ecrecover`. This rejects
non-canonical ECDSA signatures and can support ERC-1271 wallets. OpenZeppelin's
EIP-712 domain logic also handles a changed chain ID. If signatures are meant to
be executable only by a particular relayer, add a signed `relayer` field and
require `msg.sender == relayer`; alternatively keep submission permissionless.
That choice is independent of nonce protection.

Use a new domain version (for example, `"2"`) and publish an updated typed-data
schema to clients. On an upgradeable deployment, use the upgradeable EIP-712
initializer and verify that `verifyingContract` is the proxy address. Preserve
nonce storage safely in an upgrade and do not reset it on later upgrades.

The nonce is the replay boundary: a successful borrow consumes exactly one
nonce, so copied calldata fails thereafter. The deadline limits the useful life
of leaked, delayed, or never-submitted signatures. `invalidateBorrowNonce`
allows a borrower to cancel outstanding authorizations by advancing past their
nonces (a bitmap or unordered nonce scheme is also acceptable if multiple
concurrent authorizations are required).

Before unpausing, tests should prove at least: first execution succeeds; an
identical replay fails both before and after repayment; a malleated signature
does not create a second authorization; expired, wrong-nonce, wrong-chain,
wrong-contract, and altered-field signatures fail; nonce consumption is safe
against reentrancy; cancellation works; ERC-1271 behavior matches the supported
wallet policy; and the legacy selector is disabled. Frontend and relayer code
must fetch the current nonce immediately before signing, show the deadline and
all borrow terms to the user, and treat a consumed nonce as final.
