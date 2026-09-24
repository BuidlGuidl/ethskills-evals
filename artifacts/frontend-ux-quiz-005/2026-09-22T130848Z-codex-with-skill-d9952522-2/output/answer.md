The user is stuck because the field only treats one shape as valid:

```ts
/^0x[a-fA-F0-9]{40}$/.test(input.trim())
```

`vitalik.eth` is not a 20-byte hex address string, so `isValid` is always
`false`. The button is disabled before `send` can run, and the UI never starts
ENS resolution or shows a validation error. From the user's point of view, the
app appears broken even though the name may resolve perfectly well.

A production recipient field should have done this on paste:

1. Store and trim the pasted value.
2. Classify it as either a hex address or a name-like value.
3. If it is a hex address, validate it with viem's `isAddress`, optionally show
   the checksummed/display address, and enable sending with that address.
4. If it is an ENS name, normalize it and start an async ENS lookup using the
   configured wagmi/viem client, typically `useEnsAddress` or
   `publicClient.getEnsAddress`, against the chain where ENS resolution is
   available, usually mainnet.
5. While resolving, show a resolving state near the field and keep the primary
   action unavailable for an explained reason.
6. If resolution fails or returns no address, show a specific error such as
   "No address found for vitalik.eth" instead of leaving the button silently
   greyed out.
7. If resolution succeeds, show the resolved recipient address before submit,
   ideally with the ENS name/avatar if available, and enable Send.
8. On click, call `send` with the resolved `0x...` address, not the raw
   `vitalik.eth` string.

I would replace this raw `<input>` plus regex gate with the codebase's address
input component if it has one, for example a Scaffold-ETH-style `AddressInput`.
That component should accept both `0x...` addresses and ENS names, resolve ENS
through wagmi v2/viem, expose `resolvedAddress` and validation state, render the
resolved address to the user, and give an inline error when the input cannot be
used. If this codebase does not already have that component, I would add a small
`RecipientAddressInput` wrapper around viem `isAddress` and wagmi
`useEnsAddress`, then make the Send button depend on `resolvedAddress` rather
than on the raw text matching a regex.
