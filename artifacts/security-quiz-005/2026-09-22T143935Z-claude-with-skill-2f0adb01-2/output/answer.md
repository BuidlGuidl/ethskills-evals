# Post-mortem: cross-chain replay of a gasless order signature

## Summary

The signature was replayable because **the EIP-712 domain separator does not
contain `chainId`**. Every other field you feed into it — the name string, the
version string, and `address(this)` — is *identical on Base and on mainnet*,
precisely because you deploy with CREATE2 from the same factory and salt. With
no chain-specific input, the domain separator computed by the Base deployment
and the domain separator computed by the mainnet deployment are the same 32
bytes, so the digest the user signed for Base is bit-for-bit the digest the
mainnet contract recovers against.

Nothing "failed" in the sense of a check being skipped. The mainnet contract
did exactly what it was told: the digest matched, `ecrecover` returned the
owner, the nonce had never been used *in mainnet storage*, and the deadline was
in the future. The bug is that the signed message never said which chain it was
for, so "the order the user authorized" and "the order the mainnet contract
believed it saw" were the same object.

## Why each of the existing checks was powerless

- **Signer recovery.** `ecrecover` tells you *who* signed *this digest*. It
  cannot tell you what the signer thought the digest meant. If the digest is
  ambiguous across chains, so is the recovery.
- **Nonce.** Nonces live in contract storage, and storage is per-deployment.
  Base's `usedNonces[owner][nonce] = true` write is invisible to mainnet.
  A nonce is replay protection *within one contract on one chain*, and nothing
  more. It is not, and never was, cross-chain protection.
- **Deadline.** A deadline bounds *when* a signature is usable, not *where*.
  Within the 5-minute window (14:02 → 14:07) both executions were timely.

Cross-chain scoping is the domain separator's job, and only the domain
separator's job. That is exactly what EIP-712 put `chainId` in the domain for.

## The two defects in the construction

### 1. `chainId` is missing from the domain

The EIP-712 canonical domain type is:

```
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

Your domain separator was built from `name`, `version`, and
`verifyingContract` only. `verifyingContract` normally *does* provide
separation between deployments — on different chains contracts usually land at
different addresses, which is why this bug often stays hidden. CREATE2 with a
shared factory and salt deliberately removes that accidental protection. You
chose vanity address parity, which is a fine product decision, but it means
`verifyingContract` carries zero entropy across chains and `chainId` is the
*only* thing left that can distinguish Base from mainnet. It wasn't there.

### 2. The separator is cached in an `immutable` at construction

Even once you add `chainId`, computing it once in the constructor and freezing
it into an immutable is wrong on its own: if the chain hard-forks, `block.chainid`
changes for the new chain while the deployed bytecode keeps serving the old,
now-stale separator. Both forks would then accept the same signatures — the same
class of bug, different trigger. The separator must be recomputed whenever
`block.chainid` no longer matches the value captured at deployment.

## The fix

Include `block.chainid` in the domain, and re-derive the separator on a chain-id
mismatch:

```solidity
bytes32 private constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
uint256 private immutable _CACHED_CHAIN_ID;
bytes32 private immutable _HASHED_NAME;
bytes32 private immutable _HASHED_VERSION;

constructor() {
    _HASHED_NAME    = keccak256(bytes("GaslessOrderRelayer"));
    _HASHED_VERSION = keccak256(bytes("1"));
    _CACHED_CHAIN_ID = block.chainid;
    _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator();
}

function _buildDomainSeparator() private view returns (bytes32) {
    return keccak256(abi.encode(
        DOMAIN_TYPEHASH,
        _HASHED_NAME,
        _HASHED_VERSION,
        block.chainid,        // ← the missing binding
        address(this)
    ));
}

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    return block.chainid == _CACHED_CHAIN_ID
        ? _CACHED_DOMAIN_SEPARATOR          // hot path: no extra hashing
        : _buildDomainSeparator();          // post-fork: recompute
}
```

and use `DOMAIN_SEPARATOR()` (the function) when building the digest:

```solidity
bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
```

Now Base's separator and mainnet's separator differ in the `chainId` word, the
digests differ, and a signature produced for Base recovers to *some other
address* on mainnet — almost certainly not the owner — so the `recovered == owner`
check rejects it. The 14:07 transaction would have reverted.

In production, don't hand-roll this: inherit OpenZeppelin's `EIP712` and use
`_hashTypedDataV4(structHash)`. It implements exactly the cache-and-recompute
logic above, and it is the audited version of the code you just read.

## Things this does *not* require you to give up

**You keep the same address on every chain.** `chainId` lives in the signed
domain, not in the deployment. Same factory, same salt, same bytecode, same
address on all three chains — the separator simply evaluates differently at
runtime on each one because `block.chainid` differs. There is no tension between
the vanity-address property and the fix.

**Deploying with the chain id baked into the salt is the wrong fix.** It would
also separate the domains, but by changing the address per chain — losing the
exact property your users value, and doing it for a reason `chainId` already
handles for free.

## Remediation checklist

1. **Ship the corrected contract** with `chainId` in the domain to all three
   chains. Since the domain changes, every existing outstanding signature becomes
   invalid against the new deployment — that is desirable here. Bump the version
   string (`"1"` → `"2"`) as well so the break is explicit and legible offchain.
2. **Treat all currently-outstanding signatures as compromised.** Any order
   signed under the old domain and executed on one chain is still replayable on
   the others against the *old* deployment. Pause or disable the old deployments
   if you have that capability; otherwise notify affected users and, where
   possible, burn their outstanding nonces on every chain by submitting a
   self-cancel.
3. **Audit the mainnet and Arbitrum deployments** for other replays of orders
   already executed on Base in the same window. The 5,000 USDC case may not be
   the only one — the attacker's playbook is trivially repeatable and they were
   watching Base settlement.
4. **Add a regression test** that fuzzes the digest across chain ids: sign under
   `chainId = 8453`, assert recovery fails under `chainId = 1`. Foundry's
   `vm.chainId()` makes this a five-line test, and it is the test whose absence
   let this ship.
5. **Verify the other signature-consuming paths** (cancellation messages,
   any admin-signed messages) use the same corrected `_hashTypedDataV4` helper
   rather than a second hand-rolled digest.

## The generalizable lesson

`ecrecover` answers "did this key sign these 32 bytes." Every constraint on what
those bytes *mean* — which contract, which chain, which order, valid until when,
usable once — has to be encoded into the bytes themselves or enforced in storage.
The domain separator is the "which contract, which chain" half, and you dropped
half of that half. The failure was made reachable by a deployment choice
(identical CREATE2 addresses) that silently removed the redundancy normally
provided by `verifyingContract`. Whenever a deployment decision removes a source
of entropy, the invariants that were leaning on it need to be re-checked
explicitly.
