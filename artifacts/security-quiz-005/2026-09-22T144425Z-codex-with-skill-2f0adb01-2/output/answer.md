# Post-mortem: Cross-chain replay of gasless order signature

The mainnet deployment accepted the Base signature because the signed digest was identical on both chains.

The order signature was over:

```text
owner, token, amount, nonce, deadline
```

and the final digest was:

```text
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

The struct hash was the same on Base and mainnet because the attacker submitted the exact same order fields and signature. The domain separator was also the same because it was built only from:

```text
name, version, address(this)
```

Since the relayer contract is deployed with CREATE2 from the same factory and salt, `address(this)` is intentionally identical on Ethereum mainnet, Base, and Arbitrum. The contract name and version are also identical. Therefore the full EIP-712 digest was identical across chains.

ECDSA signatures do not inherently know which chain they were intended for. They only authenticate a message digest. If two chains produce the same digest, the same signature recovers the same signer on both chains.

That is why mainnet recovered the user as the owner.

The nonce check did not stop this because nonce usage is local contract storage. The nonce had been marked used in the Base deployment, but the mainnet deployment has separate storage and had never seen that nonce. The deadline also did not stop it because the replay happened before expiry.

So the bug was not that the nonce was checked after the signature, or that CREATE2 produced the same address. The bug was that the signature domain did not include a chain-specific value.

## Required fix

The EIP-712 domain must include `chainId`.

Use a domain equivalent to:

```solidity
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

and compute the domain separator with `block.chainid`:

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

With that change, the domain separators differ even when the contract address is the same:

```text
Ethereum mainnet: chainId = 1
Base:             chainId = 8453
Arbitrum One:     chainId = 42161
```

The same order fields would then produce different digests on each chain, so a signature made for Base would not recover as valid on mainnet.

Keeping the same contract address on every chain is fine. The address can remain part of the domain as `verifyingContract`; it protects against replay between different contracts on the same chain. The missing piece is `chainId`, which protects against replay between deployments at the same address on different chains.

Operationally, the frontend and relayer must also build the typed data with the intended chain's `chainId`, and wallets should be asked to sign that typed data for the target chain. Existing signatures produced under the old domain should be treated as unsafe for cross-chain replay and should be expired, cancelled, or migrated by changing the domain version.
