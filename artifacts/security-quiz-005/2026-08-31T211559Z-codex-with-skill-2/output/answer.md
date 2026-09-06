The mainnet deployment accepted the Base signature because the signed message was not bound to a specific chain.

Your digest is:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

That is standard EIP-712 shape, but the safety depends entirely on what is inside `DOMAIN_SEPARATOR`.

From your description, `DOMAIN_SEPARATOR` is computed once from:

- contract name
- version
- `address(this)`

and stored immutably.

Because you deploy the same bytecode with `CREATE2` from the same factory and salt, the relayer contract has the same address on Base, Ethereum mainnet, and Arbitrum. If the name and version are also the same, then the domain separator is also the same on every chain, because every input used to build it is identical on every chain.

That means:

1. The Base contract and the mainnet contract produce the same `DOMAIN_SEPARATOR`.
2. The order fields `(owner, token, amount, nonce, deadline)` are also identical.
3. Therefore `structHash` is identical.
4. Therefore the final EIP-712 digest is identical.
5. Therefore the exact same signature recovers the same signer on both chains.

So the signature was not "for Base" in any cryptographic sense. It was valid for any deployment that shared that same domain separator and order struct.

Why your onchain checks all passed on mainnet:

- `recover` returned the owner because the digest was identical.
- The nonce check passed because nonce usage was tracked separately on mainnet and Base.
- The deadline check passed because time validity was also independent per chain.
- The token transfer succeeded because the user also had USDC on mainnet.

This is a classic cross-chain replay. The root cause is that the signing domain omitted `chainId`.

What has to change:

The EIP-712 domain must include `chainId` so a signature is valid only on the intended chain.

The domain should include at least:

- `name`
- `version`
- `chainId`
- `verifyingContract`

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

With that change:

- Base and mainnet will have different domain separators even though the contract address is the same.
- The Base signature digest will differ from the mainnet digest.
- Submitting the Base signature on mainnet will fail signature recovery / verification.

Important nuance:

Keeping the same contract address on every chain is fine. The address is not the problem by itself. The problem is using the same address **without also binding signatures to `block.chainid`**.

Implementation guidance:

- If you are implementing EIP-712 manually, include `block.chainid` in the domain separator.
- Better: use OpenZeppelin's `EIP712`, which handles the domain correctly.
- If you cache the domain separator, cache it together with the chain id, or recompute when `block.chainid` changes. For most deployments, computing it with the deployment chain's `block.chainid` is enough, but the key point is that chain id must be part of the domain.

Bottom line:

The user signed once, but they signed a message that was valid on every chain where your relayer lived at the same address and used the same domain fields. To make one signature valid on only one chain, include `chainId` in the EIP-712 domain separator.
