The mainnet deployment accepted the signature that was produced for Base because the signature was not actually bound to Base.

Your order digest is:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

That is the EIP-712 envelope, so the only thing that can distinguish "this order for Base" from "this same order for mainnet" is the domain separator and the signed struct contents.

The signed struct contents were:

- `owner`
- `token`
- `amount`
- `nonce`
- `deadline`

Those fields do not include the chain id. They also do not include anything deployment-specific beyond what may already be implied by the domain.

Your `DOMAIN_SEPARATOR` was computed once in the constructor from:

- contract name
- version
- `address(this)`

Because you intentionally deploy the same contract to the same address on Base, Arbitrum, and Ethereum mainnet via `CREATE2`, those domain inputs are the same on every chain:

- same name;
- same version;
- same contract address.

So the domain separator on Base and on mainnet is identical.

That means:

1. The user signs a digest on Base.
2. The exact same digest is reconstructed on mainnet, because both `structHash` and `DOMAIN_SEPARATOR` are the same there.
3. `ecrecover` returns the same signer on both chains.
4. The nonce check passes on both chains because nonce usage is stored per deployment, and Base state is independent from mainnet state.
5. The deadline check passes on both chains because time-based validity is also chain-agnostic.

So from the mainnet contract's perspective, this was not a foreign-chain signature. It was a perfectly valid signature over its own local digest.

The root cause is missing chain separation in the signed domain.

Under EIP-712, the domain must include `chainId` specifically to stop this class of cross-chain replay. The standard domain type is typically:

```solidity
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

If `chainId` had been part of your domain separator:

- Base would hash the order with Base's chain id.
- Mainnet would hash the same order with Ethereum mainnet's chain id.
- Those digests would differ.
- A signature produced for the Base digest would not recover to the owner's address for the mainnet digest.

That is the required fix: include `block.chainid` in the EIP-712 domain separator, and verify signatures against that chain-bound domain.

Concretely, the domain separator should be derived from at least:

- name
- version
- `block.chainid`
- `address(this)`

For example:

```solidity
bytes32 private constant EIP712_DOMAIN_TYPEHASH =
    keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

bytes32 private immutable _DOMAIN_SEPARATOR;
uint256 private immutable _DOMAIN_CHAIN_ID;

constructor(...) {
    _DOMAIN_CHAIN_ID = block.chainid;
    _DOMAIN_SEPARATOR = keccak256(
        abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            block.chainid,
            address(this)
        )
    );
}

function domainSeparator() public view returns (bytes32) {
    if (block.chainid == _DOMAIN_CHAIN_ID) {
        return _DOMAIN_SEPARATOR;
    }

    return keccak256(
        abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            block.chainid,
            address(this)
        )
    );
}
```

Or better, use OpenZeppelin's `EIP712`, which already handles correct domain construction and chain id changes.

The detail about computing the separator once in the constructor and storing it in an immutable matters for a second reason too: if the chain id ever changes relative to deployment context, a permanently cached separator can become stale. OpenZeppelin's implementation avoids that by invalidating the cached separator when `block.chainid` differs.

Most importantly, though, your immediate incident was not caused by staleness after a fork. It was caused by never including chain id in the domain in the first place.

To keep the same contract address on every chain, nothing about the fix conflicts with that goal. You can still deploy to the identical address everywhere. The signature becomes chain-specific because `chainId` differs even when `verifyingContract` does not.

So the correct model is:

- same contract address across chains: fine;
- same domain separator across chains: unsafe;
- same signature reusable across chains: must be impossible.

After the fix, one signature can only ever be valid on the chain whose `chainId` was part of the signed domain.
