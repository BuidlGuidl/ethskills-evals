The mainnet deployment accepted the Base signature because the signed message was not bound to a specific chain.

Reasoning:

1. The contract verifies an EIP-712-style digest:

   `keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))`

2. `structHash` covers only:

   `(owner, token, amount, nonce, deadline)`

   None of those fields identifies the chain.

3. Your `DOMAIN_SEPARATOR` is computed from:

   - contract name
   - version
   - `address(this)`

   It does not include `chainId`.

4. Because you deploy the same bytecode with `CREATE2` from the same factory and salt, `address(this)` is the same on Base, Ethereum mainnet, and Arbitrum.

5. If the domain fields are only `(name, version, verifyingContract)`, then the domain separator is identical on every chain where:

   - the name is the same
   - the version is the same
   - the contract address is the same

   That is exactly your setup.

6. Therefore the full signed digest on Base and on mainnet was the same:

   - same `structHash`
   - same `DOMAIN_SEPARATOR`
   - same `\x19\x01` prefix

7. Since ECDSA signatures are over the digest only, the exact same signature recovers the same signer on every chain where that digest is reproduced.

8. Nonce tracking did not save you because the nonce is checked in per-chain contract storage. The Base deployment marked the nonce used only on Base. The mainnet deployment has separate storage, so the same nonce was still unused there.

That is why both executions passed:

- recovered signer matched
- deadline was still valid
- nonce was unused on that chain

Root cause:

The signature scheme omitted the chain identifier from the signed domain, so the signature was replayable across chains that shared the same contract address and order fields.

What must change:

The signed data must include the intended chain. The standard fix is to include `chainId` in the EIP-712 domain separator.

The domain should be conceptually:

- name
- version
- `chainId`
- verifying contract (`address(this)`)

For example, the separator should be derived from something equivalent to:

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
)
```

Why this fixes it:

- Base and mainnet can still use the same contract address.
- But `block.chainid` differs between Base and mainnet.
- So the domain separator differs between Base and mainnet.
- So the final digest differs between Base and mainnet.
- A signature produced for the Base digest will not validate against the mainnet digest.

This preserves your same-address deployment model while making each signature valid only on the chain whose `chainId` was signed.

Operationally, the frontend / signer must also sign against the correct per-chain domain, including the target chain's `chainId`.

Important implication:

Including only `address(this)` is not enough when the same contract address exists on multiple chains. `verifyingContract` distinguishes contracts at different addresses, not identical addresses on different networks. `chainId` is the missing anti-replay boundary.

In short:

The signature replay happened because your domain separator was identical across chains. Add `chainId` to the EIP-712 domain separator, and have users sign that chain-specific domain. Then one signature can only be used on the chain it was intended for.
