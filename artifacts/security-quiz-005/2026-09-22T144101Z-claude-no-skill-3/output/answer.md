# Post-mortem: cross-chain signature replay in the gasless order relayer

## Summary

The signature was replayable because **nothing in the signed digest identifies the
chain**. Your EIP-712 domain is built from `name`, `version` and `address(this)` —
and because you deploy with CREATE2 from the same factory and salt, `address(this)`
is *byte-for-byte identical* on Ethereum, Base and Arbitrum. So every input to
`DOMAIN_SEPARATOR` is the same on every deployment, the digest is the same, the
recovered signer is the same, and each chain has its own independent nonce
bitmap. One user signature is therefore a valid, unused order on N chains at once.

The "one address everywhere" property you deliberately engineered is exactly what
removed the last accidental source of per-chain uniqueness.

## Why every check passed on mainnet

Walk the checks the contract makes, on the mainnet deployment, at 14:07:

1. **Signer recovery.** `ecrecover(digest, v, r, s)` is pure arithmetic. It has no
   notion of which chain it runs on. Given the same digest and the same signature
   it returns the same address on any EVM chain. The digest was identical (see
   below), so recovery returned the owner. Check passes — correctly, in the sense
   that the owner really did sign that digest.

2. **Nonce not used.** `nonces[owner][nonce]` is contract storage. Base storage and
   mainnet storage are unrelated. The Base execution at 14:02 set the bit in Base
   storage only. On mainnet the slot was still zero. Check passes.

3. **Deadline not passed.** The deadline is a wall-clock timestamp; `block.timestamp`
   on mainnet at 14:07 was inside the same 5-minute window. Check passes.

So the contract behaved exactly as written. The defect is in what was signed, not
in how it was verified.

### The digest is identical because the domain separator is identical

```
digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash))
```

- `structHash` = `keccak256(abi.encode(ORDER_TYPEHASH, owner, token, amount, nonce, deadline))`.
  Same order fields → same hash, on every chain. Nothing chain-specific here.
- `DOMAIN_SEPARATOR` = `keccak256(abi.encode(EIP712DOMAIN_TYPEHASH, keccak256(name),
  keccak256(version), address(this)))` — note the missing field.
  - `name`: same contract, same string.
  - `version`: same string.
  - `address(this)`: **same, by construction** — CREATE2 address is
    `keccak256(0xff ‖ factory ‖ salt ‖ keccak256(initcode))[12:]`, which contains
    no chain identifier. Same factory address, same salt, same initcode → same
    address on Ethereum, Base and Arbitrum.

Every component matches, therefore `DOMAIN_SEPARATOR` matches, therefore the digest
matches. The user signed one 32-byte digest that is simultaneously a valid mainnet
order, a valid Base order and a valid Arbitrum order. The 14:07 submitter did not
forge anything; they replayed a genuine signature into a different deployment that
happened to accept it.

This is precisely the replay that the `chainId` field of the EIP-712 domain exists
to prevent, and it is why EIP-712 specifies `verifyingContract` **and** `chainId` as
separate fields rather than treating the address as sufficient. The address is only
a good disambiguator under `CREATE`/nonce-derived deployment, where per-chain
deployer nonces usually differ by accident. CREATE2 removes that accident.

Two related notes:

- The token address does not save you either. USDC exists on all three chains, and
  even if the addresses differ, `amount` and `token` are just bytes in the struct —
  a replayer submits whatever the user signed and the contract has no basis to
  reject it. In your case the signed `token` field happened to be accepted on
  mainnet as the mainnet USDC address; had it not been, the transfer would have hit
  a different token or reverted, which is luck, not a control.
- A per-owner incrementing nonce instead of a bitmap would not have helped either.
  Nonce state is per-chain storage; chain B's counter simply has not reached that
  value yet.

## The fix

### 1. Put `chainId` in the domain (required)

Use the full EIP-712 domain type:

```solidity
bytes32 private constant _EIP712_DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);
```

and build the separator with `block.chainid` included:

```solidity
function _buildDomainSeparator() private view returns (bytes32) {
    return keccak256(
        abi.encode(
            _EIP712_DOMAIN_TYPEHASH,
            _HASHED_NAME,
            _HASHED_VERSION,
            block.chainid,
            address(this)
        )
    );
}
```

Now the Base digest and the mainnet digest differ in one field, so a Base signature
recovers to a garbage address on mainnet and the `signer == owner` check rejects it.
This keeps the identical CREATE2 address on every chain — `chainId` does the
disambiguating, not the address.

### 2. Do not freeze the separator in an immutable without a fork guard

Your current code computes the separator once in the constructor. Once `chainId` is
part of it, caching it unconditionally reintroduces a (narrower) version of the same
bug: after a contentious hard fork, both branches keep serving the pre-fork
`chainId`, so signatures remain cross-valid across the fork — the exact scenario
EIP-155 and EIP-1344 were written for.

Cache for gas, but re-derive if the chain id moved:

```solidity
uint256 private immutable _CACHED_CHAIN_ID;
bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
address private immutable _CACHED_THIS;

constructor(string memory name, string memory version) {
    _HASHED_NAME = keccak256(bytes(name));
    _HASHED_VERSION = keccak256(bytes(version));
    _CACHED_CHAIN_ID = block.chainid;
    _CACHED_THIS = address(this);
    _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator();
}

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    if (block.chainid == _CACHED_CHAIN_ID && address(this) == _CACHED_THIS) {
        return _CACHED_DOMAIN_SEPARATOR;
    }
    return _buildDomainSeparator();
}
```

(The `address(this)` half of the guard matters if the contract is ever reachable via
`delegatecall` / a proxy, where the cached value would belong to the implementation
rather than the proxy that users signed for.)

This is what OpenZeppelin's `EIP712` does; adopting it directly is the lowest-risk
path and gets you `_hashTypedDataV4` and `eip712Domain()` (EIP-5267) for free.

### 3. Use the ecrecover hygiene you need anyway

Since the domain change forces a redeploy or upgrade of the verification path, fix
the neighbouring footguns at the same time:

- `ecrecover` returns `address(0)` for malformed signatures — reject
  `signer == address(0)` explicitly, and never compare a recovered zero against an
  `owner` that could be zero.
- Enforce low-`s` and `v ∈ {27,28}` (or just use OpenZeppelin `ECDSA.recover`) so a
  malleated copy of a signature is not treated as a distinct signature. Your nonce
  check already blocks the double-spend on a single chain, but malleability breaks
  any off-chain deduplication you do by signature bytes.
- Keep the deadline check strict (`block.timestamp <= deadline`) and, given this
  incident, consider tightening default deadlines — a long window widens the replay
  opportunity for any future signature bug.

### 4. Migration and containment

- **Version bump.** When you redeploy, change the `version` string (e.g. `"1"` →
  `"2"`). This guarantees that signatures produced for the old, broken domain are
  not valid against the new contract, so no in-flight old signature can be replayed
  into the fixed deployment.
- **Retire the old deployments.** Pause / disable execution on the existing
  contracts on every chain. As long as any of them remain live and accept the
  chain-agnostic digest, already-signed orders sitting in mempools, relayer queues,
  logs or user wallets remain replayable on every chain where the user holds a
  balance and has an allowance. This is the urgent part of the remediation, ahead of
  the redeploy.
- **Allowance sweep.** Identify users with a live allowance to the old contract on
  more than one chain — those are the accounts still exposed — and get allowances
  revoked. Reconcile historical orders for other double-executions besides the one
  that was reported; the same class of replay could have happened silently on
  Arbitrum.
- **Relayer-side defence in depth.** Deduplicate by `(owner, nonce)` *and* by
  signature across all chains in your relayer, and refuse to submit an order whose
  signed payload does not carry a chain id. This does not fix the contract — anyone
  can submit directly, as the 14:07 attacker did — but it stops your own
  infrastructure from being the replay vector.
- **Wallet legibility.** With `chainId` in the domain, wallets display the target
  chain in the signing prompt. Under the current domain the user had no way to see
  which chain they were authorizing, so they could not have caught this themselves.

## One-line root cause

The EIP-712 domain omitted `chainId`, and CREATE2 deployment made
`verifyingContract` identical across chains, so the signed digest contained no
chain-binding information at all; the same signature was independently valid, with
independent nonce state, on every deployment.
