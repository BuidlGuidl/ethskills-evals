The root cause is that the signed message was not bound to a chain.

Your final digest is:

```text
keccak256("\x19\x01" || DOMAIN_SEPARATOR || structHash)
```

and your `DOMAIN_SEPARATOR` is built once from:

- contract name
- version
- `address(this)`

That is not enough to distinguish Ethereum mainnet from Base or Arbitrum.

Because you deliberately deploy the same bytecode with `CREATE2` from the same factory and salt, `address(this)` is the same on every supported chain. If the name and version are also the same, then:

- `DOMAIN_SEPARATOR` on Base = `DOMAIN_SEPARATOR` on mainnet
- `structHash(owner, token, amount, nonce, deadline)` is the same everywhere for the same order
- therefore the final digest is the same everywhere
- therefore the same signature recovers the same signer everywhere

So the mainnet contract did not "mistakenly" accept a Base signature. From the contract's point of view, it was the exact same message, because nothing in the signed payload said "this is for Base only".

The nonce check did not save you because nonces are tracked per deployment. The Base contract marked the nonce used in Base storage only. The mainnet contract has separate storage, so the same nonce was still unused there.

The fix is to make the domain separator chain-specific by including `chainId`, as EIP-712 intends:

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

- Base uses `chainId = 8453`
- Ethereum mainnet uses `chainId = 1`
- Arbitrum One uses `chainId = 42161`

Even if the contract address is identical on all chains, the domain separators differ, so the digest differs, so a signature produced for Base will not verify on mainnet.

What has to change operationally:

1. The wallet or backend that prepares the typed-data signature must include the intended `chainId` in the EIP-712 domain.
2. The contract must verify against a domain separator that also includes the current chain's `block.chainid`.
3. Existing signatures produced under the old scheme should be treated as replayable across every chain where the contract exists at the same address.

Keeping one address on every chain is fine. The address is not the problem by itself. The problem is that you relied on the address as the only domain boundary across chains. A cross-chain-safe domain needs both:

- `verifyingContract = address(this)`
- `chainId = block.chainid`

In short: the signature replay happened because your domain separator was identical on every chain. Add `chainId` to the signed domain so one signature is valid only on the chain it was created for.
