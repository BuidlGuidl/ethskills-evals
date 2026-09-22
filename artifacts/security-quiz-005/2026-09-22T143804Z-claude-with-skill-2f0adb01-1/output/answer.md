# Post-mortem: cross-chain replay of a gasless order signature

## Summary

The signature was replayable because **the EIP-712 domain separator does not
contain `chainId`**. Every other guard in the contract is a *per-chain* guard,
so none of them could have caught it. Combined with CREATE2 giving the contract
the same address on every chain, the mainnet deployment saw a digest that was
byte-for-byte identical to the one the user signed for Base — so of course it
verified.

## Why each check passed on mainnet

Walk the mainnet execution as the contract saw it:

1. **Signature recovery.** The digest is
   `keccak256("\x19\x01" ‖ DOMAIN_SEPARATOR ‖ structHash)`.
   - `structHash` is `keccak256(abi.encode(ORDER_TYPEHASH, owner, token, amount, nonce, deadline))` —
     nothing in the order struct names a chain.
   - `DOMAIN_SEPARATOR` is built from `name`, `version`, and `address(this)`.
     `name` and `version` are constants in the source, and the source is
     identical on every chain. `address(this)` is identical too — that is the
     whole point of deploying with CREATE2 from the same factory and salt.
   - So both inputs to the digest are identical on Base and mainnet ⇒ the digest
     is identical ⇒ `ecrecover` returns the user's address on mainnet. It is not
     a "forged" signature; it is *the* signature, and it is genuinely valid for
     the mainnet contract under the domain the contract declared.

2. **Nonce.** `usedNonces` (or `nonces[owner]`) is contract storage, and storage
   does not cross chains. Burning nonce *N* on Base writes to Base state only;
   mainnet's mapping still has nonce *N* unused. A nonce prevents replay *within
   one deployment's storage*, nothing more.

3. **Deadline.** `block.timestamp` is wall-clock time on both chains. A deadline
   five minutes in the future on Base is five minutes in the future on mainnet.
   It bounds *when*, never *where*.

4. **Token address.** USDC exists at a real (different) address on each chain,
   and whatever address was signed, the user happened to hold a balance there —
   note that the signed `token` field being a mainnet or Base address doesn't
   save you in general: for a token deployed at the same address on both chains
   (many CREATE2-deployed tokens, bridged wrappers, canonical OFTs) the field is
   identical, and the relayer's own code never re-checks it.

The contract's only anti-replay dimension was "has this nonce been spent *here*".
Nobody ever encoded "here". EIP-712 has a field for exactly that and it was
dropped.

## The actual defect

The EIP-712 spec defines the domain type as:

```
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)
```

with all fields optional but `chainId` and `verifyingContract` being the two that
give *replay protection*:

- `verifyingContract` — stops replay across **contracts** on the same chain.
- `chainId` — stops replay across **chains**.

You kept the first and dropped the second. Ordinarily `verifyingContract` gives
you accidental cross-chain protection, because the same contract deployed
normally lands at different addresses on different chains (different deployer
nonces). Your CREATE2 identical-address deployment deliberately removes that
accident. So the one property that was doing the work by luck was engineered
away, and the property that was supposed to do the work on purpose was never
there. That combination is why this cost real money.

A second, latent bug is in the same lines: the separator is computed **once in
the constructor and frozen in an `immutable`**. Even after you add `chainId`,
freezing it means that if a chain hard-forks and the new fork assigns a new
chain ID, the deployment on the forked chain keeps validating signatures under
the *old* chain ID — which is the same replay bug again, just triggered by a
fork instead of by a second deployment. This is precisely why OpenZeppelin's
`EIP712` caches the separator but re-derives it whenever `block.chainid` differs
from the cached one.

## What to change

You can keep the identical address on every chain. Nothing in the fix requires
different addresses — CREATE2 with the same salt still works, because
`block.chainid` is read at *verification* time, not baked into the bytecode by
the deployment.

### 1. Put `chainId` in the domain, and don't hard-freeze the separator

```solidity
bytes32 private constant _DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 private immutable _cachedDomainSeparator;
uint256 private immutable _cachedChainId;
bytes32 private immutable _hashedName;
bytes32 private immutable _hashedVersion;

constructor() {
    _hashedName    = keccak256(bytes("GaslessOrderRelayer"));
    _hashedVersion = keccak256(bytes("1"));
    _cachedChainId = block.chainid;
    _cachedDomainSeparator = _buildDomainSeparator();
}

function _buildDomainSeparator() private view returns (bytes32) {
    return keccak256(abi.encode(
        _DOMAIN_TYPEHASH,
        _hashedName,
        _hashedVersion,
        block.chainid,      // ← the missing field
        address(this)
    ));
}

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    // Re-derive if the chain forked and changed its id.
    return block.chainid == _cachedChainId
        ? _cachedDomainSeparator
        : _buildDomainSeparator();
}
```

In practice: **inherit OpenZeppelin's `EIP712` and use `_hashTypedDataV4`
instead of writing this yourself.** It is exactly the code above, audited, and
it would never have shipped without `chainId`.

```solidity
contract GaslessOrderRelayer is EIP712 {
    constructor() EIP712("GaslessOrderRelayer", "1") {}

    function execute(Order calldata o, bytes calldata sig) external {
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            ORDER_TYPEHASH, o.owner, o.token, o.amount, o.nonce, o.deadline
        )));
        ...
    }
}
```

Effect: `structHash` is unchanged, but `DOMAIN_SEPARATOR` now differs between
Base (8453) and mainnet (1), so the digest differs, so the mainnet `ecrecover`
of a Base signature returns *some other address* — not the owner — and the
`recovered == owner` check fails. Cross-chain replay dies at signature recovery,
the earliest possible point.

### 2. Use `ECDSA.tryRecover` / `SignatureChecker`, not bare `ecrecover`

Raw `ecrecover` returns `address(0)` on malformed input and accepts malleable
`s`/`v` values (a second valid encoding of the same signature). If any of your
offchain systems dedupe or index orders by signature bytes, malleability lets
someone produce a "different" signature for the same order. Use
`ECDSA.recover`, which rejects high-`s` and `v ∉ {27,28}` and reverts rather
than returning zero. If you want to support smart-contract wallets (which this
user base will eventually have), use `SignatureChecker.isValidSignatureNow` so
EIP-1271 wallets work too.

### 3. Keep nonce + deadline — they cover the other two axes

With `chainId` added, the three replay axes are each covered by exactly one
mechanism, and it's worth being explicit about which:

| Replay axis | Guard |
|---|---|
| Same chain, same contract, twice | nonce (storage) |
| Same chain, *different* contract | `verifyingContract` in domain |
| *Different chain* | `chainId` in domain |
| Too late | `deadline` |

If the nonce is a `mapping(address => mapping(uint256 => bool))` bitmap-style
"used" set rather than a monotonic counter, keep it that way — it lets users
sign orders that execute out of order, which matters for a relayer. Just make
sure you mark it used **before** the token transfer (checks-effects-interactions),
so a callback-capable token can't re-enter `execute` with the nonce still unset.

### 4. Defense in depth: bind the chain into the struct too

Optional, but cheap, and it survives someone "optimizing" the domain later:

```solidity
struct Order { address owner; address token; uint256 amount; uint256 nonce; uint256 deadline; uint256 chainId; }
// in execute():
require(o.chainId == block.chainid, "wrong chain");
```

This also makes the chain visible in the wallet's EIP-712 signing prompt, so the
user sees which chain they are authorizing rather than trusting the dapp. Note
this is *additional* to the domain fix, not a substitute — the domain is the
canonical place and is what every other tool expects.

### 5. Operational follow-ups for this incident

- **Every already-signed, unexecuted order is still replayable** on every chain
  where the old contract is live. Fixing the contract does not retroactively
  protect signatures issued against the old domain. Deploy the fixed contract at
  a *new* address (change the CREATE2 salt), pause/disable `execute` on the old
  deployments on every chain, and have the frontend re-request signatures. Do
  not upgrade in place under the same address — old signatures would remain
  valid against it.
- **Audit the whole fleet for the same hole:** any other contract where you
  reused CREATE2 same-address deployment plus an EIP-712 domain, and any place
  you kept an `immutable` domain separator.
- **Make the relayer defensive as a second layer:** it should refuse to submit
  an order whose signed `chainId`/domain doesn't match the chain it's submitting
  to. This wouldn't have stopped the attacker here (they submitted directly),
  but it stops your own infrastructure from doing it by accident.
- **Add a regression test that is exactly this incident:** sign an order under
  chain A's domain, deploy the same contract at the same address on a forked
  chain B, submit, assert revert. Foundry: `vm.chainId()` plus two
  `vm.createSelectFork` environments, or simply construct the digest with a
  hardcoded foreign chain ID and assert `execute` reverts with
  `InvalidSignature`.

## The one-line version

`chainId` is not decoration in the EIP-712 domain — it *is* the cross-chain
replay guard, and it was the only guard that could have caught this, because
nonces live in per-chain storage, deadlines are per-time not per-place, and
CREATE2 deliberately made `verifyingContract` useless as a discriminator. Add
`chainId` to the domain, derive it from `block.chainid` at verification time
rather than freezing it at construction, and the identical-address property you
want costs you nothing.
