# Post-mortem: cross-chain replay of a gasless order signature

## 1. What the user actually signed

The digest is

```
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

and

```solidity
DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,address verifyingContract)"),
    keccak256(bytes(name)),
    keccak256(bytes(version)),
    address(this)
));
```

That digest is a function of exactly four things: the name, the version, the
contract address, and the order fields `(owner, token, amount, nonce, deadline)`.

Work through each of those on mainnet versus Base:

| Input | Base | Mainnet | Same? |
|---|---|---|---|
| `name` | same source file | same source file | yes |
| `version` | same source file | same source file | yes |
| `verifyingContract` | CREATE2 from same factory + salt | same factory + salt | **yes — by design** |
| `structHash` (owner, token, amount, nonce, deadline) | the order | the same order | yes |

Every input matches, so the digest matches, so the signature matches. The user
signed one 32-byte digest, and that one digest is the valid digest for this
contract *on every chain it is deployed to*. There is nothing in the signed
bytes that says "Base."

## 2. Why every check passed on mainnet

The three checks the contract makes are each correct in isolation, and none of
them is a cross-chain check:

- **`ecrecover(digest, v, r, s) == owner`** — true. The owner really did
  produce a signature over that exact digest. The contract has no way to know
  the owner meant it for a different chain, because "which chain" was never
  part of the digest.
- **`!usedNonce[owner][nonce]`** — true. Nonces are stored in contract storage,
  and storage is per-chain. Burning nonce *n* on Base writes to Base state; the
  mainnet deployment's storage slot for that nonce is still zero. The nonce map
  gives you replay protection *within one deployment*, never across
  deployments.
- **`block.timestamp <= deadline`** — true. Five minutes later, and timestamps
  are near-identical on all chains. A deadline bounds the *window*, not the
  *venue*.

So the mainnet execution was not a bug in any single check. The contract
faithfully verified a signature that was genuinely valid there. The defect is
upstream, in what the signature was bound to.

## 3. The root cause

**`chainId` is missing from the EIP-712 domain separator.**

EIP-712 defines the domain as the set of fields that scope a signature so it
cannot be reused somewhere the signer didn't intend. The full struct is:

```
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

`chainId` and `verifyingContract` are the two anti-replay fields, and they are
complementary:

- `verifyingContract` stops replay across *different contracts on the same chain*.
- `chainId` stops replay across *different chains*.

Dropping `chainId` normally still leaves partial protection, because the same
contract rarely lands at the same address on two chains — the address usually
differs and `verifyingContract` accidentally covers you.

Deterministic CREATE2 deployment deliberately removes that accident. By putting
the contract at the identical address on mainnet, Base and Arbitrum, the
`verifyingContract` field became a constant across chains, and with `chainId`
absent there was *no* domain field left that varied per chain. The domain
collapsed to a single value shared by all deployments, and a signature became a
bearer instrument redeemable once on each chain the user held a balance on.

The address convenience feature and the missing `chainId` were each survivable
alone. Together they were the vulnerability. This is why it went unnoticed:
before the multi-chain rollout the bug was latent and unexploitable.

A second, quieter instance of the same class is in the code as well: the
separator is computed in the constructor and stored `immutable`. Even after you
add `chainId`, an immutable separator freezes the chain id at deployment time.
If the chain hard-forks into two chains with different ids, the deployment on
the new fork keeps validating signatures under the *old* chain id — the same
replay hole, reintroduced by caching. Both must be fixed.

## 4. The fix

### 4.1 Put `chainId` in the domain

```solidity
bytes32 private constant _TYPE_HASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

function _domainSeparator() internal view returns (bytes32) {
    return keccak256(abi.encode(
        _TYPE_HASH,
        _hashedName,
        _hashedVersion,
        block.chainid,          // <-- the missing field
        address(this)
    ));
}
```

`block.chainid` is read at verification time, so the Base-signed order now
hashes to a different digest under the mainnet deployment, `ecrecover` returns
an address that is not the owner, and the call reverts. One signature, one
chain — enforced by the digest itself, not by a check that can be forgotten.

This keeps the identical CREATE2 address on every chain. Nothing about the
deployment process changes; the users keep their one address.

### 4.2 Keep the cache, but invalidate it on fork

Hashing two strings on every verification is real gas. The standard pattern
caches the separator *and* the chain id it was derived under, and falls back to
recomputation when they diverge:

```solidity
bytes32 private immutable _cachedDomainSeparator;
uint256 private immutable _cachedChainId;
address private immutable _cachedThis;

constructor() {
    _cachedChainId = block.chainid;
    _cachedThis = address(this);
    _cachedDomainSeparator = _domainSeparator();
}

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    if (block.chainid == _cachedChainId && address(this) == _cachedThis) {
        return _cachedDomainSeparator;
    }
    return _domainSeparator();          // post-fork, or via delegatecall/proxy
}
```

Rather than hand-roll this, inherit OpenZeppelin's `EIP712` and use
`_hashTypedDataV4(structHash)`. It implements exactly the above, including the
`address(this)` check that matters if the contract is ever used behind a proxy
or by delegatecall. Recovery should go through `ECDSA.recover` (which rejects
`s` in the upper half and the zero address that `ecrecover` returns on failure)
or `SignatureChecker.isValidSignatureNow` if smart-contract wallets are to be
supported — with ERC-1271, note that a signature valid for a wallet on one
chain may be valid for the counterfactual wallet at the same address on
another, which is a further argument for binding `chainId` into the digest.

### 4.3 Order of operations in the executing function

Keep the replay state write ahead of the token movement:

```solidity
require(block.timestamp <= deadline, "expired");
bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
    ORDER_TYPEHASH, owner, token, amount, nonce, deadline
)));
require(ECDSA.recover(digest, signature) == owner, "bad sig");
require(!usedNonce[owner][nonce], "nonce used");
usedNonce[owner][nonce] = true;              // effect before interaction
SafeERC20.safeTransferFrom(IERC20(token), owner, recipient, amount);
```

Note `abi.encode`, not `abi.encodePacked`, for the struct hash — packed
encoding of dynamic fields is ambiguous and can let two different orders hash
alike. The outer `abi.encodePacked("\x19\x01", separator, structHash)` is
correct and should stay, since all three parts are fixed-length.

Also make sure `token` is part of the signed struct (it is here) and that
`recipient` is either signed or hard-bound to `owner` — an unsigned,
relayer-chosen destination is a separate way to lose the funds.

## 5. Remediation checklist

1. Redeploy with `chainId` in the domain and the chain-id-guarded cache. The
   new contract is a different bytecode, so pick a new salt; the old address
   must be treated as compromised for all unexecuted signatures.
2. **The old signatures are still live.** Every order a user ever signed
   against the old contract remains redeemable on every chain where that
   deployment exists and the nonce is unused. Publish the new
   `DOMAIN_SEPARATOR`, pause or self-destructively disable the old deployments
   on all chains if a pause exists, and tell affected users to revoke the ERC-20
   allowance they granted the old contract on every chain — revoking the
   allowance is the only action that actually stops redemption, since the
   contract cannot invalidate a signature it is designed to honor.
3. Sweep for other deployments made from the same factory and salt pattern; if
   this domain-separator code is shared, they have the same hole.
4. Add a test that signs an order under chain id A and asserts the same
   signature reverts when the fork's chain id is B (`vm.chainId` in Foundry).
   Add an invariant test that no `(owner, nonce)` can be consumed twice.
5. Reimburse the user for the mainnet 5,000 USDC. They signed once; the loss
   came from our domain construction, not their behavior.

## 6. The one-line lesson

Deterministic cross-chain addressing removes the accidental replay protection
that `verifyingContract` was providing, so `chainId` in the EIP-712 domain
stops being best practice and becomes the only thing standing between one
signature and one execution per chain.
