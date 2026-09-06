The Base signature was accepted on Ethereum mainnet because the message being
signed did not include any chain-specific data.

Reasoning:

1. The signed digest is:

```text
keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
```

2. `structHash` only covers:

```text
(owner, token, amount, nonce, deadline)
```

There is no `chainId` in the struct.

3. Your `DOMAIN_SEPARATOR` is computed from:

- contract name
- version
- `address(this)`

There is still no `chainId` in the domain.

4. Because you deploy the exact same contract with `CREATE2` using the same
factory and salt, `address(this)` is the same on Base, Ethereum mainnet, and
Arbitrum.

5. If the name and version are also the same, then the stored
`DOMAIN_SEPARATOR` is identical on every chain.

6. Therefore the full digest signed on Base is bit-for-bit identical to the
digest checked on mainnet for the same `(owner, token, amount, nonce,
deadline)`.

So the mainnet contract did not see "a Base signature". It saw a valid
signature over the exact same digest that its own verification code computes.

Why all checks passed on mainnet:

- `ecrecover` returned the owner because the digest was the same.
- The nonce check passed because nonce usage is stored per deployment, and the
Base contract marking a nonce used does not affect mainnet storage.
- The deadline check passed because time-based validity was still open on both
chains.

This is a classic cross-chain replay issue.

What has to change:

The signature must commit to the destination chain. The standard way is to use
an EIP-712 domain that includes `chainId`, for example:

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

With that change:

- Base produces a domain separator containing Base's chain ID.
- Mainnet produces a different domain separator containing mainnet's chain ID.
- Even if `address(this)` is identical on both chains, the final digest differs.
- A signature produced for Base will fail verification on mainnet, and vice
versa.

This lets you keep the same contract address on every chain. The address is
not the problem by itself; the problem is that the signed domain omitted the
chain identifier.

Practical implication:

- Existing signatures generated under the old scheme are replayable across any
chain where the contract lives at the same address and the nonce is unused.
- You need a contract/signing-format upgrade so new signatures include
`chainId`.
- Off-chain signers and the relayer must sign and verify using the new
EIP-712 domain.

If you want an additional defense-in-depth measure, you can also include a
chain-specific field in the signed struct, but that is redundant if the
EIP-712 domain already includes `chainId`. The required fix is to bind the
signature to the chain in the domain separator.
