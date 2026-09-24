# Post-mortem: cross-chain signature replay in the gasless order relayer

## Summary

The order digest is not bound to a chain. The EIP-712 domain separator was
built from `(name, version, address(this))` and omits `chainId`. Because we
deploy with CREATE2 from the same factory and salt, `address(this)` is
*identical* on mainnet, Base and Arbitrum — so the one field that could have
distinguished the deployments is the same value everywhere. Every input to
`DOMAIN_SEPARATOR` is byte-for-byte equal on all three chains, therefore the
digest is equal, therefore a signature valid on Base is valid on mainnet.

The replay protection we do have (nonces) is per-contract state, and each
deployment has its own storage. Burning nonce *n* on Base says nothing about
nonce *n* on mainnet. Nonces stop replay *within* a chain; only the domain
can stop replay *across* chains. We had neither.

## Why every check passed on mainnet

Walk the mainnet execution with the Base signature:

- **Signer recovery** — `ecrecover` is a pure function of `(digest, v, r, s)`.
  The digest is identical, the signature bytes are identical, so it returns the
  owner. Nothing about recovery is chain-aware; there is no chain data in the
  256-bit digest to check against.
- **Nonce** — mainnet's `usedNonces` mapping is a fresh, independent storage
  slot. The Base execution wrote to Base storage. On mainnet the nonce had
  genuinely never been used.
- **Deadline** — a timestamp, meaningful and roughly equal on both chains, and
  only 5 minutes had passed.

So this is not a bug in the checks. The checks were correct; they were checking
a statement that was weaker than what we believed the user had authorised. The
user signed "move 5,000 USDC with nonce N before deadline D" — they never
signed "...on Base," because there was no field in which to say it.

The user experienced this as one signature, two charges. From the contract's
point of view it was two valid authorisations, because the authorisation object
we asked them to sign genuinely was valid twice.

## The role of the identical CREATE2 address

Worth being explicit, because it is the part that made this exploitable rather
than merely latent. A correctly-specified EIP-712 domain has two independent
binding fields:

- `chainId` — which chain
- `verifyingContract` — which contract

Under our deployment model, `verifyingContract` carries *zero* disambiguating
information across chains: the vanity-address property we sold to users is
exactly the property that collapses that field. That is fine — `chainId` is the
field that is supposed to do this job — but it means the domain has no
redundancy. Dropping `chainId` went from "sloppy" to "fully replayable" solely
because of the shared address. A project with per-chain addresses would have had
the same bug and never seen it fire.

We want to keep the shared address. That is a legitimate choice. It just means
`chainId` is load-bearing and must be present.

## Second, subtler bug: `DOMAIN_SEPARATOR` in an `immutable`

Even after adding `chainId` to the struct, computing the separator once in the
constructor and freezing it in an `immutable` is wrong. `block.chainid` is read
at deploy time and baked into the code. If the chain hard-forks (or the chain
ID is otherwise changed), the deployed contract keeps asserting the *old* chain
ID forever — and the fork carries a byte-identical copy of our code and the
user's balances. Signatures are then replayable between the original chain and
the fork, which is the same failure we just had, in slow motion.

The standard fix is to cache the separator for the common case but re-derive it
whenever `block.chainid` no longer matches the cached one.

## What has to change

### 1. Put `chainId` in the EIP-712 domain

Use the full standard domain type:

```solidity
bytes32 private constant _DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);
```

Note the typehash itself changes, so all previously-issued signatures are
invalidated by construction. That is the desired outcome here, not a migration
problem to work around.

### 2. Re-derive the separator on chain-ID change

```solidity
bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
uint256 private immutable _CACHED_CHAIN_ID;
address private immutable _CACHED_THIS;

bytes32 private immutable _HASHED_NAME;
bytes32 private immutable _HASHED_VERSION;

constructor(string memory name_, string memory version_) {
    _HASHED_NAME    = keccak256(bytes(name_));
    _HASHED_VERSION = keccak256(bytes(version_));

    _CACHED_CHAIN_ID          = block.chainid;
    _CACHED_THIS              = address(this);
    _CACHED_DOMAIN_SEPARATOR  = _buildDomainSeparator();
}

function _buildDomainSeparator() private view returns (bytes32) {
    return keccak256(
        abi.encode(
            _DOMAIN_TYPEHASH,
            _HASHED_NAME,
            _HASHED_VERSION,
            block.chainid,      // read live, not captured
            address(this)
        )
    );
}

function _domainSeparatorV4() internal view returns (bytes32) {
    if (block.chainid == _CACHED_CHAIN_ID && address(this) == _CACHED_THIS) {
        return _CACHED_DOMAIN_SEPARATOR;
    }
    return _buildDomainSeparator();
}
```

(The `address(this)` half of the guard matters if the contract is ever
`delegatecall`ed into, e.g. behind a proxy — it is cheap, keep it.)

This is exactly OpenZeppelin's `EIP712` implementation. Prefer inheriting it
over hand-rolling; the only reason to write it out is that we need to be sure
what we're inheriting.

### 3. Use `abi.encode`, not `abi.encodePacked`, inside hashes

The outer digest assembly is fine and must stay `encodePacked`:

```solidity
keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash))
```

— all three operands are fixed-width, and `\x19\x01` is the required prefix. But
the domain hash and the struct hash must use `abi.encode` (32-byte-padded
fields), per EIP-712. `encodePacked` over dynamic types is ambiguous and can
collide. Worth auditing `structHash` while we're in here; the report doesn't say
how it's built.

### 4. Verify the struct hash covers every field, padded

```solidity
bytes32 private constant _ORDER_TYPEHASH = keccak256(
    "Order(address owner,address token,uint256 amount,uint256 nonce,uint256 deadline)"
);

bytes32 structHash = keccak256(
    abi.encode(_ORDER_TYPEHASH, owner, token, amount, nonce, deadline)
);
```

### 5. Do not add chainId to the Order struct instead

A tempting shortcut is to leave the domain alone and add a `chainId` field to
the order itself. It works, but it is non-standard: wallets render the domain
specially, `eth_signTypedData_v4` already injects and checks `chainId` against
the connected network, and tooling assumes the standard domain. Put it where
the standard puts it.

### 6. Check `ecrecover` failure explicitly

Not the cause here, but adjacent and cheap: `ecrecover` returns `address(0)` on
malformed input. If `owner` can ever be zero — or if a caller supplies garbage
and we compare against an unset value — that's a free forge. Require
`recovered != address(0) && recovered == owner`, and reject `s` values in the
upper half of the curve order plus `v ∉ {27,28}` to avoid signature
malleability. Use OpenZeppelin's `ECDSA.recover`, which does both.

## Why this fixes it

After the change, the mainnet deployment computes its separator with
`chainId = 1` and the Base deployment with `chainId = 8453`. The two domain
separators differ, so the two digests differ, so a signature produced over the
Base digest recovers to *some other address* when checked against the mainnet
digest — an address that is not the owner, and in practice is unrelated garbage.
The mainnet call reverts at the signer check. The user's intent ("on Base") is
now encoded in the thing they actually signed.

The shared CREATE2 address is preserved: `chainId` is a constructor-independent
runtime value, so it does not enter the init code and does not perturb the
CREATE2 address computation. Same address on every chain, different domain on
every chain.

## Immediate actions

1. Redeploy with the corrected domain. The typehash change invalidates all
   outstanding signatures; that is required, since every signature issued under
   the old contract is replayable on every chain we support. Treat the whole
   outstanding set as compromised.
2. Announce and nonce-invalidate: any order signed under the old contract and
   executed on exactly one chain is still executable on the others until the
   old deployments are retired. Front-run our own users' exposure by burning
   their outstanding nonces on the remaining chains, or pause the old
   deployments if they have a pause. Enumerate every signature we have relayed
   and check for un-replayed twins.
3. Make the user whole for the 5,000 USDC.
4. Add a regression test that is structurally incapable of passing under the
   old code: sign an order once, execute it against a deployment forked at
   `chainId = 8453`, then assert the same calldata reverts against a deployment
   at `chainId = 1`. `vm.chainId()` in Foundry makes this a ten-line test.
5. Add an invariant/fuzz test asserting `DOMAIN_SEPARATOR` differs for any two
   distinct chain IDs.

## Root-cause note for the writeup

The proximate cause is a missing field. The deeper cause is that we adopted the
*shape* of EIP-712 (the `\x19\x01` prefix, a "domain separator", a struct hash)
without treating the domain as a security-relevant specification with required
fields. A domain separator that omits a field isn't a weaker domain separator —
against an attacker who controls which chain to submit to, it's no domain
separator at all in that dimension. Any future signing scheme we add should be
reviewed against the question "what are the axes along which this signature
could be replayed, and which field pins each one?" — chain, contract, user,
ordering, time. Here: `chainId`, `verifyingContract`, `owner`, `nonce`,
`deadline`. We had four of five.
