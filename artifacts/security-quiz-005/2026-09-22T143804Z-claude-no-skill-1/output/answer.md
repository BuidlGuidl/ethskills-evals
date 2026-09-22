# Post-mortem: cross-chain replay of a gasless order signature

## Summary

The EIP-712 domain separator omits `chainId`. Every other input to it
(`name`, `version`, `verifyingContract`) is byte-for-byte identical on every
chain you deploy to — the first two because you ship the same source, the
third because CREATE2 with the same factory and salt is deliberately giving
you the same address everywhere. So `DOMAIN_SEPARATOR` is the same 32 bytes
on Base and on mainnet, the digest is the same, the signature is the same,
and a signature produced "for Base" is by construction also a valid mainnet
signature. The user signed one message; that message was never bound to a
chain, so it authorised one transfer *per deployment*.

## Why every check still passed on mainnet

Each of the contract's checks is correct in isolation — none of them is a
chain check.

- **Signer recovery.** `ecrecover` returns the owner because the owner really
  did sign that exact digest. The digest contains no chain information, so
  recovery on mainnet succeeds exactly as it did on Base.
- **Nonce.** The used-nonce mapping is contract *storage*. Storage does not
  cross chains. The mainnet deployment has its own, independent mapping, in
  which that nonce had never been marked. Nonces prevent replay *within* one
  deployment; they do nothing across deployments. The two contracts are at
  the same address but are two separate state machines.
- **Deadline.** A timestamp is a wall-clock value, equally valid on both
  chains for the five minutes between 14:02 and 14:07.

So there was no bug in the checks. The bug is upstream of them: the digest
under-specifies what was authorised. The signed message means "move 5,000
USDC, nonce N, before deadline D, at contract 0xABC…" and never "…on Base."

This is precisely the replay class EIP-712's domain separator exists to
prevent. The `EIP712Domain` struct has five canonical fields — `name`,
`version`, `chainId`, `verifyingContract`, `salt` — and `chainId` is the one
that makes two deployments of the same code distinguishable. Normally
`verifyingContract` incidentally provides cross-chain separation, because
contracts deployed by an EOA land at different addresses on different chains
(different deployer nonces). Your CREATE2 vanity-address setup removes that
accident. It didn't create the vulnerability — it removed the thing that was
masking it.

Worth naming explicitly: the second execution did not need the relayer or any
privileged access. The signature is public the moment the Base transaction
lands in a block (or in the mempool). Anyone watching Base can copy the
calldata and replay it on every other chain you've deployed to, against any
user who has a balance and an allowance there. Assume this is systematic, not
a one-off.

## The fix

### 1. Put `chainId` in the domain separator

Use the full canonical domain type:

```solidity
bytes32 private constant _TYPE_HASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

function _domainSeparator() internal view returns (bytes32) {
    return keccak256(abi.encode(
        _TYPE_HASH,
        _HASHED_NAME,      // keccak256(bytes(name)), precomputed
        _HASHED_VERSION,   // keccak256(bytes(version))
        block.chainid,
        address(this)
    ));
}
```

This is enough to fix the reported incident, and it costs you nothing you
care about: the address stays identical on every chain, because the domain
separator is computed from the address, not the other way round. Users keep
their one address to remember; the *signature* stops being portable.

Note this must be the real `EIP712Domain` type string and the real field
order. Wallets compute the domain separator themselves from the domain object
your frontend supplies; if your contract's hashing disagrees with the
standard by so much as field order, signatures simply won't verify.

### 2. Do not cache it in an `immutable` unconditionally

`immutable` values are fixed at construction. If you write `block.chainid`
into an immutable in the constructor, you have hardcoded the chain ID at
deploy time — which is correct until the chain hard-forks and the new fork
keeps your deployed bytecode with a different `block.chainid`. Then your
cached separator names the old chain and signatures replay across the fork.

Use the standard cache-with-fork-check (this is what OpenZeppelin's `EIP712`
does):

```solidity
uint256 private immutable _CACHED_CHAIN_ID;
address private immutable _CACHED_THIS;
bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;

constructor(string memory name, string memory version) {
    _HASHED_NAME = keccak256(bytes(name));
    _HASHED_VERSION = keccak256(bytes(version));
    _CACHED_CHAIN_ID = block.chainid;
    _CACHED_THIS = address(this);
    _CACHED_DOMAIN_SEPARATOR = _domainSeparator();
}

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    if (block.chainid == _CACHED_CHAIN_ID && address(this) == _CACHED_THIS) {
        return _CACHED_DOMAIN_SEPARATOR;
    }
    return _domainSeparator();   // recompute after a fork
}
```

The `address(this)` check matters if the contract is ever `delegatecall`ed or
used behind a proxy, where `address(this)` at runtime differs from the
deploying context.

The strong recommendation is to inherit OpenZeppelin's `EIP712` rather than
hand-roll this. It gets the type hash, the field order, the caching and the
fork handling right, and exposes `eip712Domain()` (ERC-5267) so wallets and
indexers can discover your domain instead of guessing it.

### 3. Keep `abi.encodePacked` only for the final digest

`keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))` is
correct and is the one place packed encoding is required — all three operands
are fixed-length. Inside the domain and the order struct, use `abi.encode`
with pre-hashed dynamic fields. `abi.encodePacked` over two adjacent dynamic
values is its own hash-collision hazard; don't let it spread.

Also check the order's own `structHash` while you're in there: `owner`,
`token`, `amount`, `nonce`, `deadline` must all be in the type string and all
be encoded, each as a 32-byte word. An unencoded field is a field the signer
did not actually authorise.

## Remediation for the existing deployments

Adding `chainId` changes the domain separator, which invalidates every
outstanding signature. That is the desired outcome here, but it has to be
handled deliberately:

- **Redeploy rather than patch in place.** New address (new salt), or if you
  must keep the address and it's behind a proxy, upgrade and bump the domain
  `version` string so old signatures cannot verify against the new logic.
- **Treat all currently-outstanding signatures as compromised.** Any order
  already executed on one chain is replayable on the others right now. Pause
  the old deployments if you have that ability.
- **Tell affected users to revoke allowances** to the old contract address on
  every chain. Your contract can only move tokens it has an allowance for;
  revoking the allowance is the only user-side action that definitively ends
  the exposure for signatures already in the wild.
- **Sweep history.** For every order executed on any chain, check whether the
  same signature also landed on another. Reimburse. The incident you caught
  is unlikely to be the only one.

## What I'd add beyond the minimum fix

- **Test it.** A regression test that builds a digest under chain A's domain
  and asserts the verify call reverts when `block.chainid` is chain B. Both
  Foundry (`vm.chainId`) and Hardhat can do this. Without such a test this
  bug is invisible, since single-chain tests pass either way.
- **Cross-check against the wallet.** Assert in a test that your on-chain
  digest equals what `ethers`/`viem`'s `signTypedData` produces for the same
  domain object, so contract and frontend can't silently diverge.
- **Implement ERC-5267 `eip712Domain()`** so the domain is discoverable and
  auditable off-chain.
- **Reconsider the identical-address design.** It is fine to keep — the fix
  above makes it safe for *this* contract — but it means no future
  signature-verifying contract you deploy gets accidental cross-chain
  separation from its address either. Make "is `chainId` in the domain?" a
  standing checklist item for anything signature-based.
- **Audit sibling flows.** Any other place you verify a user signature —
  meta-transactions, permits, off-chain approvals, cancellations — likely
  shares the same domain-separator helper and the same defect.

## One-line answer

Mainnet accepted the Base signature because the digest never said "Base":
`chainId` was missing from the EIP-712 domain, and CREATE2 made
`verifyingContract` identical too, so the two chains produced the same digest
from the same order. Add `block.chainid` to the domain separator (cached with
a fork check, not a bare `immutable`), and the address can stay the same
everywhere while the signature stops being portable.
