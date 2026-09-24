# Post-mortem: cross-chain replay of gasless order signature

The mainnet deployment accepted the Base signature because the signed digest was
not actually Base-specific.

The order signature covered:

```text
owner, token, amount, nonce, deadline
```

and the EIP-712-style digest was:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

But the `DOMAIN_SEPARATOR` only included:

```text
name, version, address(this)
```

That is not enough when the same contract is intentionally deployed at the same
address on multiple chains.

On Base and mainnet, the contract had the same name, the same version, and the
same `address(this)` because of the shared CREATE2 factory and salt. The order
fields were also the same because the attacker submitted the exact same signed
order. Therefore the Base deployment and the mainnet deployment reconstructed
the same `structHash`, the same `DOMAIN_SEPARATOR`, and the same final digest.

ECDSA signatures are valid for a digest, not for a chain by themselves. Since
mainnet reconstructed the identical digest, `ecrecover` correctly recovered the
user's address there too.

The nonce check did not prevent this because nonce state is local to each
deployment. Marking nonce `N` used on Base only writes to Base storage. The
mainnet contract has a separate `usedNonces` mapping, where nonce `N` had never
been used. The deadline also remained valid on mainnet. So every local check on
mainnet passed.

This was a cross-chain replay vulnerability.

## Required fix

The signature domain must include the chain identity. Use the standard EIP-712
domain shape:

```solidity
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

and compute the domain separator with both:

```solidity
block.chainid
address(this)
```

For example:

```solidity
bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 private immutable _HASHED_NAME;
bytes32 private immutable _HASHED_VERSION;

function _domainSeparator() internal view returns (bytes32) {
    return keccak256(abi.encode(
        EIP712_DOMAIN_TYPEHASH,
        _HASHED_NAME,
        _HASHED_VERSION,
        block.chainid,
        address(this)
    ));
}
```

Then the digest should be built from `_domainSeparator()` rather than from a
domain separator that omits `chainId`.

With `chainId` included, the Base digest and mainnet digest differ even though
the contract address is identical. A signature produced for Base signs the Base
domain, including Base's chain id, so replaying the same signature on Ethereum
mainnet recovers either a different address or no authorized signer for the
mainnet digest.

Keeping the same contract address on every chain is fine. The address can remain
part of the domain as `verifyingContract`; it just cannot be the only deployment
specific value. The domain must bind signatures to both the contract and the
chain.

One implementation detail: avoid permanently caching a separator that assumes a
chain id forever unless you also handle chain-id changes. The usual OpenZeppelin
`EIP712` pattern caches the deployment chain id and cached separator, but
rebuilds the separator if `block.chainid` changes. Using OpenZeppelin's `EIP712`
base contract is the safest route.

After this change, the same nonce may still exist independently on each chain,
but the same signature cannot be consumed on multiple chains because each chain
requires a different signed digest.
