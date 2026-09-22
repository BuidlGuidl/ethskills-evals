The mainnet deployment accepted the Base signature because the signed digest was
identical on both chains.

The order digest is:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

The `structHash` was the same because the attacker replayed the exact same
order:

```text
(owner, token, amount, nonce, deadline)
```

The `DOMAIN_SEPARATOR` was also the same because it was derived only from:

```text
name, version, address(this)
```

That would normally bind the signature to one deployed contract. But here the
project deliberately deploys the same bytecode to the same address on Ethereum
mainnet, Base, and Arbitrum using `CREATE2`. Since `address(this)` is identical
on those chains, it did not distinguish the deployments.

So the Base and mainnet contracts both reconstructed the same EIP-712 digest.
ECDSA recovery is purely over that digest and the signature, so both contracts
recovered the same owner. The nonce check did not save this because nonce state
is local to each chain: the nonce had been consumed on Base, but it was still
unused in the mainnet contract. The deadline also remained valid. Every local
check passed even though the user's intent was only Base.

This is a cross-chain replay caused by an incomplete signature domain.

The fix is to include the chain id in the EIP-712 domain separator. The domain
should include at least:

```text
name
version
chainId
verifyingContract
```

For example, the domain type should follow the normal EIP-712 shape:

```solidity
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

Then the Base digest and mainnet digest differ even when the contract address is
the same. A signature produced for Base, where `chainId == 8453`, will not verify
on Ethereum mainnet, where `chainId == 1`, because the mainnet contract will
build a different `DOMAIN_SEPARATOR` and therefore recover a different signer
from the same signature.

Keeping the same address on every chain is fine. The address can remain part of
the domain as `verifyingContract`, but it must not be the only deployment
identifier. The chain id is the missing part.

The implementation should either use OpenZeppelin's `EIP712` helper or compute
the domain separator as a function of `block.chainid` and `address(this)`.
If the separator is cached, the cached value must be associated with the chain id
used to compute it, and the contract should rebuild the separator if
`block.chainid` differs. This also avoids stale domain separators after chain
forks.

In short: the user signed once, but the contract's domain made "Base relayer
contract" and "mainnet relayer contract" indistinguishable because both had the
same name, version, and address. Add `chainId` to the EIP-712 domain so each
chain has a unique digest, while preserving the same contract address across
chains.
