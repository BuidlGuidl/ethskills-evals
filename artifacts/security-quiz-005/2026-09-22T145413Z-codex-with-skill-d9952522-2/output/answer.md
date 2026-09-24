# Post-mortem: cross-chain replay of gasless order signature

The mainnet deployment accepted the signature because the signed digest was
not bound to a chain.

The order digest is:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

The `structHash` covers:

```text
owner, token, amount, nonce, deadline
```

The `DOMAIN_SEPARATOR` covers only:

```text
name, version, address(this)
```

Because the contract is deployed with `CREATE2` from the same factory and salt,
`address(this)` is identical on Ethereum mainnet, Base, and Arbitrum. The name
and version are also identical. That means the domain separator is identical on
all supported chains.

So, for the same order fields, the Base deployment and the mainnet deployment
compute the same EIP-712 digest. `ecrecover` therefore returns the same owner on
both chains.

The nonce check did not stop this because nonce usage is stored in each
deployment's own chain-local storage. The Base contract marked the nonce used on
Base, but the mainnet contract had a separate `usedNonces` state and had never
seen that nonce. The deadline also still held. From mainnet's point of view,
the signature was valid, fresh, and authorized.

The bug is that the domain separator omitted `chainId`. The verifying contract
address alone is not enough when the same address intentionally exists on
multiple chains.

## Required fix

Bind the signature to the intended chain. Use the standard EIP-712 domain with
`chainId` and `verifyingContract`, for example:

```solidity
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

Then compute the domain separator using the current chain id:

```solidity
keccak256(
    abi.encode(
        EIP712_DOMAIN_TYPEHASH,
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        block.chainid,
        address(this)
    )
)
```

Off-chain signing must include the same `chainId` in the typed-data domain. A
Base order must be signed with Base's chain id, so the digest recovered by the
Base contract differs from the digest recovered by the mainnet contract. The
same signature will then recover the owner only on the chain it was intended
for; on other chains, the digest changes and the signature fails.

This does not require changing the deployment address. The contract can keep the
same address everywhere. The uniqueness comes from the EIP-712 domain:

```text
same name + same version + different chainId + same contract address
= different domain separator
```

In implementation, prefer OpenZeppelin's `EIP712` helper rather than a custom
cached immutable separator. If caching manually, cache the chain id together
with the separator and recompute when `block.chainid` differs from the cached
chain id. This avoids stale domain separators and keeps the replay boundary tied
to the live chain id.

Existing signatures produced under the old domain should be treated as unsafe
for cross-chain replay and invalidated or migrated. Users should sign new
typed-data orders that include the intended `chainId` in the domain.
