# Post-mortem: cross-chain replay of a gasless order

The mainnet deployment accepted the Base signature because the signed digest
was not bound to a chain.

The contract used an EIP-712-style digest:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

but the `DOMAIN_SEPARATOR` was built only from:

- the contract name
- the version string
- `address(this)`

That is not enough in this deployment model. We intentionally deployed the same
bytecode with CREATE2 from the same factory and salt, so the relayer contract
has the same address on Base, mainnet, and Arbitrum. Since the name, version,
and verifying contract address are also the same, the domain separator is the
same on every chain.

The order struct was also the same:

```text
(owner, token, amount, nonce, deadline)
```

So the `structHash` was identical, and the `DOMAIN_SEPARATOR` was identical.
Therefore the final digest signed by the user on Base was byte-for-byte the
same digest that the mainnet contract later verified.

Nothing in `ecrecover` tells the contract which chain the user thought they
were signing for. It only proves that the private key signed that exact digest.
Because the digest was valid on both chains, mainnet recovered the same owner.

The nonce check also did not stop the replay because nonce state is per-chain.
When the order executed on Base, only the Base contract's storage marked that
nonce as used. The mainnet deployment has separate storage, and that nonce had
not been used there. The deadline check passed for the same reason it passed on
Base: it is just a timestamp bound inside the same reusable message.

The root issue is that `address(this)` is not globally unique. It is only unique
inside one chain's state. A signature domain that includes the verifying
contract address but omits `chainId` can be replayed across chains whenever the
same contract address and signing fields exist on those chains.

## Required fix

Include the chain id in the signed domain, using the standard EIP-712 domain:

```solidity
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

The domain separator should include `block.chainid`:

```solidity
bytes32 private constant EIP712_DOMAIN_TYPEHASH =
    keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

function _domainSeparator() internal view returns (bytes32) {
    return keccak256(
        abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            keccak256(bytes(NAME)),
            keccak256(bytes(VERSION)),
            block.chainid,
            address(this)
        )
    );
}
```

Then the digest remains:

```solidity
keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash))
```

The off-chain typed data shown to the user's wallet must also include the same
`chainId` in its EIP-712 domain. A Base order must be signed with Base's chain
id. Mainnet verification will then compute a different domain separator because
mainnet has a different chain id, producing a different digest. The old Base
signature will recover to the wrong address or fail validation on mainnet.

Keeping the same contract address on every chain is fine. The address can stay
identical as long as the signature domain includes something that is different
per chain. `chainId` is the canonical field for that purpose.

In practice, use OpenZeppelin's EIP-712 implementation or mirror its behavior:
cache the domain separator together with the chain id, and recompute it if
`block.chainid` changes. The important security invariant is:

```text
signature validity = order fields + verifying contract + intended chain
```

With `chainId` included, a nonce only needs to be unique within that chain's
contract state, and a signature made for Base cannot be replayed on Ethereum
mainnet or Arbitrum.
