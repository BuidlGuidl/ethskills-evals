The mainnet deployment accepted the Base signature because the signature was
not bound to Base.

The signed digest is:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

That is the EIP-712 digest shape, but the security boundary depends on what is
inside `DOMAIN_SEPARATOR`. In this case the domain separator was computed from:

- contract name
- version string
- `address(this)`

The contract is deliberately deployed with CREATE2 at the same address on
Ethereum mainnet, Base, and Arbitrum. The name and version are also the same.
Therefore the `DOMAIN_SEPARATOR` is the same on all three chains.

The order struct was also identical:

```text
(owner, token, amount, nonce, deadline)
```

So the exact same signed payload produced the exact same digest on Base and on
mainnet. Since ECDSA recovery is deterministic, mainnet recovered the same user
address. The nonce check did not protect against this because nonce usage is
stored separately per chain. The nonce had been consumed on Base, but the
mainnet contract's nonce bitmap or mapping had never seen it. The deadline also
remained valid. From mainnet's point of view, this was a fresh valid order.

This is a cross-chain replay vulnerability.

The fix is to bind the EIP-712 domain to the chain. The domain separator must
include `chainId`, as in the standard EIP-712 domain:

```solidity
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

Conceptually:

```solidity
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

With `block.chainid` included, the Base deployment and mainnet deployment may
still have the same contract address, name, and version, but they will produce
different domain separators because Base and mainnet have different chain IDs.
A signature over the Base digest will not recover the user when checked against
the mainnet digest, so it cannot be replayed there.

The practical change should be:

1. Add `uint256 chainId` to the EIP-712 domain separator.
2. Use that domain separator when users sign orders and when the contract
   verifies them.
3. Prefer deriving or validating the domain with `block.chainid` on-chain,
   rather than accepting a user-supplied chain ID.
4. If the separator is cached, make sure it is cached together with the chain
   ID and recomputed if `block.chainid` differs. This follows the common
   OpenZeppelin EIP712 pattern and also handles chain splits or forks more
   safely.

Keeping the same contract address on every chain is fine. The address is only
one part of the domain. The missing part was the chain identity.
