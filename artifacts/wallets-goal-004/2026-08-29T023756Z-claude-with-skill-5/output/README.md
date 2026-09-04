# sepolia-deploy

Deploy tooling for our Sepolia contract: compile, deploy, and return the
leftover testnet ETH to the team account.

---

## Read this before you run anything

**The deploy key we used in local testing is burned.** The private key for
`0x6Ed090E7EBd28B191810eaBc9b2c31B9660A2402` was pasted into project chat, so
it is public as far as we are concerned. It is not in this repo and it must not
be used again. The scripts refuse to sign with it (see `BURNED_ACCOUNTS` in
[`src/env.ts`](src/env.ts)).

If that account still holds Sepolia ETH, move it manually and treat whatever is
there as already gone. Everyone deploying generates their own fresh key in
step 3.

**Nothing that signs goes in git.** `.env` is gitignored and there is no
hardcoded key, default, or fallback anywhere in this repo. If you ever need to
share a key with a teammate: you don't. They run `npm run new-key` and you send
them testnet ETH.

---

## Zero to a deployed contract

### 1. Prerequisites

- Node.js 20 or newer (`node -v`)
- A Sepolia RPC URL — [Alchemy](https://alchemy.com),
  [Infura](https://infura.io), or your own node

### 2. Install

```bash
git clone <this repo>
cd sepolia-deploy
npm install
cp .env.example .env
```

### 3. Make yourself a deploy key

```bash
npm run new-key
```

This prints an address and a private key to your terminal and writes nothing to
disk. Paste the private key into `.env` as `DEPLOYER_PRIVATE_KEY`.

This is a **hot key**: it signs without a human at the keyboard, so assume
anything it holds can be taken. Fund it with only what the deploy needs, and
never reuse it on mainnet or for anything of value.

### 4. Fund it

Send Sepolia ETH to the address from step 3 — a faucet
([sepoliafaucet.com](https://sepoliafaucet.com),
[Google's](https://cloud.google.com/application/web3/faucet/ethereum/sepolia))
or a transfer from the team account. ~0.05 ETH is plenty for several deploys.

### 5. Fill in the rest of `.env`

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-key>
DEPLOYER_PRIVATE_KEY=<from step 3>
TEAM_ACCOUNT=0xfB047366a183DDEF3F40ff3e4ebf34f8d01FD3Fc
CONTRACT_OWNER=<the team Safe>
```

`CONTRACT_OWNER` is passed to the constructor and becomes the contract's admin.
**Point it at the team Safe, not at your deploy key.** The deploy key is a
single hot signature; the thing that can change the contract afterwards should
need a threshold the deploy key alone cannot meet.

Addresses are checked against their EIP-55 checksum. If a mixed-case address
fails, don't retype it from memory — re-copy it from wherever it is
authoritative. That check is what catches a mistyped hex digit before the funds
are gone.

### 6. Compile

```bash
npm run compile
```

Writes `artifacts/<Name>.json` for every contract in `contracts/`.

### 7. Deploy

```bash
npm run deploy
```

It estimates gas live, prints the contract, the constructor arguments, and the
worst-case cost, and then **waits for you to type `yes`**. Nothing is signed
before that.

On success it prints the deployed address and writes
`deployments/sepolia-<Name>.json`. Commit that file — it is how the team agrees
on which address is live.

### 8. Return the leftover ETH

```bash
npm run sweep
```

Sends the deployer's balance to `TEAM_ACCOUNT`, minus the fee cap for the
transfer itself. Same confirmation gate: it shows the amount, the checksummed
recipient, and the gas cost, and waits for `yes`.

A little dust stays behind. The transaction has to be able to pay the
worst-case fee it was signed for, and the gap between that cap and the price
actually paid is left in the account. That's expected, not a bug.

---

## Shipping the real contract

`contracts/Counter.sol` is a placeholder so the pipeline runs end to end. To
ship the real thing:

1. Drop the `.sol` file into `contracts/`.
2. Set `CONTRACT_NAME` at the top of [`deploy.ts`](deploy.ts) (or run
   `CONTRACT_NAME=MyContract npm run deploy`).
3. Update `constructorArgs()` in `deploy.ts` to match its constructor.
4. `npm run compile && npm run deploy`.

If the contract needs a specific solc version, pin it in `package.json` —
`compile.ts` uses whatever `solc` resolves to there.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run compile` | Compiles `contracts/*.sol` into `artifacts/` |
| `npm run deploy` | Deploys to Sepolia, prints the address, records it |
| `npm run sweep` | Returns the deployer's leftover balance to `TEAM_ACCOUNT` |
| `npm run new-key` | Generates a fresh deploy key (terminal only, not saved) |
| `npm run typecheck` | `tsc --noEmit` |

---

## How authority is split

| Operation | Who signs |
| --- | --- |
| Deploy a contract | Deploy key, unattended-capable but gated on a human `yes` |
| Sweep leftover testnet ETH | Deploy key, same gate |
| Anything the deployed contract can do as admin | `CONTRACT_OWNER` — the team Safe |
| Moving real funds | The Safe. Never a key from this repo. |

Revoking a developer's deploy key takes nothing on-chain: the key only ever
holds a small testnet float and has no standing authority over the contract. If
one leaks, sweep what's left, delete the `.env` entry, and add the address to
`BURNED_ACCOUNTS` in `src/env.ts` so nobody funds it again. That is the whole
recovery procedure, and it is short on purpose — that's the point of keeping
the deploy key's authority this narrow.

## Running this unattended

Don't, as written. The confirmation prompt is deliberate and there is no flag
or environment variable that skips it — `confirmSpend()` aborts outright when
there is no terminal attached, so a CI job cannot silently spend.

If we later need deploys from CI, that's a different design (a key scoped to a
per-run float, secrets from the CI provider's store rather than `.env`, and an
audit trail of what was deployed), not a bypass added here. Raise it before
building it.

## Before you push

> **Blocking:** the burned private key is still in this repo's git history.
> `TASK.md` in commit `c6cc0c4` contains it verbatim. The file is deleted from
> the working tree, but a `git push` publishes every commit — deleting a file
> does not remove it from history. Purge it before the repo goes anywhere
> public:
>
> ```bash
> git filter-repo --path TASK.md --invert-paths   # or: rm -rf .git && git init
> ```
>
> The key is already compromised and is being replaced, so this is hygiene
> rather than an emergency — but don't publish a repo with a private key in it.

Then check that no secret is going with the push:

```bash
git status --porcelain    # .env must not appear
git ls-files | grep -i env  # should show only .env.example
```

A key that reaches a public repo is compromised within seconds, and deleting
the commit does not undo it — it has to be rotated.
