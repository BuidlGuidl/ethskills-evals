# Bug: "vitalik.eth" → Send button stays grey, no error

## Why the user is stuck

- `isValid` is a regex that only accepts `0x` + 40 hex chars.
- `vitalik.eth` is an **ENS name** (human-readable name that maps to an address), not hex. Regex fails → `isValid = false` → button `disabled`.
- The field never tries to turn the name into an address. Nothing in the code calls ENS at all.
- No error text, no loading state, no hint → user sees a dead button and can't tell why. The form silently treats a normal, valid recipient as garbage.
- Side issues in the same code: it checks `input.trim()` but would send `input` (untrimmed); regex accepts any casing, so it never checks the EIP-55 checksum (mixed-case typo protection).

## What a production recipient field should do with that paste

1. **Take the raw text, trim it.** Keep what the user typed on screen; keep the resolved result separately in state.
2. **Classify the input.**
   - Looks like hex (`isAddress` from viem) → address path (step 7).
   - Contains a `.` (e.g. `vitalik.eth`, `name.base.eth`, DNS names like `foo.xyz`) → name path.
   - Anything else → show "Enter an address or ENS name".
3. **Normalize the name** with viem `normalize()` (ENSIP-15 rules: lowercase, Unicode cleanup, rejects bad/confusable characters). `Vitalik.ETH` becomes `vitalik.eth`. If `normalize` throws → show "Invalid name", don't query.
4. **Debounce** (~300 ms) so each keystroke doesn't fire a lookup. Paste is one event, so it resolves right away.
5. **Resolve on Ethereum mainnet (chainId 1)**, not the chain the wallet is on. ENS registry lives on L1; viem uses the Universal Resolver there, which also handles offchain/L2 names (CCIP-Read, e.g. `*.base.eth`, `cb.id`). If the transfer is on an L2, ask for that chain's address via `coinType` (ENSIP-11/19), with fallback to the default ETH address.
6. **Show status while it runs:** spinner "Resolving vitalik.eth…", Send disabled *with a reason*.
7. **Show the result, or a clear error:**
   - Found → show avatar (`useEnsAvatar`) + name + shortened hex (`0xd8dA…6045`) under the field so the user can confirm it's the right person.
   - Not found / no address record → "vitalik.eth has no address set" (not a grey button with no reason).
   - RPC failure → "Couldn't resolve name, retry".
   - For pasted hex → also reverse-lookup (`useEnsName`) and show the name if one exists; checksum with `getAddress` and reject bad mixed-case checksums.
8. **Enable Send only when a resolved, checksummed `0x…` address exists**, and send to **that address**, never the name string. Lock the value when the confirm step opens (so the name can't re-resolve to something else mid-flow), and show "Sending to vitalik.eth (0xd8dA…6045)" in the confirmation.

## What I'd replace the input with

This project has wagmi v2 + viem, so a small `RecipientInput` component built on them — no new library:

```tsx
import { useState } from "react";
import { isAddress, getAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useEnsAddress, useEnsName, useEnsAvatar } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useDebounce } from "./useDebounce"; // or usehooks-ts

export function RecipientInput({ onResolved }: { onResolved: (a: Address | undefined) => void }) {
  const [input, setInput] = useState("");
  const value = useDebounce(input.trim(), 300);

  const isHex = isAddress(value); // strict: checks checksum if mixed-case
  let name: string | undefined;
  let nameError = false;
  if (!isHex && value.includes(".")) {
    try { name = normalize(value); } catch { nameError = true; }
  }

  const ens = useEnsAddress({ name, chainId: mainnet.id, query: { enabled: !!name } });
  const reverse = useEnsName({ address: isHex ? getAddress(value) : undefined, chainId: mainnet.id });
  const avatar = useEnsAvatar({ name: name ?? reverse.data ?? undefined, chainId: mainnet.id });

  const resolved: Address | undefined = isHex ? getAddress(value) : ens.data ?? undefined;
  // report to parent via effect: onResolved(resolved)
  // render: input, avatar, status line:
  //   ens.isLoading       → "Resolving…"
  //   nameError           → "Invalid name"
  //   name && !ens.data   → `${name} has no address set`
  //   ens.isError         → "Couldn't resolve, retry"
  //   resolved            → `${name ?? reverse.data ?? ""} ${short(resolved)}`
  //   other non-empty     → "Enter an address or ENS name"
}
```

Parent form: `<button disabled={!resolved} onClick={() => send(resolved)}>` — the regex is deleted entirely.

Requirements: wagmi config must include a `mainnet` transport (reliable RPC, not the public default) even if the app transacts on an L2, since ENS lookups go to L1.

If the app is (or becomes) Scaffold-ETH 2, don't hand-roll this: use its built-in `<AddressInput>`, which already does ENS resolve, reverse lookup, avatar and loading/error states.
