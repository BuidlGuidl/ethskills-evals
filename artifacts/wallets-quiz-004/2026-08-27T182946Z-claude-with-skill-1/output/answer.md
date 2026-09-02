# Why your Safe address diverges across chains — and what to do about it

**Short answer: a different address per chain is _not_ expected, and it is not a
limitation of Safe or of CREATE2. It is a configuration bug in your deploy path.
Do not give up on one address. But don't store it as a single global constant
either — store the deployment *recipe* as the source of truth and a per-chain
row for the resulting address, with an assertion that the rows are equal.**

Your teammate's *schema* is right for a reason they haven't identified. Their
*conclusion* — accept divergence — is wrong.

---

## 1. What actually determines the address

Safe deploys through `SafeProxyFactory.createProxyWithNonce(singleton, initializer, saltNonce)`,
which uses CREATE2. CREATE2 has no chain ID in it. The address is purely:

```
initCodeHash = keccak256( proxyCreationCode ++ abi.encode(singleton) )
salt         = keccak256( keccak256(initializer) ++ abi.encode(saltNonce) )
address      = keccak256( 0xff ++ factoryAddress ++ salt ++ initCodeHash )[12:32]
```

where `initializer` is the ABI-encoded call to

```
Safe.setup(owners[], threshold, to, data, fallbackHandler,
           paymentToken, payment, paymentReceiver)
```

So the address is a pure function of **five** things:

| Input | Where it enters | Chain-dependent by accident? |
|---|---|---|
| `factoryAddress` | CREATE2 preimage | **yes, often** |
| `proxyCreationCode` | initcode | **yes** (differs by Safe version) |
| `singleton` (mastercopy) | constructor arg appended to initcode | **yes — the usual culprit** |
| `initializer` bytes (owners, threshold, **fallbackHandler**, to/data) | salt | **yes** (handler address, owner order) |
| `saltNonce` | salt | **yes** (SDK default is chain-derived) |

Note what is *not* in that list: chain ID, block number, your deployer EOA's
nonce, gas price. Nothing about the chain leaks in on its own. Every divergence
you see is one of those five inputs silently changing when you point the script
at a different RPC.

"Same owners, same threshold, same salt" only pins two and a half of the five.
The three you haven't pinned are the ones moving.

---

## 2. The likely causes, ranked

### (a) `Safe.sol` (L1 singleton) vs `SafeL2.sol` — almost certainly your bug

Safe ships two singletons per version. `SafeL2` is byte-for-byte `Safe` plus
extra events (`SafeMultiSigTransaction`, `SafeModuleTransaction`) emitted so
indexers can reconstruct history on chains without cheap trace access. **They
are different contracts at different addresses.**

The Safe SDK (`protocol-kit`) picks between them *by chain*: L1 singleton on
Ethereum mainnet, L2 singleton on essentially everything else — Base, Arbitrum,
Polygon, Optimism, Gnosis. It's the `isL1SafeSingleton` flag, and if you never
set it you get the chain-conditional default.

The singleton address is ABI-encoded and appended to the proxy creation code as
a constructor argument, so it lands inside `initCodeHash`. Different singleton →
different initcode → different CREATE2 address.

This matches your symptom precisely: **mainnet gets one address, the L2s get
another.** If Base and Arbitrum agree with each other and only mainnet is the
odd one out, stop reading — this is it, on its own.

### (b) The SDK's *default* salt nonce is chain-specific

If your script doesn't pass `saltNonce` explicitly and leans on the SDK default,
be aware that protocol-kit has both a fixed `PREDETERMINED_SALT_NONCE` and a
chain-specific derivation (`keccak256(PREDETERMINED_SALT_NONCE ++ chainId)`),
used in some paths specifically to *prevent* cross-chain address collisions.

"Same salt every time" needs to mean *the same literal bytes appear in the
transaction on every chain*, not "the same line of code runs every time." Log
the actual `saltNonce` argument per chain and compare hex. If you are not
passing one, you are almost certainly hashing the chain ID into it.

### (c) Different Safe version resolved per chain

v1.3.0 and v1.4.1 have a different factory, a different proxy creation code, a
different singleton, and a different fallback handler — all four inputs move at
once. If your tooling resolves "the latest version deployed on this chain,"
newer L2s land on 1.4.1 while an older deployment path lands on 1.3.0.

Worse, v1.3.0 has **two** canonical deployments: the original (deployed via a
pre-EIP-155 Nick's-method transaction) and the `eip155` variant, deployed on
chains that reject unprotected transactions. Those two have *different factory
and singleton addresses*. Some chains only ever got the `eip155` set. If one of
your three chains resolves to the eip155 deployment, everything shifts.

### (d) Fallback handler address inside the initializer

`CompatibilityFallbackHandler` is passed as an argument to `setup()`, so it's
hashed into the salt. It's version-specific and deployment-specific. If (c) is
happening, (d) is happening too, and either alone is enough.

### (e) Owner array ordering

`setup()` writes owners into a linked list **in the order given**. `[A, B, C]`
and `[B, A, C]` are the same 2-of-3 Safe semantically and two completely
different addresses. If your owners come out of a `Set`, an object's key order,
a DB query without `ORDER BY`, or a per-environment config file, ordering can
drift between runs. Sort them canonically (lowercase hex ascending) and pin it.

Checksum casing does *not* matter — ABI encoding sees 20 raw bytes.

### (f) Non-deterministic factory path

`createProxy` (the deprecated, plain-`CREATE` entrypoint on old factories)
derives the address from the *factory's own nonce*, which differs per chain.
Confirm you're on `createProxyWithNonce`. Similarly, if any part of your stack
deploys the factory itself rather than using the canonical one, its address is
your deployer EOA's nonce and will differ everywhere.

### (g) Chains where it is genuinely impossible

ZKsync Era and its stack (Abstract, Lens, Sophon) compute CREATE2 from a
**hash of the compiled bytecode**, not from the initcode, via a different system
contract. Addresses there can never match an EVM chain, no matter what you pin.
Same for any chain with no canonical Safe deployment. These are real exceptions
and are exactly why you keep a per-chain record — but Base and Arbitrum are
ordinary EVM chains and are not among them.

---

## 3. How to find which one it is, in one pass

Don't reason about it — print the five inputs per chain and diff them. The first
field that differs is your answer.

```js
// per chain, before deploying anything
const initializer = safeInterface.encodeFunctionData('setup', [
  owners, threshold, to, data, fallbackHandler,
  paymentToken, payment, paymentReceiver,
]);

console.table({
  chainId,
  factory,                                        // (a)/(c)/(f)
  singleton,                                      // (a)  <-- look here first
  fallbackHandler,                                // (d)
  owners: owners.join(','),                       // (e)  order matters
  threshold,
  saltNonce: hexlify(saltNonce),                  // (b)
  initializerHash: keccak256(initializer),
  proxyCreationCodeHash:
    keccak256(await factoryContract.proxyCreationCode()),  // live, on-chain
});
```

`proxyCreationCode()` is a view function on the factory — read it from each
chain rather than trusting a local artifact. That one call catches (c) and (f)
together.

---

## 4. What to do

### Pin all five inputs explicitly. Never let a default resolve per chain.

1. **Pin the version.** One version across all target chains — 1.4.1 unless you
   have a chain that only has 1.3.0.
2. **Pin the singleton explicitly, same variant everywhere.** Consistency
   matters more than which one you choose. I'd use **`SafeL2` on every chain,
   including mainnet** — it's a strict superset of `Safe`, the extra events cost
   trivial gas, and it's the variant every L2 indexer and the Safe Transaction
   Service expect. Forcing the L1 singleton onto L2s works but historically
   drew "unsupported mastercopy" warnings in Safe{Wallet} and gives indexers
   less to work with.
3. **Pin the factory and the fallback handler** as explicit constants.
4. **Pin `saltNonce`** to a value you choose and store per user. Never derive it
   from chain ID, block, timestamp, or a counter.
5. **Canonicalise owner ordering** and cover it with a test.

Source the addresses programmatically from `@safe-global/safe-deployments`
keyed by version, rather than hardcoding them — including from this document.
Then assert the resolved set is identical across chains.

### Make divergence a build failure, not a surprise

```js
// compute for every target chain, then:
assert(new Set(addresses).size === 1,
  `Safe address diverged: ${JSON.stringify(byChain, null, 2)}`);
```

You want the script to refuse to deploy when the address it computed for Base
doesn't match the one it computed for mainnet. Right now it deploys happily.

### Verify the factory and singleton actually exist on each chain *before* funding

Check `code.length > 0` at the pinned factory and singleton on every target
chain. Sending funds to a counterfactual address on a chain where the factory
was never deployed puts them at an address you cannot deploy to and cannot
sign from. This is unrecoverable.

### Storage: recipe as source of truth, per-chain rows as cache

```
safe_config:   user_id, version, factory, singleton, fallback_handler,
               owners[] (ordered), threshold, salt_nonce, initializer_hash
safe_instance: user_id, chain_id, address, deployed_at_block, status
```

On every well-behaved EVM chain the `address` column will hold the same value,
and you assert that. For a ZKsync-class chain it legitimately won't, and the
schema absorbs it without a rewrite. Your teammate gets their per-chain row;
you keep the single address and, more importantly, you keep the invariant that
proves it's single.

---

## 5. Two things to know once the address does match

**Same address does not mean same Safe.** After deployment the chains are
independent contracts. Rotate an owner on mainnet and Base still has the old
owner set — a key you revoked is still a valid signer at the identical address
on another chain. Owner and threshold changes must be replayed on every chain,
and the replay must be tracked as its own state, not assumed from the address
matching. This is the failure mode that actually loses money, and it is *worse*
with a shared address, because the address looks identical while the authority
behind it has silently diverged. Read owners and threshold from each chain
before you trust either.

**Deployment is permissionless.** Anyone can call the factory with your public
initializer and deploy your Safe at your address on any chain. That's not a
theft risk — the config is committed to in the address, so what they deploy has
*your* owners and *your* threshold — but they choose the timing, so treat
"deployed" as something you read from chain state, not something you infer from
having sent the transaction. Verify owners and threshold on-chain before the
first transfer in.

And keep the deploy script's own signer bounded: it needs gas, not custody. It
should never hold or be able to move the funds destined for the Safe, and the
key it signs with must not be baked into the repo, an `.env` that gets
committed, or a CI variable that's readable by every job.

---

## Verdict

Not expected, and not a reason to change your data model's meaning. It's a
config bug — most likely the L1-vs-L2 singleton switch on mainnet, possibly
compounded by a chain-derived default salt nonce or a version mismatch. Pin all
five CREATE2 inputs, assert equality across chains in the deploy script, and
you keep one address everywhere. Store per-chain rows anyway — not because the
address should differ, but so that the code can *prove* it doesn't, and so the
handful of chains where it genuinely can't don't force a migration later.
