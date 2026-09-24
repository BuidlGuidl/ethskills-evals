The mainnet deployment accepted the Base signature because the signed message
was not actually chain-specific.

The contract is using the EIP-712 style digest:

```solidity
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

but its `DOMAIN_SEPARATOR` is computed only from:

- contract name
- version string
- `address(this)`

Because the contract is deployed with `CREATE2` from the same factory and salt,
`address(this)` is identical on Ethereum mainnet, Base, and Arbitrum. If the
name and version are also identical, then the `DOMAIN_SEPARATOR` is identical on
all three chains.

The order struct also does not include a chain identifier:

```text
(owner, token, amount, nonce, deadline)
```

So the `structHash` for the order is the same on every chain where those values
are meaningful. That means the final digest signed by the user on Base is
bit-for-bit identical to the digest verified by the mainnet deployment.

The nonce check did not stop the replay because nonces are tracked separately in
each chain's contract storage. The nonce had been used on Base, but the mainnet
contract has its own storage and had never seen that nonce. The deadline had not
expired, and the recovered signer was still the user, because the signature was
valid for the exact same digest.

In short: same domain separator plus same order hash produced the same signed
message on every chain. The same address on every chain is fine, but using only
that address as the deployment-specific domain is not enough when the address is
intentionally identical.

The fix is to include the chain id in the signed domain, as EIP-712 normally
does:

```solidity
EIP712Domain(
    string name,
    string version,
    uint256 chainId,
    address verifyingContract
)
```

The domain separator should commit to `block.chainid` as well as
`address(this)`. Then the Base deployment and the mainnet deployment have
different domain separators even though they have the same contract address.
A signature produced for Base recovers correctly only against the Base digest;
the same signature checked on mainnet is checked against a different digest and
must fail.

Keeping the same contract address on every chain does not conflict with this.
The address can remain identical; the domain just needs another piece of context
that differs between chains. `chainId` is the standard piece of context for
that.

The safer implementation pattern is:

```solidity
bytes32 private constant EIP712_DOMAIN_TYPEHASH =
    keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

bytes32 private immutable NAME_HASH;
bytes32 private immutable VERSION_HASH;

function _domainSeparator() internal view returns (bytes32) {
    return keccak256(
        abi.encode(
            EIP712_DOMAIN_TYPEHASH,
            NAME_HASH,
            VERSION_HASH,
            block.chainid,
            address(this)
        )
    );
}
```

If the contract stores the separator immutably, it must have been computed with
the chain id included:

```solidity
DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        EIP712_DOMAIN_TYPEHASH,
        NAME_HASH,
        VERSION_HASH,
        block.chainid,
        address(this)
    )
);
```

Computing it dynamically, or using a cached separator that is invalidated when
`block.chainid` changes, is generally preferable. That protects against unusual
chain-id changes such as forks. OpenZeppelin's EIP712 implementation follows
this shape.

The order type may also include an explicit `uint256 chainId` field, but that
should be treated as defense in depth, not as a replacement for proper EIP-712
domain separation. The primary fix is that the domain separator itself must
include `chainId`.

After this change, signatures from the old domain should be considered unsafe
for cross-chain replay. The system should deploy a fixed verifier/relayer
contract or otherwise change the signing domain/version so wallets and relayers
cannot accidentally continue producing signatures under the replayable domain.
