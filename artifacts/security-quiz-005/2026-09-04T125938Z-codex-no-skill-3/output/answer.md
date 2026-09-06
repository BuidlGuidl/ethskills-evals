The Base signature was also valid on Ethereum mainnet because the signed digest was not bound to a specific chain.

Reasoning:

1. The relayer verifies a digest of the form:

```text
keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
```

where `structHash` covers only:

```text
(owner, token, amount, nonce, deadline)
```

2. Your `DOMAIN_SEPARATOR` is computed from:

- contract name
- version
- `address(this)`

and stored once in the constructor.

3. Because you deliberately deploy the same bytecode with the same CREATE2 factory and salt, the contract address is identical on Base, Ethereum mainnet, and Arbitrum.

4. If the name and version are also the same, then the `DOMAIN_SEPARATOR` is the same on every chain, because nothing in it distinguishes Base from mainnet.

5. If the order fields are the same, then `structHash` is also the same on every chain.

6. Therefore the final digest is identical on every chain:

```text
digest(Base) == digest(Mainnet)
```

So a signature produced for the Base deployment also recovers the same signer on mainnet.

That is exactly why the mainnet execution passed all checks:

- signer recovery succeeded because the digest was identical
- the nonce check succeeded because nonce usage is chain-local storage, so “unused on Base” and “unused on mainnet” are independent facts
- the deadline check succeeded because the signature was replayed before expiry

The core bug is cross-chain replay. The contract address being the same across chains is not itself the problem. The problem is that the signed domain omitted the chain identity.

What has to change:

The signature domain must include `chainId`, as in standard EIP-712 domain separation. For example:

```solidity
keccak256(
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

Then:

- Base uses `chainId = 8453`
- Ethereum mainnet uses `chainId = 1`
- Arbitrum One uses `chainId = 42161`

Even with the same contract address on all chains, the domain separator differs, so the digest differs, so the same signature cannot be replayed across chains.

In other words:

```text
digest = hash(domain(name, version, chainId, contractAddress), order)
```

not:

```text
digest = hash(domain(name, version, contractAddress), order)
```

Practical conclusion:

- Keep the same contract address on every chain if you want.
- But every deployment must derive its domain separator from that chain’s `chainId`.
- Signatures created under the old scheme are unsafe for multi-chain identical-address deployments because they are valid anywhere the same contract and token/account conditions exist.

If you want one signature to be valid on one chain only, the signed data must commit to that chain, either:

- in the EIP-712 domain via `chainId` (the standard fix), or
- as an explicit chain field inside the signed struct

The standard and preferred fix is the first one: include `chainId` in the domain separator.
