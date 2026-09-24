# Bug: "vitalik.eth → Send stays greyed out, no error"

## Why the user is stuck

- `isValid` accepts only a raw 40-hex-char string: `/^0x[a-fA-F0-9]{40}$/`.
- `vitalik.eth` is an ENS name (Ethereum Name Service, a lookup from names to addresses), not hex. So the regex returns `false`.
- The component never tries to look the name up. Nothing calls ENS, so the name never becomes an address.
- `disabled={!isValid}` is the only thing that reacts. The button goes grey and there's no message saying why. The UI never tells the user "names aren't supported" or "that's not an address".
- So the user is stuck. The input is a real, valid recipient, the form treats it as garbage, and it gives no feedback about that. It also can't even say "invalid address", because there's no error state.

Smaller issues in the same code:
- The regex ignores the EIP-55 checksum (the mixed upper/lower case in an address that catches typos). An address with a typo in its casing passes.
- `input.trim()` is validated, but `send` probably uses the untrimmed `input`.

## What a production recipient field does with that paste

1. **Classify the input.** On each change, trim it and check which kind it is:
   - hex: it looks like `0x…`, so validate it with `isAddress` (checksum-aware) and you're done.
   - name: it contains a `.`, so treat it as an ENS name.
   - anything else: show an inline error like "Enter an address (0x…) or ENS name".
2. **Normalize the name.** Run `normalize()` from `viem/ens` (ENSIP-15 / UTS-46: lowercases it and rejects look-alike or invalid characters). If it throws, show "Invalid ENS name" instead of failing silently.
3. **Debounce** by about 300 ms so every keystroke doesn't fire a lookup.
4. **Resolve onchain, on mainnet.** ENS lives on Ethereum mainnet (chainId 1), even when the app sends on an L2. viem's `getEnsAddress` does the lookup:
   - hash the name into a `namehash`
   - call ENS's Universal Resolver, which finds the name's resolver contract and calls `addr(node)`
   - follow CCIP-Read (EIP-3668, the standard for fetching offchain data) when the resolver points to data stored offchain, e.g. `*.cb.id` or L2-backed names

   The wagmi config needs a mainnet transport for this, even if mainnet isn't a chain you send on. For a non-mainnet target chain, pass that chain's `coinType` (ENSIP-11) so the lookup returns the address set for that chain, not the mainnet one.
5. **Show each state inline, next to the field:**
   - resolving: a spinner and "Resolving vitalik.eth…", with the button disabled and labelled "Resolving…"
   - resolved: show the resolved `0x…` address (shortened, with copy/full view) and optionally the ENS avatar, so the user can confirm it's the right person *before* sending
   - no address set (`null`): "vitalik.eth has no address set"
   - RPC error: "Couldn't resolve name, try again"
6. **Enable Send only when there's a resolved address.** Whenever the button is disabled, show the reason: empty, invalid, resolving, or not found.
7. **Send to the resolved hex address, never the name string.** Keep the address the user saw. If the input changes, clear it and resolve again. On the confirmation screen show both: "Send to vitalik.eth (0xd8dA…6045)".
8. **Reverse lookup for hex (nice to have).** When the user pastes a raw address, show its primary name (`useEnsName`) as a sanity check.

## What I'd replace the input with

There's no UI kit here that comes with an address component. This is plain wagmi v2 + viem, not Scaffold-ETH, RainbowKit or similar. So I'd write one small reusable `<AddressInput>` component instead of wiring the regex into every form. It would be built on:

- `isAddress` (viem) for hex input
- `normalize` (`viem/ens`) plus wagmi's `useEnsAddress({ name, chainId: mainnet.id, query: { enabled: isName } })` for names
- optionally `useEnsName` / `useEnsAvatar` for showing names and avatars

The component gives the form a single value, `resolvedAddress: Address | undefined`, plus a status (`idle | invalid | resolving | resolved | notFound | error`). The form uses them like this:

```tsx
<AddressInput value={input} onChange={setInput} onResolved={setRecipient} />
<button disabled={!recipient} onClick={() => send(recipient!)}>Send</button>
```

The form checks `recipient`, not `input`. If the project already used Scaffold-ETH 2, I'd use its `<AddressInput>` from `~~/components/scaffold-eth`, which already does all of the above.
