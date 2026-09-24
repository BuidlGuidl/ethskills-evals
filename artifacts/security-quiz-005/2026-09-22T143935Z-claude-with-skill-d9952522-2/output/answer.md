# Post-mortem: cross-chain replay of a gasless order signature

## Summary

The order digest the user signed contains nothing that identifies *which chain*
the order was for. Every field that goes into it — the name string, the version
string, `address(this)`, and the order struct — is byte-for-byte identical on
Base and on mainnet. So the mainnet deployment computed the same digest, recovered
the same signer, and saw a valid order. The nonce and deadline checks could not
save you: nonce state is per-deployment storage, so a nonce burned on Base is
still fresh on mainnet, and a timestamp deadline is satisfied on every chain at
once.

This is not a bug in signature recovery. `ecrecover` did exactly the right thing.
The bug is in the *domain* of the signature: it is under-specified, so a single
signature authorizes the same action on every chain where an identical contract
exists.

## Why the mainnet contract accepted it

The digest is

```
keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

and your `DOMAIN_SEPARATOR` is

```solidity
// in the constructor, stored in an immutable
DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,address verifyingContract)"),
    keccak256(bytes(NAME)),
    keccak256(bytes(VERSION)),
    address(this)
));
```

Walk the inputs and ask which of them differs between Base and mainnet:

| Input | Base | Mainnet | Differs? |
|---|---|---|---|
| `name` | same constant | same constant | no |
| `version` | same constant | same constant | no |
| `verifyingContract` = `address(this)` | `0xABC…` | `0xABC…` | **no — CREATE2, same factory, same salt, same init code** |
| `structHash` (owner, token, amount, nonce, deadline) | user's order | user's order | no |

Nothing differs. The EIP-712 domain exists precisely to answer "where is this
signature valid?", and the canonical domain has four fields — `name`, `version`,
`chainId`, `verifyingContract`. You dropped `chainId`. Normally
`verifyingContract` alone still provides accidental separation, because the same
contract deployed with `CREATE` lands at different addresses on different chains
(different deployer nonces). Your CREATE2 same-address deployment strategy
deliberately removes that accidental separation. The nice UX property ("one
address to remember") and the missing `chainId` combine into a total replay:
the two defenses failed together, and you were relying on the weaker, implicit
one.

Note the timeline detail that confirms it. The order executed on Base at 14:02
and on mainnet at 14:07 — five minutes later, by a third party. The attacker did
not need a key, a bug in your relayer, or any privileged position. They only
needed to watch the Base mempool, copy the `(order, v, r, s)` calldata out of
your relayer's transaction, and resubmit the identical calldata to the mainnet
address. Every signature your relayer has ever broadcast is public and
replayable on every other chain you deploy to, for as long as its deadline has
not passed and the owner holds a balance there. Worse, the replay surface is not
limited to chains you support *today*: a signature is also valid on any chain
where someone later deploys the same init code via the same factory and salt —
which anyone can do permissionlessly.

## What has to change

### 1. Put `chainId` in the domain separator

Use the canonical EIP-712 domain type string, including `chainId`:

```solidity
bytes32 private constant _DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

function _buildDomainSeparator() private view returns (bytes32) {
    return keccak256(abi.encode(
        _DOMAIN_TYPEHASH,
        _HASHED_NAME,
        _HASHED_VERSION,
        block.chainid,     // read at runtime, not baked into init code
        address(this)
    ));
}
```

Now the Base digest and the mainnet digest differ in one word, so the mainnet
`ecrecover` returns some unrelated garbage address, which is not the owner, and
the order reverts. The signature is cryptographically scoped to exactly one
chain.

Two things about this that matter for your deployment model:

- **`block.chainid` must be read at runtime, never passed as a constructor
  argument.** A constructor argument becomes part of the init code, the init
  code hash feeds the CREATE2 address, and a per-chain argument would give you a
  *different* address on every chain — destroying the exact property you want to
  keep. Reading the opcode keeps the init code identical everywhere, so you keep
  one address on all chains while the signatures are still chain-scoped. You
  keep the UX and lose the vulnerability; they were never actually in tension.
- Fixing this changes the init code, so the fixed contract will sit at a
  *different* address than the current one — but still the same address on every
  chain, which is what you actually care about. You cannot patch the existing
  deployments; `DOMAIN_SEPARATOR` is immutable, and even if it weren't,
  outstanding signatures are already in the wild. This is a redeploy-and-migrate,
  not an upgrade. Bump the domain `version` string in the new contract too, so
  that even a deployment that somehow landed at the old address would not honor
  old signatures.

### 2. Cache the separator with the chain id, and re-derive on mismatch

Do not store the separator in a plain immutable and stop there. If a chain
hard-forks, `block.chainid` changes on one side of the fork, and a separator
frozen at deployment would keep validating signatures across the split — the
same replay bug, just between a chain and its fork instead of between two
chains. Cache both, and re-derive when they disagree:

```solidity
uint256 private immutable _CACHED_CHAIN_ID;
bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;

constructor() {
    _CACHED_CHAIN_ID = block.chainid;
    _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator();
}

function _domainSeparatorV4() internal view returns (bytes32) {
    return block.chainid == _CACHED_CHAIN_ID
        ? _CACHED_DOMAIN_SEPARATOR
        : _buildDomainSeparator();   // post-fork: recompute, do not reuse
}
```

This keeps the gas savings in the common case and stays correct after a fork.

### 3. Inherit OpenZeppelin's `EIP712` rather than hand-rolling it

All of the above — canonical typehash, `block.chainid` at runtime, chain-id
cache invalidation, `ShortString` name/version handling, `_hashTypedDataV4` —
is already implemented and audited in OpenZeppelin's `EIP712`. Hand-assembling
the digest is how the `chainId` field went missing in the first place. Combine
it with `ECDSA.recover` (which reverts on `address(0)` and rejects malleable
high-`s` signatures, both of which a raw `ecrecover` will happily hand you) and
`Nonces` for the signer-scoped nonce:

```solidity
contract OrderRelayer is EIP712, Nonces {
    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(address owner,address token,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    constructor() EIP712("OrderRelayer", "2") {}

    function execute(
        address owner, address token, uint256 amount,
        uint256 nonce, uint256 deadline, bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "expired");

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            ORDER_TYPEHASH, owner, token, amount, nonce, deadline
        )));

        address signer = ECDSA.recover(digest, signature);
        require(signer == owner, "bad signature");

        _useCheckedNonce(owner, nonce);          // effect, before the transfer
        SafeERC20.safeTransferFrom(IERC20(token), owner, msg.sender, amount);
    }
}
```

Keep the ordering as shown: consume the nonce *before* the token movement, so a
token with a transfer hook cannot reenter and spend the same nonce twice.

### Immediate response, before the redeploy

1. Stop the relayer from broadcasting on any chain until the fix ships — every
   broadcast is an oracle handing attackers a replayable signature.
2. Enumerate every signature your relayer has broadcast whose deadline has not
   yet expired, and treat each as replayable on mainnet, Base and Arbitrum.
   Affected users should revoke their token approval to the relayer contract on
   the chains where the order was not intended; without an approval the replay
   cannot move funds even though it passes the signature check. That is the only
   mitigation available to users right now, and it is the thing to communicate
   first.
3. Make the user whole for the duplicated 5,000 USDC.
4. Ship the redeployed contract, migrate the front end to request the new
   domain, and abandon the old address.

## The general rule

An off-chain signature is a bearer instrument, valid anywhere its digest can be
reproduced. Bind it to every axis you want to restrict, and assume any axis you
leave out is an axis the attacker gets to choose:

- **which chain** → `chainId` in the domain;
- **which contract** → `verifyingContract` in the domain;
- **how many times** → a signer-scoped nonce, consumed before assets move;
- **until when** → a deadline;
- **which app/schema** → `name` and `version`, bumped whenever semantics change.

Add a test that asserts it: build the digest under two different
`block.chainid` values (`vm.chainId`) and assert the digests differ and that a
signature made under one reverts under the other. That test would have caught
this before deploy, and it is worth pinning because the failure is invisible in
any single-chain test suite — which is exactly why it shipped.
