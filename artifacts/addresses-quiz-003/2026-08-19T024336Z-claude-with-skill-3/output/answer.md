# Morpho Blue on Arbitrum — is the same 0xBBBB… address right?

**No. The teammate is wrong, and this one would have cost real money.**
`0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` holds **no code on Arbitrum One**.
Deposits routed there would be sent to an empty address — a plain ETH transfer
succeeds, and an ERC-20 `transfer` to an EOA-shaped address succeeds too, so
nothing reverts and the funds are simply gone.

## The address to wire into the Arbitrum config

```
Morpho Blue (Arbitrum One, chainId 42161): 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

Supporting addresses on the same chain, if the integration needs them:

| Contract | Arbitrum One |
| --- | --- |
| Morpho Blue | `0x6c247b1F6182318877311737BaC0844bAa518F5e` |
| AdaptiveCurveIRM | `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA` |
| ChainlinkOracleV2 Factory | `0x98Ce5D183DC0c176f54D37162F87e7eD7f2E41b5` |

Keep the Base config as it is — `0xBBBB…FFCb` **is** correct on Base (8453) and
on Ethereum mainnet. The mistake is generalising it, not the Base value.

## How this was established (checks run 2026-08-19, chainId asserted = 42161)

**1. The claimed address is empty on Arbitrum.** Checked against three
independent RPC providers so this is not one node lying:

```
$ cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb --rpc-url <arb1.arbitrum.io | publicnode | drpc>
0x        # all three
$ cast balance 0xBBBB...FFCb --rpc-url https://arb1.arbitrum.io/rpc   -> 0
$ cast nonce   0xBBBB...FFCb --rpc-url https://arb1.arbitrum.io/rpc   -> 0
```

No code, no balance, no nonce: nothing has ever been there.

**2. Control: the same call on Base returns a live Morpho.**

```
$ cast code 0xBBBB...FFCb --rpc-url https://mainnet.base.org      -> 0x6080604052...  (31 KB)
$ cast call 0xBBBB...FFCb "owner()(address)" --rpc-url <base>     -> 0xcBa28b38103307Ec8dA98377ffF9816C164f9AFa
```

So the RPC and the ABI are fine — the address genuinely is not on Arbitrum.

**3. Morpho's own deployment list gives the Arbitrum address.**
`docs.morpho.org` → Resources → Addresses lists Morpho on 42161 as
`0x6c247b1F6182318877311737BaC0844bAa518F5e` (and re-confirms `0xBBBB…FFCb` for
mainnet and Base). The protocol's own list is the source that settles which
deployment is current.

**4. Identity of `0x6c24…F5e` verified on-chain, not just read off a page.**

```
$ cast code 0x6c24...F5e --rpc-url <arb>                 -> 0x6080604052... (31 KB, same Morpho Blue prologue as Base)
$ cast call 0x6c24...F5e "owner()(address)"              -> 0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2
$ cast call 0x6c24...F5e "feeRecipient()(address)"       -> 0x0000...0000
$ cast call 0x6c24...F5e "DOMAIN_SEPARATOR()(bytes32)"   -> 0xb6174fc6...31e0d8
$ cast call 0x6c24...F5e "isIrmEnabled(address)(bool)" 0x66F30587...D06DA   -> true
$ cast call 0x6c24...F5e "isLltvEnabled(uint256)(bool)" 860000000000000000  -> true
$ cast call 0x66F30587...D06DA "MORPHO()(address)"       -> 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

The Morpho-Blue-specific surface answers, and the documented Arbitrum IRM points
back at exactly this Morpho instance while that Morpho has that IRM enabled —
the two addresses corroborate each other independently of the docs page.

**5. It is the deployment actually in use, not a stale or test one.**

```
$ cast call <USDC 0xaf88d065…5831> "balanceOf(address)" 0x6c24...F5e  -> 1,431,824 USDC
$ cast call <WETH 0x82aF4944…Bab1> "balanceOf(address)" 0x6c24...F5e  -> ~940.6 WETH
$ cast logs --address 0x6c24...F5e "Supply(bytes32,address,address,uint256,uint256)"  # last ~20k blocks -> present
```

Live collateral and supply activity within the last few hours.

## Why the "vanity CREATE2 ⇒ same address everywhere" reasoning fails

A vanity CREATE2 address is a property of *one deployment transaction*
(deployer + salt + init code), not a property of the protocol. It carries across
chains only if all three are identical, and here they are not: the Morpho `owner`
is a constructor argument, and it differs per chain —

* mainnet owner `0xcBa28b38…f9AFa`
* Base owner    `0xcBa28b38…f9AFa`  ← same init code, so the same `0xBBBB…` address
* Arbitrum owner `0xFd358f49…d9b2`  ← different init code hash ⇒ different CREATE2 address

which is consistent with mainnet and Base sharing the vanity address while
Arbitrum does not. Deployed bytecode also differs per chain regardless (Morpho
bakes a chain-id-derived `DOMAIN_SEPARATOR` in as an immutable), so codehash
equality is not a usable cross-chain test either. Uniswap v4 vs v3 is the same
lesson: address stability across chains is a deployment accident, never an
inference.

Note the inverse trap too: "no code at that address on Arbitrum" would **not**
have meant "Morpho isn't on Arbitrum". It is on Arbitrum, at an ordinary
address. Absence at one address only ever disproves that address.

## Before this ships

* Re-run `cast code` + `owner()`/`isIrmEnabled()` against `0x6c247b1F…F5e` on
  the Arbitrum RPC the deployment will actually use, immediately before real
  funds move. These checks were run on 2026-08-19; whoever deploys did not
  watch them run.
* Per-market addresses (loan token, collateral token, oracle, IRM) are **not**
  shared with Base either — pull each Arbitrum market's `marketParams` from the
  Arbitrum Morpho and verify the token addresses independently. In particular
  use Arbitrum-native USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`, not
  bridged USDC.e `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`, unless bridged is
  what you actually mean.
* Grep the codebase for any other hardcoded `0xBBBB…FFCb` or chain-agnostic
  address constant; if this assumption reached one config, it likely reached
  more. Address maps should be keyed by chain id, with no cross-chain fallback.
