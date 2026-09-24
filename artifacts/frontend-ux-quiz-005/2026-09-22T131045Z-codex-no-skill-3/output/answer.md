The user is stuck because the form treats "valid recipient" as "matches a 20-byte hex address string":

```ts
/^0x[a-fA-F0-9]{40}$/.test(input.trim())
```

`vitalik.eth` is not a hex address, so `isValid` is always `false`. Because the only feedback is `disabled={!isValid}`, the UI silently locks the Send button. The app never attempts ENS resolution, never distinguishes "still resolving" from "invalid", and never explains that the typed value is a name that must resolve to an address before a transaction can be sent.

A production recipient field should have handled the paste like this:

1. Trim the pasted value and keep it as the display value.
2. Classify the input:
   - If it is a hex address, validate it with `viem`'s `isAddress`, normalize it with `getAddress`, and use that checksummed address as the recipient.
   - If it looks like an ENS name, start an async ENS lookup instead of rejecting it with a regex.
3. Resolve the ENS name through the configured wagmi/viem public client, normally using mainnet ENS resolution, for example `useEnsAddress({ name, chainId: mainnet.id })` or `publicClient.getEnsAddress({ name })`.
4. While the lookup is pending, show an inline "Resolving..." state and keep Send disabled for that reason.
5. If resolution succeeds, store the resolved `0x...` address separately from the raw input, show the resolved/checksummed address or identity preview, and enable Send.
6. If resolution fails or the name has no address record, show a clear inline error such as "No address found for vitalik.eth" and keep Send disabled.
7. When sending, pass the resolved address to the transaction code, not the raw input string.

I would replace the plain `<input>` plus regex with a reusable `AddressOrEnsInput` / `RecipientInput` component backed by wagmi v2 and viem. Its API should expose something like `value`, `onChange`, `resolvedAddress`, `isResolving`, and `error`, so the transfer form can disable Send based on `!resolvedAddress || isResolving` and can display the actual reason. If this is a Scaffold-ETH style codebase with its `AddressInput` available, I would use that established component rather than hand-rolling another recipient parser.
