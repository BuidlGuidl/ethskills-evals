# Bug: `vitalik.eth` paste → Send stays greyed out, no feedback

## Why the user is stuck

1. The only check is a regex: `/^0x[a-fA-F0-9]{40}$/`. It accepts **only** a raw 20-byte hex address.
2. `vitalik.eth` is an **ENS name**, a human-readable name that maps to an address through the ENS contracts onchain. It is not hex, so the regex fails → `isValid = false` → `disabled={true}`.
3. Nothing ever tries to turn the name into an address. The code has no ENS lookup, even though wagmi/viem can do it with one hook.
4. The field has no states besides "valid" and "invalid", and "invalid" is only shown as a disabled button. There's no message, no spinner, no hint like "not a valid address or ENS name". From the user's side, the form looks broken.
5. So the user **can't** get unstuck from the UI. The input they gave is legitimate, the app just doesn't understand it, and it doesn't say so.

Smaller issues in the same code:
- The regex check doesn't use the EIP-55 checksum (mixed-case hex that encodes a checksum), so a mistyped mixed-case address can pass as "valid".
- The value is `trim()`-ed for validation but the raw value is kept in state. Anything that later reads `input` gets the untrimmed string.

## What a production recipient field should do with that paste

1. **Normalize the paste.** Trim whitespace/newlines. Strip wrappers like `ethereum:` prefixes or `@chainId` suffixes if you support them. Lower-case / ENS-normalize the name (UTS-46 via viem's `normalize`), so `Vitalik.ETH` and `vitalik.eth` resolve the same way.
2. **Classify the input.**
   - Looks like hex (`0x` + 40 hex chars) → validate with `isAddress` (checksum-aware), then `getAddress` to checksum it. Optionally do a reverse lookup to show its ENS name.
   - Contains a `.` (e.g. `*.eth` or another ENS-supported TLD) → treat as a name and go to step 3.
   - Anything else → show an inline error right away: "Enter a valid address or ENS name".
3. **Resolve the name.** Debounce typing (~300–500 ms; a paste can resolve right away). Call the ENS resolver **on mainnet** (ENS lives on L1 even if the app is on an L2) via `useEnsAddress({ name: normalize(input), chainId: mainnet.id })`. While it runs, show a "Resolving…" state in the field. The button stays disabled, but now the user can see why.
4. **Handle every result.**
   - Resolved → show the resolved, **truncated checksummed address** (plus the ENS avatar if there is one) under or inside the field, e.g. `vitalik.eth → 0xd8dA…6045`, so the user can confirm who they're paying.
   - No address set / name doesn't exist → inline error: "vitalik.eth doesn't resolve to an address".
   - RPC failure → inline error with a retry, not a silent disabled button.
5. **Keep display and payload separate.** State holds `{ raw: "vitalik.eth", resolved: "0x…" | undefined, status }`. `isValid` is `status === "resolved"`, and **`send` uses the resolved hex address**, never the raw text. Only enable the button once there's a resolved address.
6. **Re-check at send time.** If the input changed after resolving (or the resolution is stale), block or re-resolve so the tx never goes to an address for a different/old input. Show the name *and* the address in the confirmation step.
7. **Always give feedback.** Every disabled state has a visible reason next to the field: empty, invalid, resolving, not found, error.

## What I'd replace it with in this codebase

Use a dedicated address-input component instead of a raw `<input>` + regex. Rule of thumb: never use a raw free-text field for entering a critical address.

- If the app uses **Scaffold-ETH 2** (or can add it), use its **`<AddressInput>`** component. It already does ENS resolution (name→address and address→name), debouncing, avatar/blockie, and validation. Wire it as `<AddressInput value={recipient} onChange={setRecipient} />` and send to the resolved address.
- Otherwise, build a small `RecipientInput` component on the wagmi/viem already configured here:

```tsx
import { useState } from "react";
import { useEnsAddress, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { isAddress, getAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useDebounce } from "./useDebounce";

export function RecipientInput({ onResolved }: { onResolved: (a?: Address) => void }) {
  const [raw, setRaw] = useState("");
  const input = useDebounce(raw.trim(), 400);

  const isHex = isAddress(input);            // checksum-aware
  const isName = !isHex && input.includes(".");
  let name: string | undefined;
  try { name = isName ? normalize(input) : undefined; } catch { /* invalid name */ }

  const ens = useEnsAddress({ name, chainId: mainnet.id, query: { enabled: !!name } });
  const reverse = useEnsName({ address: isHex ? getAddress(input) : undefined, chainId: mainnet.id });

  const resolved: Address | undefined = isHex ? getAddress(input) : ens.data ?? undefined;
  // report to parent; parent does `disabled={!resolved || isSending}` and sends to `resolved`
  ...
  // render: input + status line:
  //   ens.isLoading → "Resolving…"
  //   resolved      → "vitalik.eth → 0xd8dA…6045" (+ avatar), or reverse.data for hex input
  //   name && ens.isSuccess && !ens.data → "Name has no address set"
  //   ens.isError   → "Couldn't resolve, retry"
  //   input && !isHex && !isName → "Enter a valid address or ENS name"
}
```

Then the Send button is `disabled={!resolvedRecipient || isSending}`, it shows its own pending state ("Sending…") until confirmation, and `send` passes `to: resolvedRecipient`.
