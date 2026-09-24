# Bug: "vitalik.eth" → Send stays greyed out

## Why the user is stuck

```ts
const isValid = /^0x[a-fA-F0-9]{40}$/.test(input.trim());
<button disabled={!isValid} ...>
```

1. The field only accepts one format: `0x` + 40 hex characters.
2. `vitalik.eth` is an **ENS name** (a human-readable name that points to an address). It is not hex, so the regex returns `false`.
3. Nothing ever tries to turn the name into an address. No ENS lookup exists anywhere.
4. `isValid` is `false` → the button is disabled forever, whatever the user does.
5. The failure is **silent**: no error text, no hint like "enter a 0x address or ENS name". The user sees a greyed button and has no idea why.

So the input is valid from the user's point of view; the app just treats "not hex" as "not an address" and says nothing. (Side issue: the regex also accepts mixed-case addresses with a wrong checksum, and it trims for validation but `send` probably uses the untrimmed `input`.)

## What a production recipient field should have done with the paste

1. **Normalize the paste.** Trim spaces/newlines, strip things like an `ethereum:` prefix. Store the cleaned value.
2. **Classify the input.**
   - Looks like `0x…` → validate with viem `isAddress` (checks length, hex *and* EIP-55 checksum), then `getAddress` to checksum it.
   - Contains a `.` (e.g. `vitalik.eth`, `name.base.eth`) → treat as a name to resolve.
   - Anything else → show an inline error.
3. **Normalize the name (ENSIP-15).** `normalize('Vitalik.eth')` from `viem/ens` lowercases it and rejects invalid/confusable characters. If this throws, show "invalid name" instead of looking it up.
4. **Debounce** (~300 ms) so each keystroke doesn't hit the RPC.
5. **Resolve on Ethereum mainnet, where ENS lives** — even if the app runs on an L2. Mechanism:
   - compute the `namehash` of the name (a fixed hash that identifies it),
   - ask the ENS registry / Universal Resolver which **resolver contract** is set for it,
   - call the resolver's `addr(node)` (or `addr(node, coinType)` for a specific chain, ENSIP-9/11) — this may go through an offchain CCIP-Read gateway (ENSIP-10) for names like `*.base.eth` or `cb.id`.
   - viem/wagmi do all of this in one call: `useEnsAddress({ name: normalize(x), chainId: 1 })`.
6. **Show the state inline, next to the field:**
   - loading: "Resolving vitalik.eth…" (button disabled with this reason),
   - success: show the resolved address (truncated, copyable, explorer link, avatar via `useEnsAvatar`) so the user can check it is really their friend,
   - no address set / name doesn't exist: "vitalik.eth has no address set" — a clear error, not a dead button.
7. **Send to the resolved address, not the string.** The tx `to` is the `0x…` result. Keep the name visible in the UI and in the confirm step ("Send 0.1 ETH to vitalik.eth (0xd8dA…6045)").
8. **Re-resolve right before sending** (or lock the resolved value the user confirmed) so a name that changed its record in between isn't silently used.
9. **Reverse direction too:** when a raw `0x` address is pasted, look up its primary name (`useEnsName`) and show it, so the user gets the same confirmation.
10. **Button state has a reason:** Send is enabled only when there is a valid resolved address; when disabled, the text says why ("Enter a recipient", "Resolving…", "Name not found").

## What to replace it with in this codebase

The project is wagmi v2 + viem with no UI kit, so I'd replace the raw `<input>` + regex with **one reusable `AddressInput` component** built on wagmi's ENS hooks (not a raw free-text field):

```tsx
import { useState } from "react";
import { isAddress, getAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useEnsAddress, useEnsName, useEnsAvatar } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useDebounce } from "./useDebounce";

export function AddressInput({ onChange }: { onChange: (a: Address | undefined) => void }) {
  const [raw, setRaw] = useState("");
  const value = useDebounce(raw.trim(), 300);

  const isHex = isAddress(value);
  let name: string | undefined;
  let nameError = false;
  if (!isHex && value.includes(".")) {
    try { name = normalize(value); } catch { nameError = true; }
  }

  const ens = useEnsAddress({ name, chainId: mainnet.id, query: { enabled: !!name } });
  const reverse = useEnsName({ address: isHex ? getAddress(value) : undefined, chainId: mainnet.id });
  const avatar = useEnsAvatar({ name: name ?? reverse.data ?? undefined, chainId: mainnet.id });

  const resolved: Address | undefined = isHex ? getAddress(value) : ens.data ?? undefined;
  // report resolved address up (in an effect) → parent enables Send only when defined
  ...
  // render: input, avatar, "Resolving…", resolved 0x (truncated + copy + explorer link),
  // or error: "Invalid name" / "No address set for this name" / "Not a valid address"
}
```

Usage:

```tsx
const [to, setTo] = useState<Address>();
<AddressInput onChange={setTo} />
<button disabled={!to || isSending} onClick={() => send(to!)}>Send</button>
```

Requirements for this to work:
- `mainnet` must be in the wagmi `config` `chains`/`transports` (with a real RPC URL), even if the app transacts on an L2 — ENS lookups go to chain 1.
- If the codebase is (or adopts) Scaffold-ETH 2, don't write this — use its built-in `<AddressInput />` from `~~/components/scaffold-eth`, which already does ENS resolution, avatar, and validation. Similarly RainbowKit/ConnectKit-based apps should use their kit's address component if one exists.
