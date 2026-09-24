# Post-mortem: cross-chain replay of gasless order signature

The mainnet deployment accepted the Base signature because the signed digest
was identical on both chains.

The digest is:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

The `structHash` came from the order fields:

```text
owner, token, amount, nonce, deadline
```

None of those fields says "this order is for Base". The domain separator also
did not say that. It was built only from:

```text
name, version, address(this)
```

Because the relayer contract is deployed with `CREATE2` at the same address on
Base, Ethereum mainnet, and Arbitrum, `address(this)` is the same everywhere.
The name and version are also the same everywhere. Therefore the
`DOMAIN_SEPARATOR` is the same everywhere.

That means the exact same order produced the exact same EIP-712 digest on Base
and on mainnet. Since ECDSA signatures prove only that the owner signed that
digest, the mainnet contract recovered the same owner from the same signature.
From mainnet's point of view, all local checks were true:

- the recovered signer was the owner;
- the mainnet nonce had not been used, because the Base execution only marked
  the Base contract's storage;
- the deadline had not passed;
- the digest matched what the owner signed, because the digest did not include
  the chain.

So the signature was replayable across chains. The identical contract address
made this especially easy, because the only deployment-specific value in the
domain was no longer deployment-specific.

The fix is to bind the signature to the intended chain. For EIP-712, the normal
way to do that is to include `chainId` in the domain separator:

```solidity
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

Conceptually:

```solidity
DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        EIP712_DOMAIN_TYPEHASH,
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        block.chainid,
        address(this)
    )
);
```

With `chainId` included, the Base digest and the mainnet digest are different
even though the relayer address is identical. A signature produced for Base's
domain will not recover the owner for mainnet's domain, so the mainnet replay
fails at signature verification.

Keeping the same address on every chain is fine. The address can remain stable;
the domain must not be identical. The chain ID is the missing differentiator.

In implementation, use the standard EIP-712 domain fields, including both
`block.chainid` and `address(this)`. Either compute the separator with
`block.chainid` during construction on each chain, or use a standard EIP-712
implementation that caches the separator and rebuilds it if `block.chainid`
changes. Off-chain signing code must use the same domain and must show/sign the
intended chain's `chainId`.

The invariant we want is:

```text
same order + same relayer address + different chainId => different digest
```

Once that is true, one signature can only be valid on the chain it was meant
for.
