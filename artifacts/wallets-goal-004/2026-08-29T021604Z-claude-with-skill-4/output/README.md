# Sepolia deploy tooling

Compile a Solidity contract, deploy it to Sepolia with [viem](https://viem.sh),
and return the leftover testnet ETH when you are done.

```
compile.ts   contracts/*.sol -> artifacts/*.json (abi + bytecode)
deploy.ts    deploys to Sepolia, prints the address, records it in deployments/
sweep.ts     returns the deploy account's leftover ETH to the team account
```

---

## Zero to deployed

### 1. Install

```bash
git clone <this repo> && cd <this repo>
npm install
```

Node 20 or newer.

### 2. Get your own deploy key

**Do not ask a teammate for theirs.** Every person who deploys uses their own
throwaway account. Generate one:

```bash
npm run new-deployer
```

It prints an address and a private key to your terminal and writes nothing to
disk. Copy the private key into your `.env` in the next step.

### 3. Configure

```bash
cp .env.example .env
```

Fill in:

| Variable | What it is |
| --- | --- |
| `DEPLOYER_PRIVATE_KEY` | The key from step 2. Secret. |
| `SEPOLIA_RPC_URL` | Your Sepolia endpoint — [Alchemy](https://alchemy.com), [Infura](https://infura.io), or your own node. |
| `CONTRACT_OWNER` | The **team Safe**. This address owns the contract after deploy — not your deploy key. |
| `SWEEP_DESTINATION` | Where `sweep.ts` returns leftover ETH. Pre-filled with the team account. |

`.env` is gitignored. Keep it that way: never commit it, never paste its
contents into Slack, a ticket, or a PR description.

### 4. Fund the deploy account

Send it Sepolia ETH from a faucet — [Alchemy's](https://www.alchemy.com/faucets/ethereum-sepolia)
or [Google Cloud's](https://cloud.google.com/application/web3/faucet/ethereum/sepolia).

Fund it with roughly what this deploy needs, not more. A deploy costs on the
order of 0.001 ETH; 0.05 ETH is a comfortable ceiling for a day of retries.
The account is disposable, so whatever sits in it is what you can lose.

### 5. Compile

```bash
npm run compile
```

Writes `artifacts/Counter.json`. Swap `contracts/Counter.sol` for the real
contract and update `CONTRACT_NAME` (and `constructorArgs()`) at the top of
`deploy.ts`.

> Already using Foundry or Hardhat? Delete `compile.ts` and point `loadArtifact`
> in `deploy.ts` at their output instead — the header comment in `compile.ts`
> lists both paths.

### 6. Deploy

```bash
npm run deploy
```

It prints what it is about to do — contract, network, deployer, owner, gas
limit, worst-case cost — and waits for you to type `yes`. Then it broadcasts,
waits for the receipt, prints the deployed address, and writes
`deployments/sepolia-<Contract>.json`.

Commit that file. It is how the team agrees on one address.

### 7. Sweep the leftovers

```bash
npm run sweep
```

Sends the deploy account's remaining balance to `SWEEP_DESTINATION`, minus a
reserve for the transfer's own gas. Same confirmation gate. A little dust stays
behind — the reserve is the worst case and unused gas is refunded.

After sweeping, delete the key from your `.env`. Next deploy, generate a new one.

---

## How the accounts are arranged, and why

There are two accounts in this system and they hold very different power.

**The deploy key** signs unattended-ish, lives in a `.env` on a laptop, and is
the thing most likely to leak — a stray commit, a screenshot, a shell history, a
CI log. So it holds only enough ETH for one deploy and holds no authority over
anything that matters. If it leaks, the loss is a few dollars of testnet gas and
five minutes generating a new one.

**The team Safe** holds the value and the control. It is passed to the contract
constructor as `CONTRACT_OWNER`, so once the deploy transaction is mined, the
key that signed it cannot call `reset()`, cannot transfer ownership, cannot do
anything privileged. The Safe can — behind its signing threshold.

Storage does not create this separation; authority does. A deploy key in a KMS
that also owns the contract is still one stolen credential away from total loss.
Bound what the key *can do* first, then worry about where it lives.

`contracts/Counter.sol` is a placeholder, but it demonstrates the shape: the
owner arrives as a constructor argument. Keep that when you swap in the real
contract. If your contract has no owner, nothing changes — the deploy key is
still disposable.

### What needs a human, always

- **Moving principal.** Any transfer out of the Safe.
- **Changing who can sign.** Safe owners, threshold, any admin role on the contract.
- **Raising a limit.** Including the deploy account's float.

Both scripts here gate on a typed `yes` and refuse to run when stdin is not a
TTY. There is deliberately no `--yes` flag. If you find yourself wanting one,
the answer is not to remove the gate — it is a signer with bounded authority
(a Safe module, a capped allowance, a relayer) so that unattended signing cannot
cost you anything you would miss.

### Revoking a deploy key

You do not need the key's cooperation, because it controls nothing:

1. Sweep it (`npm run sweep`), or just abandon it — it is testnet dust.
2. Remove it from your `.env`.
3. Generate a new one.

The contract is unaffected; the Safe still owns it.

### Going to mainnet

Everything above holds, with two changes:

- **A key that has been in a `.env` on a laptop is not a mainnet signer.** Use a
  hardware wallet, or better, deploy from an account whose only job is deploying
  and whose output is immediately owned by the Safe.
- **Do not make one hardware wallet the treasury.** A threshold of 2-of-3 across
  separate devices means an attacker needs several devices rather than one — and
  one person can hold all three. A multisig does not require multiple people.

---

## Security

- `.env`, `.env.*`, `*.key`, and `keystore/` are gitignored **before** the first
  push. A secret that reaches GitHub is scraped within seconds; deleting the
  commit afterwards does not un-leak it.
- No key, default, or fallback is baked into this repo. If `DEPLOYER_PRIVATE_KEY`
  is unset, the scripts stop rather than sign with something else.
- Keys are read from the environment only, never from a command-line argument —
  argv lands in your shell history and in `ps` output.
- Addresses from the environment are checksum-validated. A mixed-case address
  that fails EIP-55 is rejected outright; an all-lowercase one carries no
  checksum at all, so the confirmation screen flags it as unverifiable.

**If a private key ever appears in a chat message, a ticket, a prompt, or a
commit — it is burned.** Sweep it, replace it, and never fund that address
again. There is no "it was only visible briefly."

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run new-deployer` | Generate a fresh deploy account. Prints only, writes nothing. |
| `npm run compile` | Compile `contracts/*.sol` into `artifacts/`. |
| `npm run deploy` | Deploy to Sepolia. Confirmation required. |
| `npm run sweep` | Return leftover ETH to `SWEEP_DESTINATION`. Confirmation required. |
| `npm run typecheck` | `tsc --noEmit`. |

## Layout

```
contracts/Counter.sol       placeholder contract (owner via constructor)
compile.ts                  solc -> artifacts/
deploy.ts                   deploy + record
sweep.ts                    return leftover ETH
scripts/new-deployer.ts     generate a throwaway deploy account
src/env.ts                  env loading, checksum validation, no defaults for secrets
src/clients.ts              viem clients + chain-id assertion
src/confirm.ts              the human gate
.env.example                template — no real values
```
