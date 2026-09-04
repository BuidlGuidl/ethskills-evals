# Sepolia deploy tooling

Compile a Solidity contract, deploy it to Sepolia with [viem](https://viem.sh),
and sweep the leftover testnet ETH back to the team account.

```
compile.ts     contracts/*.sol -> out/<Name>.json  (abi + bytecode)
deploy.ts      deploys an artifact, prints the address, logs it to deployments/
sweep.ts       returns the deploy account's leftover ETH to the team account
config.ts      env loading, the Sepolia chain guard, the confirmation prompt
```

---

## Zero to deployed

### 1. Install

Node 20+ and npm.

```bash
git clone <this repo>
cd <this repo>
npm install
```

### 2. Get an RPC endpoint

A free Alchemy or Infura Sepolia key works. So does any node you already run.

### 3. Make yourself a deploy key

**Generate your own — do not ask a teammate for theirs, and do not reuse the
one from local testing** (see [Key handling](#key-handling) for why).

```bash
# Foundry:
cast wallet new

# or, with nothing but this repo installed:
node -e "const{generatePrivateKey,privateKeyToAccount}=require('viem/accounts');const k=generatePrivateKey();console.log('address:',privateKeyToAccount(k).address);console.log('key    :',k)"
```

### 4. Fill in `.env`

```bash
cp .env.example .env
```

Put your RPC URL and the private key from step 3 in it. `.env` is gitignored.
Nothing in this repo reads a key from anywhere else, and no key is baked in.

### 5. Fund the deploy account

Send Sepolia ETH to the address from step 3 — a faucet
([Google](https://cloud.google.com/application/web3/faucet/ethereum/sepolia),
[Alchemy](https://sepoliafaucet.com)) or a teammate. **Send roughly what the
deploy needs, ~0.05 ETH, not your whole testnet balance.** This key signs
unattended; whatever sits behind it is what an attacker gets.

### 6. Compile

```bash
npm run compile
```

Writes one `out/<ContractName>.json` per contract. `contracts/Counter.sol` is a
placeholder so the toolchain runs out of the box — replace it with the contract
you are shipping.

### 7. Deploy

```bash
npm run deploy -- Counter 42
```

`Counter` is the contract name; everything after it is passed to the
constructor in order (integers become `uint256`, `true`/`false` become `bool`,
JSON arrays become arrays, anything else stays a string).

The script prints the deployer, the balance, the live gas estimate and the
maximum cost, then waits for you to type `yes`. On success it prints the
deployed address and appends the deployment to `deployments/sepolia.json` —
commit that file so the team has a record of what shipped.

Add `--yes` to skip the prompt in a scripted run.

### 8. Hand the contract over to the team account

If your contract has an owner, admin, or upgrade role, **the deploy EOA should
not keep it.** Transfer it to the team account as the last step of the deploy.
The placeholder `Counter.sol` sets `owner = msg.sender`, which leaves the hot
deploy key in charge — that is fine for a counter on a testnet and not fine for
anything that holds value. See [Who can sign what](#who-can-sign-what).

### 9. Sweep the leftovers back

```bash
npm run sweep                 # send everything the gas reserve allows
npm run sweep -- --keep 0.02  # leave 0.02 ETH for the next deploy
```

Destination is the team account, pinned in `config.ts`:

```
0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc
```

The script prices gas live, reserves the worst-case fee so the send cannot
fail, prints the amount and destination, and waits for you to type `yes`. A few
wei of refunded gas stay behind by design.

---

## Key handling

**The deploy key from local testing is burned. Do not use it here.** It was
pasted into a chat with an assistant, which means it has been through at least
one system nobody on the team controls, and it may sit in logs or a transcript
indefinitely. Assume it is public:

- Generate a fresh key (step 3) for every person who deploys.
- Move any leftover Sepolia ETH off the old account and abandon it.
- Never send that address anything on mainnet, and never reuse it for a
  contract that has an owner or admin role.

That is not a judgement about how careful anyone was — a key that has been
copied anywhere it can be read cannot be un-copied, and testnet keys have a
habit of turning into mainnet keys later.

Ongoing rules for this repo:

- `.env` and `*.key` are in `.gitignore` from the first commit. A key committed
  to a repo that the whole team can see is compromised within seconds of the
  push; deleting the commit afterwards does not undo it. If it happens, rotate
  the key — do not just force-push.
- Keys go in `.env` on your own machine only. Not in Slack, not in a ticket, not
  in a PR description, not pasted into an assistant.
- Each deployer gets their own key. Shared keys mean nonce collisions and no way
  to tell who deployed what.
- For CI, use the runner's secret store and give it a key funded for exactly one
  deploy. `npm run sweep -- --yes` will empty an account without a human
  looking at it — do not put it in a pipeline.

---

## Who can sign what

Where a key lives limits *who* can use it. It does not limit *what* it can do.
Worth settling before this goes to mainnet:

**The deploy key is a hot key.** It signs without a human present, from a
developer laptop or a CI runner. Give it only what you would accept losing: gas
for the deploys it is doing, and no standing role over anything it deploys.
Sweeping after each deploy (step 9) is what keeps that balance small — that is
the point of `sweep.ts`, not just tidiness.

**The team account is the principal.** If
`0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc` is a plain EOA, then one key
controls everything the team owns and one stolen laptop takes all of it. Before
mainnet, make it a [Safe](https://safe.global) with a threshold of 2 or more.
This does not require more people: one person holding keys on a laptop, a
hardware wallet and a phone meets a 2-of-3 threshold alone, and an attacker then
needs two devices instead of one. That is why a lone hardware wallet is not the
strongest way to hold a treasury.

**These operations need a human signature, from the multisig and not the deploy
key:**

- moving the principal — anything beyond the deploy float
- granting, transferring or renouncing an owner/admin/upgrade role
- raising what the deploy key itself is allowed to spend
- changing the Safe's owner set or threshold

**Revoking the deploy key** must not need the key's cooperation. Concretely: the
deployed contract's admin role lives on the Safe, so the Safe can rotate to a
new deployer address on its own. Locally, revoking is deleting `.env`, rotating
the RPC key, and sweeping the account — do all three, since only the last one
actually removes the funds.

---

## Notes

- **The team address as originally circulated fails its EIP-55 checksum.**
  `0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC` has the right 40 hex digits but
  the wrong capitalisation, so it was re-cased somewhere between the wallet and
  the doc rather than copied from a checksummed source. The correct form is
  pinned in `config.ts`. Since the casing was lost, the checksum never
  protected those digits — **check the address against the wallet itself before
  the first mainnet transfer**, not against a chat message.
- Every script refuses to run unless the RPC reports chain 11155111. A
  mis-pointed `SEPOLIA_RPC_URL` is the cheapest way to spend real ETH by
  accident. Keep the guard when adding networks; do not widen it into "any
  chain".
- `npm run typecheck` runs `tsc --noEmit` over everything.
- Contract verification on Etherscan is not wired up yet. Until it is,
  `forge verify-contract` against `out/<Name>.json` is the shortest path.
