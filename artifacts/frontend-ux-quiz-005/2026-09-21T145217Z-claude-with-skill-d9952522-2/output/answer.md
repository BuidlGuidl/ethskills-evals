# Bug: "vitalik.eth" leaves Send greyed out, no error

## Why the user is stuck

```ts
const isValid = /^0x[a-fA-F0-9]{40}$/.test(input.trim());
<button disabled={!isValid}>Send</button>
```

1. The field only accepts a raw hex address (`0x` + 40 hex chars). `vitalik.eth` is an
   ENS name (a readable name that points to an address). It fails the regex, so `isValid` is `false`.
2. Nothing ever tries to turn the name into an address. No lookup, no fallback.
3. `disabled={!isValid}` is the only feedback. No message says why, so the UI looks broken.
   The user did nothing wrong: sending to ENS names is normal and wallets support it.
4. Smaller issues in the same code: the regex skips checksum checking (use viem `isAddress`),
   and `input.trim()` is checked, but the untrimmed `input` is what `send` would use.

So the field fails **silently** on a common, valid input.

## What a production recipient field should do with that paste

1. **Classify the input.** Trim it. If it's a hex address, check it with viem `isAddress`
   (this also checks mixed-case checksums). If it contains a `.`, treat it as a name. Anything
   else is invalid, and the field says why ("Enter a 0x address or ENS name").
2. **Normalize the name.** Run it through viem `normalize()` (ENSIP-15 rules for case, unicode
   and lookalike characters). If that throws, show "Invalid ENS name" rather than failing silently.
3. **Resolve it onchain.** Query the ENS registry/resolver on **Ethereum mainnet** (chainId 1),
   even if the app transacts on an L2. With wagmi: `useEnsAddress({ name, chainId: 1 })`. Debounce
   typing so every keystroke doesn't fire an RPC call.
4. **Show every state next to the field:**
   - loading → "Resolving vitalik.eth…" (button disabled, with that reason shown)
   - no result → "vitalik.eth doesn't resolve to an address" (button disabled, with that reason)
   - RPC error → "Couldn't look up name, try again"
   - success → display the resolved address (shortened, with a copy action and ideally avatar/blockie)
     under the input, so the user can check it before sending.
5. **Enable Send only once there is a resolved, valid address**, and send **that address**
   (the one the user saw), never the name string. Keep the original name only for display.
6. **Reverse direction too:** if the user pastes a hex address, optionally show its primary ENS
   name (`useEnsName`) as a sanity check.
7. **Every disabled state has a visible reason.** A dead button with no text is never acceptable.

## What I'd replace it with in this codebase

The workspace has no UI kit with an address component (no Scaffold-ETH `AddressInput`,
RainbowKit/ConnectKit don't provide one). So: replace the raw `<input>` + regex with one
`RecipientInput` component built on the wagmi v2 / viem already configured:

```tsx
import { useEffect, useState } from "react";
import { isAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useEnsAddress } from "wagmi";

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function RecipientInput({ onResolved }: { onResolved: (a: Address | undefined) => void }) {
  const [input, setInput] = useState("");
  const raw = useDebounced(input.trim());

  const isHex = isAddress(raw);
  const looksLikeName = !isHex && raw.includes(".");
  let name: string | undefined;
  let nameError: string | undefined;
  if (looksLikeName) {
    try { name = normalize(raw); } catch { nameError = "Invalid ENS name"; }
  }

  const { data: ensAddress, isLoading, isError } = useEnsAddress({
    name,
    chainId: 1, // ENS lives on mainnet
    query: { enabled: !!name },
  });

  const resolved: Address | undefined = isHex ? (raw as Address) : ensAddress ?? undefined;
  useEffect(() => onResolved(resolved), [resolved, onResolved]);

  let status: string | undefined;
  if (!raw) status = undefined;
  else if (isHex) status = undefined;
  else if (nameError) status = nameError;
  else if (!looksLikeName) status = "Enter a 0x address or ENS name (e.g. vitalik.eth)";
  else if (isLoading) status = `Resolving ${raw}…`;
  else if (isError) status = "Couldn't look up name, try again";
  else if (!ensAddress) status = `${raw} doesn't resolve to an address`;

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)}
             placeholder="0x… or name.eth" />
      {status && <p role="alert">{status}</p>}
      {looksLikeName && ensAddress && <p>Sending to {ensAddress}</p>}
    </div>
  );
}
```

Parent:

```tsx
const [recipient, setRecipient] = useState<Address>();
<RecipientInput onResolved={setRecipient} />
<button disabled={!recipient} onClick={() => send(recipient!)}>Send</button>
```

Notes:
- Requires a mainnet transport in the wagmi config (chain `mainnet` + a dedicated RPC URL), even
  if the app targets another chain. Without it, `useEnsAddress` can't resolve.
- If the project later adopts Scaffold-ETH 2, use its `<AddressInput>` instead. It does all of
  the above already.
- `send` must take the resolved `Address`, never the text in the input.
