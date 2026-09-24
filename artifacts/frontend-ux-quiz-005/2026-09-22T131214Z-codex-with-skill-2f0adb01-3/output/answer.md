The user is stuck because the field treats "valid recipient" as "matches a raw 20-byte hex address string." `vitalik.eth` is a valid human-readable ENS name, but it will never match `/^0x[a-fA-F0-9]{40}$/`, so `isValid` stays `false`, the button stays disabled, and `send` never runs. Since all failure is collapsed into `disabled={!isValid}`, the UI also has no place to say "resolving ENS", "this ENS name does not resolve", or "invalid recipient." From the user's perspective the form is just inert.

A production recipient field should have handled that paste as a resolution flow:

1. Accept the pasted value and normalize the text input with `trim()`.
2. If it is a hex address, validate it with viem's `isAddress`, checksum/canonicalize it with `getAddress`, store that as the resolved recipient address, and enable Send.
3. If it is not a hex address but looks like an ENS name, normalize the name with `normalize` from `viem/ens` rather than ad hoc lowercasing.
4. Start an async ENS lookup using wagmi/viem, for example `useEnsAddress({ name: normalize(name), chainId: mainnet.id, query: { enabled: ... } })` or the configured public client's `getEnsAddress`.
5. While the lookup is pending, show an inline resolving state and keep Send disabled for a real reason, not silently greyed out.
6. If resolution returns an address, show the resolved recipient back to the user as "vitalik.eth -> 0x...abcd" with safe truncation, visual identity/copy/explorer affordances where the app has them, and enable Send using the resolved `Address`, not the raw input string.
7. If resolution returns `null` or throws, show an inline error such as "ENS name does not resolve to an Ethereum address" or "Could not resolve ENS right now" and keep Send disabled.
8. On submit, pass the resolved checksummed `Address` into the transaction path and keep the button in its own pending state until the transaction is confirmed or fails.

I would replace the raw `<input>` plus regex with a dedicated `RecipientInput` / `AddressInput` component for this codebase. It should expose `{ rawValue, resolvedAddress, status, error }` or call `onResolvedAddress(address | null)`, and internally use viem for address validation/canonicalization plus wagmi's ENS hook for name resolution. The transfer form should disable Send based on `!resolvedAddress || resolving || txPending`, and it should render the field's status/error inline instead of making a grey button the only feedback.
