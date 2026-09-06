The mainnet deployment accepted the Base signature because the signed message was not actually bound to Base.

Reasoning:

1. The final digest is:

   `keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)`

2. `structHash` covered only `(owner, token, amount, nonce, deadline)`.
   Those values were the same when the signature was replayed on mainnet.

3. Your `DOMAIN_SEPARATOR` was computed from:
   - contract name
   - version
   - `address(this)`

4. Because you deploy the same contract with `CREATE2` from the same factory and salt, `address(this)` is the same on Base and mainnet.
   If name and version are also the same, then `DOMAIN_SEPARATOR` is also the same on both chains.

5. Therefore the digest on Base and the digest on mainnet were identical.
   The same signature recovered the same signer on both chains.

6. Nonce usage did not stop this because nonce storage is chain-local.
   The nonce was consumed on Base, but the mainnet contract has a different state trie and still saw that nonce as unused.

So the root cause is cross-chain replay: the signature was bound to a contract address, but not to a specific chain.

What has to change:

The signed domain must include `chainId`, as in standard EIP-712:

- `name`
- `version`
- `chainId`
- `verifyingContract`

That makes the Base domain separator different from the mainnet domain separator even if the contract address is identical on both chains. Then:

- the user signs a Base digest containing Base's `chainId`
- replaying that signature on mainnet produces a different digest
- `ecrecover` no longer matches the user's signer for the mainnet digest
- the replay fails

So you can keep the same contract address on every chain. The address is not the problem. The problem is that the domain omitted the chain identifier.

In practice, the contract should compute the separator with `block.chainid`, for example conceptually:

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

You can also include `chainId` inside the order struct itself, but that is redundant if you use the proper EIP-712 domain. The essential fix is: one of the signed components must be chain-specific, and the normal place is the EIP-712 domain separator.

Post-mortem summary:

- Why it happened: the signature domain was identical across Base and mainnet.
- Why checks passed: signer, nonce, and deadline were all evaluated independently on each chain.
- Required fix: bind signatures to `chainId` in the EIP-712 domain so a signature for Base is invalid on mainnet.
