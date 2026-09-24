# Bug: "vitalik.eth" → Send stays greyed out, no error

## Why the user is stuck

- `isValid` only accepts a raw hex address: `0x` plus exactly 40 hex characters.
- `vitalik.eth` is an **ENS name** (a human-readable name that points to an address). It is not hex, so the regex fails → `isValid = false` → button `disabled`.
- Nothing ever tries to turn the name into an address. The app doesn't look up ENS at all.
- The UI shows no message when the value is "invalid", so the user gets a dead button and no explanation. The field silently rejects a normal, valid kind of recipient.

So there are two failures: (1) ENS names aren't supported, and (2) invalid state is shown only as a disabled button, with no feedback.

## What a production recipient field should do with that paste

1. **Accept the raw text and classify it.**
   - Looks like `0x…` + 40 hex → treat as an address (check with viem `isAddress`, and turn it into checksum form with `getAddress`).
   - Contains a dot (e.g. `name.eth`, `name.xyz`, `sub.name.eth`) → treat as an ENS name.
   - Anything else → show an inline error ("Not a valid address or ENS name").
2. **Normalize the name** with viem's `normalize()` (ENSIP-15: lowercases, rejects invalid / look-alike characters). If it throws, show "Invalid ENS name" instead of silently failing.
3. **Resolve it on-chain** — ask the ENS registry on **Ethereum mainnet** (chainId 1) for the address the name points to (`useEnsAddress` / `getEnsAddress`). Always resolve against mainnet, even if the app sends on an L2, since that's where ENS lives (L2/offchain names work via CCIP-Read, which viem handles).
   - Debounce the input (~300 ms) so each keystroke doesn't fire a lookup.
4. **Show every state clearly, never just a grey button:**
   - Loading: spinner + "Resolving vitalik.eth…".
   - Not found (name has no address set): "vitalik.eth doesn't point to an address".
   - Network error: "Couldn't resolve name, try again".
   - Success: show the resolved address (shortened `0xd8dA…6045`, full value on hover/copy) and ideally the ENS avatar, so the user can confirm it's the right person.
5. **Keep two values separate:** what the user typed (the name, for display) and the resolved address (what's actually sent). The transaction uses **only** the resolved address.
6. **Enable Send only when a resolved address exists**, and re-check / show it on the confirm step. If the input changes, clear the old result immediately so a stale address can't be sent.
7. **Also work in reverse:** if the user pastes a hex address, look up its primary name (`useEnsName`) and show it next to the address — helps catch wrong-address pastes.
8. **Tell the user why Send is disabled** with a message under the field (and `aria-invalid` / `aria-describedby` for accessibility).

## What I'd replace the input with

A reusable `<AddressInput>` component built on the wagmi v2 hooks already in the project — not the regex + raw `<input>`:

```tsx
import { useState } from 'react'
import { isAddress, getAddress, type Address } from 'viem'
import { normalize } from 'viem/ens'
import { useEnsAddress, useEnsName, useEnsAvatar } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { useDebounce } from './useDebounce' // small setTimeout-based hook

export function AddressInput({ onChange }: { onChange: (a: Address | undefined) => void }) {
  const [input, setInput] = useState('')
  const value = useDebounce(input.trim(), 300)

  const isHex = isAddress(value)
  let ensName: string | undefined
  let nameError = false
  if (!isHex && value.includes('.')) {
    try { ensName = normalize(value) } catch { nameError = true }
  }

  const { data: resolved, isLoading, isError } = useEnsAddress({
    name: ensName, chainId: mainnet.id, query: { enabled: !!ensName },
  })
  const { data: reverseName } = useEnsName({
    address: isHex ? getAddress(value) : undefined, chainId: mainnet.id,
  })
  const { data: avatar } = useEnsAvatar({
    name: ensName ?? reverseName ?? undefined, chainId: mainnet.id,
  })

  const address: Address | undefined = isHex ? getAddress(value) : resolved ?? undefined
  // report upward; parent enables Send only when address !== undefined
  // (call in useEffect in real code)

  const message =
    !value ? null
    : nameError ? 'Invalid ENS name'
    : ensName && isLoading ? `Resolving ${ensName}…`
    : ensName && isError ? 'Could not resolve name, try again'
    : ensName && !resolved ? `${ensName} has no address set`
    : !isHex && !ensName ? 'Enter a 0x address or ENS name'
    : null

  // render: <input>, avatar, resolved/checksummed address or reverse name, and `message`
}
```

The parent form keeps `recipient: Address | undefined` and does
`<button disabled={!recipient}>`, sending to `recipient` — never to the raw text.

Note: if the project is (or becomes) Scaffold-ETH 2, don't write this — use its built-in `<AddressInput>` from `~~/components/scaffold-eth`, which already does ENS resolution, avatar, debounce and error states.
