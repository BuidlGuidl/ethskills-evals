# Bug: "pasted vitalik.eth, Send stays grey, no error"

## Why the user is stuck

1. The field only accepts one shape: `0x` + exactly 40 hex characters (`/^0x[a-fA-F0-9]{40}$/`).
2. `vitalik.eth` is an **ENS name** (like a domain name for an Ethereum address). It is not hex, so the regex fails → `isValid = false`.
3. `disabled={!isValid}` keeps Send greyed out forever. Nothing in the code ever tries to turn the name into an address — the app has no ENS lookup at all.
4. No error is shown, because `isValid` only drives `disabled`. There is no message, no "resolving…" state, no hint saying "names aren't supported" or "enter a 0x address". The user gets a dead button with zero feedback.

So it's two bugs: **missing ENS resolution** (the feature) and **silent failure** (the UX). Side issues in the same code: the regex is only a shape check (no EIP-55 checksum check, so a typo'd mixed-case address still passes), and `trim()` is used for validation but `send` presumably uses the untrimmed `input`.

## What a production recipient field should have done with that paste

1. **Normalize the paste.** Trim whitespace/newlines, strip invisible characters, handle a pasted `ethereum:0x…` URI. (For names, normalize with ENSIP-15 — viem's `normalize()` from `viem/ens` — so look-alike/uppercase input maps to the canonical name.)
2. **Classify the input.**
   - Looks like hex → validate with viem `isAddress()` (includes checksum check) → use `getAddress()` for the checksummed form.
   - Contains a dot / looks like a name (`*.eth`, or any DNS-style ENS name) → treat it as an ENS name to resolve.
   - Otherwise → show an inline "Not a valid address or ENS name" error.
3. **Resolve the name onchain.** Debounce typing (~300–500 ms), then call the ENS resolver on **Ethereum mainnet** (ENS lives on L1 even if the app transacts on an L2) — in wagmi: `useEnsAddress({ name: normalize(value), chainId: mainnet.id })`. This asks the ENS registry which resolver the name uses, then asks that resolver for the address record (incl. offchain/CCIP-Read names and, where relevant, the address for the current chain via ENSIP-11).
4. **Show every state inline, next to the field:**
   - resolving → spinner, "Resolving vitalik.eth…", Send disabled with that label;
   - not found / no address record → "vitalik.eth has no address set" (error, Send disabled);
   - RPC failure → "Couldn't resolve name, retry" (not a silent grey button).
5. **Show the result for confirmation.** Display the resolved address (truncated, copyable, explorer link, avatar/blockie via `useEnsAvatar`) under the name, so the user can check it's the right friend before sending.
6. **Send to the resolved hex, not the text.** Keep two values: what the user typed (`vitalik.eth`) and the resolved `0x…` address. The transaction uses the resolved address; the confirmation screen shows both ("Send 0.1 ETH to vitalik.eth (0xd8dA…6045)").
7. **Stay in sync.** If the user edits the field, clear the old resolved address immediately so Send can't fire at a stale address while a new lookup runs.
8. **Only enable Send** when there's a valid, resolved, checksummed address (plus the usual amount/network checks).

## What I'd replace it with in this codebase

The workspace has wagmi v2 + viem but no UI kit, so:

- **If Scaffold-ETH 2 / its components are available:** use `<AddressInput>` from `~~/components/scaffold-eth` — it already does paste normalization, ENS resolution, loading/error states and avatar display. Don't hand-roll this.
- **Otherwise:** replace the raw `<input>` with a small `RecipientInput` component built on wagmi's `useEnsAddress` + `useEnsAvatar` and viem's `isAddress` / `getAddress` / `normalize`, returning the resolved address to the form:

```tsx
import { useState } from "react";
import { useEnsAddress, useEnsAvatar } from "wagmi";
import { mainnet } from "wagmi/chains";
import { isAddress, getAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useDebounce } from "./useDebounce";

export function RecipientInput({ onResolved }: { onResolved: (a: Address | undefined) => void }) {
  const [input, setInput] = useState("");
  const value = useDebounce(input.trim(), 400);

  const isHex = isAddress(value);
  let ensName: string | undefined;
  try { ensName = !isHex && value.includes(".") ? normalize(value) : undefined; } catch {}

  const { data: ensAddress, isLoading, isError } = useEnsAddress({
    name: ensName,
    chainId: mainnet.id,
    query: { enabled: !!ensName },
  });
  const { data: avatar } = useEnsAvatar({ name: ensName, chainId: mainnet.id, query: { enabled: !!ensAddress } });

  const resolved = isHex ? getAddress(value) : ensAddress ?? undefined;
  // report upward (useEffect in real code); clear on every edit so nothing stale is sent
  ...
  // render: input + inline status:
  //   isLoading -> "Resolving vitalik.eth…"
  //   ensName && !isLoading && !ensAddress -> "No address found for this name"
  //   isError -> "Couldn't resolve name, try again"
  //   value && !isHex && !ensName -> "Enter a 0x address or ENS name"
  //   resolved -> avatar + truncated address + copy + explorer link
}
```

The form then keeps `recipient: Address | undefined` from `onResolved`, uses it in `send`, and sets `disabled={!recipient || isResolving}` with a button label that says why ("Resolving…", "Enter recipient") instead of a silent grey.
