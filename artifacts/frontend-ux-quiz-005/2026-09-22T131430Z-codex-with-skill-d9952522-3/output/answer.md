The user is stuck because the form treats "valid recipient" as "matches a
literal 20-byte hex address":

```ts
/^0x[a-fA-F0-9]{40}$/.test(input.trim())
```

`vitalik.eth` is a valid human Ethereum name, but it will never match that
regex. Because `isValid` stays `false`, the button stays disabled, `send`
never runs, and the user gets no validation message or resolution attempt.
The UI has silently confused "not already a hex address" with "not a valid
recipient".

A production recipient field should have handled that paste like this:

1. Normalize the pasted value by trimming whitespace.
2. Detect whether the value is already a hex address or an ENS-style name.
3. If it is a hex address, validate it with viem's address utilities, not a
   hand-written regex, and checksum/display the normalized address.
4. If it is a name such as `vitalik.eth`, resolve it through the configured
   public client on the correct chain, for example with viem/wagmi ENS
   resolution rather than waiting until submit.
5. Show a loading/resolving state while the lookup is in flight.
6. If the name resolves, show the resolved `0x...` address before the user
   sends, preferably with an address preview/avatar/copy affordance.
7. Store and submit the resolved hex address, not the original text label.
8. If the name does not resolve, the chain does not support the lookup, or the
   lookup fails, show a nearby error explaining that the recipient could not be
   resolved, and keep Send disabled for that reason.

In this codebase I would replace the raw `<input>` plus regex gate with the
project's address/ENS-aware recipient component if one exists in the UI kit.
If there is no such component, I would add a small `RecipientAddressInput`
component that uses wagmi v2/viem primitives:

- `isAddress` / `getAddress` from viem for literal addresses.
- `useEnsAddress` or the configured viem public client's `getEnsAddress` for
  `.eth` names.
- local state for `rawInput`, `resolvedAddress`, `isResolving`, and a visible
  validation error.
- a callback such as `onResolvedAddressChange(address | undefined)` so the
  transfer form can enable Send only when it has a real hex address.

The button should then be gated on `resolvedAddress`, not on the raw text:

```tsx
<RecipientAddressInput onResolvedAddressChange={setRecipient} />
<button disabled={!recipient || isSending} onClick={() => send(recipient)}>
  Send
</button>
```

That preserves the contract call's need for an address while letting users
enter the names Ethereum users actually share with each other.
