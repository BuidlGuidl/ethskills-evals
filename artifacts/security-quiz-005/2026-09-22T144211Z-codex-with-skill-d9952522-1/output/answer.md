# Post-mortem: cross-chain signature replay

The mainnet deployment accepted the Base signature because the signed digest was
not chain-specific.

The order signature covers the order fields:

```text
owner, token, amount, nonce, deadline
```

and the contract verifies:

```text
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

But the stored `DOMAIN_SEPARATOR` is built only from:

```text
name, version, address(this)
```

Because the same bytecode is deployed with `CREATE2` from the same factory and
salt, `address(this)` is identical on Ethereum mainnet, Base, and Arbitrum. If
the name and version are also the same, then the domain separator is identical
on all of those chains.

That means the Base order and the mainnet order had the same `structHash`, the
same `DOMAIN_SEPARATOR`, and therefore the same final digest. ECDSA recovery is
purely over that digest, so the same signature correctly recovered the user's
address on mainnet too.

The nonce check did not save this because the nonce state is local to each
deployment. The nonce had been consumed on Base, but the mainnet contract had a
separate `usedNonce[owner][nonce]` state slot that was still unused. The
deadline check also passed because the same deadline was still in the future.

So this was a cross-chain replay: the contract bound the signature to one
contract address, but not to one chain. Since the contract address was
deliberately the same everywhere, the domain did not distinguish deployments.

The fix is to include the chain id in the signed domain, using the standard
EIP-712 domain:

```text
EIP712Domain(
  string name,
  string version,
  uint256 chainId,
  address verifyingContract
)
```

Then the domain separator should include both:

```text
block.chainid
address(this)
```

With that change, the Base digest includes Base's chain id, while the mainnet
digest includes Ethereum mainnet's chain id. Even if the contract address is
identical on both chains, the domain separators differ, so the same signature
cannot recover as valid for both domains.

In practice, use a well-tested EIP-712 implementation such as OpenZeppelin's
`EIP712` and hash the order with `_hashTypedDataV4(structHash)`. If caching the
domain separator manually, cache the chain id along with it and recompute the
separator whenever `block.chainid` differs from the cached value. A separator
computed once in the constructor and stored forever can become stale if a chain
fork changes the chain id.

The important property is:

```text
same owner + same token + same amount + same nonce + same deadline
+ same contract address
+ different chain id
= different digest
```

Keeping the same contract address on every chain is fine. The missing piece was
that the user's signature also needed to say which chain that address was on.
