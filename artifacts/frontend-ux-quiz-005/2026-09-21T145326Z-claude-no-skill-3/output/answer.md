# Bug: "vitalik.eth → Send stays greyed out"

## Why the user is stuck

- The only check is `/^0x[a-fA-F0-9]{40}$/`, which means "exactly `0x` + 40 hex characters".
- `vitalik.eth` is an **ENS name** (a human-readable name that points to an address, like DNS for wallets). It is not hex, so the regex fails → `isValid = false` → button `disabled`.
- The code never tries to *look up* the name. There is no code path where a name becomes an address.
- Nothing is rendered for the "invalid" state, so the user gets no error, no spinner, no hint. It fails silently. The user can't tell if the app is loading, broken, or rejecting them.

Side problems with the same line:
- The regex accepts any mixed-case hex, even with a wrong checksum (a built-in typo check in mixed-case addresses). A mistyped address can pass. Use viem's `isAddress` instead.
- It checks `input.trim()`, but `send` probably uses raw `input`. A pasted trailing space could be validated one way and sent another way.

## What a production recipient field does with that paste

1. **Take the raw text and classify it.** Trim it. If `isAddress(value)` (viem, checks the checksum), it's a hex address → skip to step 6. If it contains a `.`, treat it as a name. Don't hard-code `.eth`: names like `name.xyz` or `name.cb.id` (resolved off-chain via CCIP-Read, a standard where the resolver fetches the answer from a server) also work.
2. **Normalize the name.** Run `normalize()` from `viem/ens` (ENSIP-15, the standard name-cleanup rules). It lowercases the name and rejects invalid or look-alike Unicode characters. If it throws, show "Invalid name".
3. **Debounce.** Wait about 300 ms after the last keystroke, so you don't fire one lookup per character typed.
4. **Resolve on Ethereum mainnet.** ENS lives on L1. Call `useEnsAddress({ name, chainId: 1 })`. Under the hood viem calls the ENS **Universal Resolver** contract: it finds the name's resolver, asks it for the `addr` record, and follows CCIP-Read if the resolver is off-chain. This has to hit mainnet **even if the dApp sends on an L2**, so wagmi config needs a mainnet transport.
5. **Show every state in the UI:**
   - loading → spinner / "Resolving vitalik.eth…"
   - failed or no `addr` record → a clear error: "vitalik.eth doesn't resolve to an address"
   - success → show the resolved address (shortened + copy button) and ideally the avatar (`useEnsAvatar`), so the user can see *who* they are paying
6. **Reverse lookup for hex input** (optional but standard): if the user pasted `0x…`, show its primary name with `useEnsName({ address, chainId: 1 })`. This confirms they got the right person.
7. **Enable Send only on a resolved address.** The form's value is the `0x` address, not the text. Send is disabled while loading or on error, and enabled when there's a valid address.
8. **Send to the address the user saw.** Pass the resolved `0x` to `sendTransaction` / `writeContract`, never the name. Freeze it at click time so a late re-resolve can't swap the recipient after the user has confirmed it.

## What I'd replace it with

The input should resolve names itself instead of only checking a regex. In a wagmi v2 + viem app:

- **Fastest:** Scaffold-ETH 2's `AddressInput` (published standalone as `@scaffold-ui/components`). It's built on wagmi and already does steps 1–7: ENS resolution, reverse lookup, avatar, loading and error states, and address checksum checks. Wire it as `<AddressInput value={input} onChange={setInput} />` and gate Send on the resolved address.
- **No new dependency:** a small `RecipientInput` built on wagmi hooks:

```tsx
import { useState } from "react";
import { isAddress, type Address } from "viem";
import { normalize } from "viem/ens";
import { useEnsAddress, useEnsName, useEnsAvatar } from "wagmi";
import { useDebounce } from "./useDebounce";

function safeNormalize(v: string) {
  try { return normalize(v); } catch { return undefined; }
}

export function useRecipient(raw: string) {
  const value = useDebounce(raw.trim(), 300);
  const isHex = isAddress(value);
  const name = !isHex && value.includes(".") ? safeNormalize(value) : undefined;

  const ens = useEnsAddress({ name, chainId: 1, query: { enabled: !!name } });
  const reverse = useEnsName({ address: isHex ? (value as Address) : undefined, chainId: 1 });
  const avatar = useEnsAvatar({ name: name ?? reverse.data ?? undefined, chainId: 1 });

  const address: Address | undefined = isHex ? (value as Address) : ens.data ?? undefined;
  const error =
    value && !isHex && !value.includes(".") ? "Not an address or ENS name"
    : value.includes(".") && !name ? "Invalid name"
    : name && ens.isSuccess && !ens.data ? `${value} doesn't resolve to an address`
    : ens.isError ? "Couldn't resolve name"
    : undefined;

  return { address, isLoading: ens.isLoading, error, displayName: name ?? reverse.data, avatar: avatar.data };
}
```

```tsx
const [input, setInput] = useState("");
const { address, isLoading, error, displayName, avatar } = useRecipient(input);

<input value={input} onChange={e => setInput(e.target.value)} placeholder="0x… or name.eth" />
{isLoading && <span>Resolving…</span>}
{error && <span role="alert">{error}</span>}
{address && <span>{avatar && <img src={avatar} />} {displayName} → {address}</span>}
<button disabled={!address || isLoading} onClick={() => send(address!)}>Send</button>
```

Also make sure the wagmi config has a `mainnet` chain with a transport, even if transfers happen on an L2, or ENS lookups will never work.
