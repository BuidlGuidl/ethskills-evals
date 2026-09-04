The mainnet deployment accepted the Base signature because the signature was
not bound to a specific chain.

Reasoning:

1. The signed payload is:

```text
keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
```

2. `structHash` only covers:

```text
(owner, token, amount, nonce, deadline)
```

There is no chain-specific field in that struct.

3. Your `DOMAIN_SEPARATOR` is computed from:

- contract name
- version
- `address(this)`

There is also no chain-specific field there.

4. Because you deploy the same contract with `CREATE2` from the same factory
and salt, `address(this)` is the same on Base, Ethereum mainnet, and Arbitrum.
If the name and version are also the same, then the `DOMAIN_SEPARATOR` is the
same on every chain too.

5. That means the full digest signed by the user on Base was bit-for-bit
identical to the digest recovered on mainnet:

```text
digest_base == digest_mainnet
```

So `ecrecover` on mainnet returned the same signer, and the signature remained
valid there.

6. The nonce check did not stop this because your nonce tracking is local to
each deployment. Using nonce `N` on Base only marks `used[owner][N]` in the
Base contract storage. The mainnet contract has separate storage, so the same
nonce was still unused there.

7. The deadline check also passed because the copied signature was replayed
before expiration.

So the root cause is cross-chain replay: same signed digest, same contract
address, separate per-chain nonce storage.

What has to change:

The signature must commit to the intended chain. The standard way is to make
the EIP-712 domain include `chainId`.

Use a domain of the form:

```text
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

and compute the separator with the actual `block.chainid` for that deployment.

Then:

- Base signatures are bound to Base's chain ID
- Mainnet signatures are bound to mainnet's chain ID
- Arbitrum signatures are bound to Arbitrum's chain ID

Even if `address(this)` is identical on every chain, the domain separator will
be different because `chainId` differs. That makes the final digest different
on each chain, so a signature produced for Base will fail recovery/validation
on mainnet.

In other words:

```text
digest_base != digest_mainnet
```

and the replay stops.

Practical fix:

- Add `chainId` to the domain separator.
- Follow the standard EIP-712 domain type hash.
- Derive it from `block.chainid`, not from a hardcoded value.

Conceptually:

```solidity
DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        ),
        keccak256(bytes(name)),
        keccak256(bytes(version)),
        block.chainid,
        address(this)
    )
);
```

You can keep the same contract address on every chain. Identical addresses are
not the problem by themselves. The problem is that your signed domain omitted
the chain identifier, so identical addresses made the domain collide across
chains.

Optional defense-in-depth:

- Include `chainId` in the signed order struct as well, or
- use OpenZeppelin's `EIP712` implementation, which handles proper domain
  separation and chain ID behavior.

But the essential fix is: bind the signature to the chain with `chainId` in
the EIP-712 domain separator.
