The Base signature was also valid on Ethereum mainnet because the thing the user
actually signed was not chain-specific.

Reasoning:

1. The signed digest is:

```text
keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
```

2. `structHash` covers `(owner, token, amount, nonce, deadline)`.
   None of those fields says which chain the order is for.

3. Your `DOMAIN_SEPARATOR` is computed from:
   - contract name
   - version
   - `address(this)`

4. Because you deploy the same contract with `CREATE2` from the same factory and
   salt, `address(this)` is the same on Base, mainnet, and Arbitrum.

5. If `name` and `version` are also the same, then the `DOMAIN_SEPARATOR` is the
   same on every chain too.

6. Therefore the full EIP-712-style digest is identical on every chain for the
   same order fields. A signature produced for Base also recovers the same signer
   on mainnet.

That is why the mainnet deployment accepted the Base signature: from the
contract's point of view, it was not a "Base signature". It was a signature over
data that looked exactly the same on both chains.

Why the existing checks did not stop it:

- Signer recovery succeeded because the digest was identical.
- The nonce check succeeded because nonce usage is tracked in separate contract
  storage on each chain. Using nonce `N` on Base does not mark nonce `N` used on
  mainnet.
- The deadline check succeeded because the signature was replayed before expiry.

So this was a cross-chain replay, not a bad recovery or bad nonce implementation.

What must change:

The signed domain must include the chain identity, typically `chainId`, as part
of the EIP-712 domain separator.

The standard domain is:

```text
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

That means the domain separator should include both:

- `block.chainid`
- `address(this)`

With that change:

- Base produces a domain separator using Base's chain ID.
- Mainnet produces a different domain separator using Ethereum mainnet's chain
  ID.
- The same `(owner, token, amount, nonce, deadline)` then hashes to different
  final digests on different chains.
- A signature made for Base will fail recovery/verification on mainnet.

You can still keep the same contract address on every chain. The address is not
the problem by itself. The problem is that the domain currently depends on the
address but not on the chain. Same address across chains is safe only if the
domain also binds the signature to `chainId`.

Practical fix:

```solidity
bytes32 private constant EIP712_DOMAIN_TYPEHASH =
    keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

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

Then verify signatures against that domain.

Operationally, any already-issued signatures created under the old scheme are
replayable across your supported chains whenever:

- the contract address matches across chains,
- the order fields match,
- and the nonce is still unused on the other chain.

So fixing new deployments or new signature versions is necessary, and old
signatures should be treated as unsafe until expired or invalidated.
