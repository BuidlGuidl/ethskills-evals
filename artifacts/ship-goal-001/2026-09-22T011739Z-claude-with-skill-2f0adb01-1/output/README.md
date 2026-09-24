# Toolshed

A lending library for a neighbourhood association of ~300 members. Members list tools they own,
another member asks to borrow one for a few days and escrows a deposit in USDC, and they get it
back when the tool comes home. Tools come back late a lot, so a daily late fee is taken out of
the deposit and paid to the owner. Every settled loan updates both members' track records, and
those records drive the sorting on the browse and request screens, so the reliable neighbours
get lent to first.

- One Solidity contract (`Toolshed.sol`) on **Base**, holding the escrow and the track record.
- A Next.js frontend (Scaffold-ETH 2) with five screens: browse, my shed, borrowing, neighbours,
  steward.
- Photos and condition notes live offchain (IPFS or an inline `data:` URI); only the URI is
  stored onchain.

---

## Contents

- [How a loan works](#how-a-loan-works)
- [Architecture](#architecture)
  - [What's onchain and what isn't](#whats-onchain-and-what-isnt)
  - [The loan state machine](#the-loan-state-machine)
  - [Money: where every cent can go](#money-where-every-cent-can-go)
  - [Track record](#track-record)
  - [Roles and trust](#roles-and-trust)
  - [Why Base](#why-base)
  - [Repository layout](#repository-layout)
- [Getting it running locally](#getting-it-running-locally)
- [Tests](#tests)
- [Deploying](#deploying)
- [Configuration reference](#configuration-reference)
- [Known limitations](#known-limitations)

---

## How a loan works

1. **Alice lists her drill.** Name, photo and condition notes go to IPFS; the deposit
   (say 60 USDC), the daily late fee (2 USDC) and the longest loan she'll grant (7 days) go
   onchain.
2. **Bob asks to borrow it for 3 days.** His 60 USDC moves into the contract's escrow right
   there, so Alice can see the deposit is real before she parts with the drill.
3. **Alice hands it over** and calls `approveRequest`. The clock starts: due in 3 days.
4. **Bob brings it back.** He calls `declareReturn`, which freezes the late-fee clock at that
   moment; Alice confirms and the contract splits the deposit — late fee to Alice, the rest
   back to Bob. Both track records are updated in the same transaction.

Every branch off that happy path has a way out that somebody is motivated to call:

| Situation | Who unsticks it | How |
|---|---|---|
| Alice never answers the request | anyone, after 3 days | `expireRequest` refunds Bob |
| Alice says no | Alice | `declineRequest` refunds Bob |
| Bob changes his mind | Bob | `cancelRequest` refunds himself |
| Bob returns it, Alice goes quiet | anyone, 3 days after `declareReturn` (and never before the due date) | `finalizeReturn` settles at the declared return time |
| Alice says it isn't actually back | Alice, once, then the steward | `disputeReturn` restarts the clock; `resolveDispute` settles it |
| The drill never comes back | Alice | `claimDefault` takes the whole deposit once late fees reach it (or 30 days past due) |

No path leaves a deposit sitting in the contract forever, and no path pays out more than the
deposit that came in.

---

## Architecture

```
┌────────────────────────── browser ───────────────────────────┐
│  Next.js app (packages/nextjs)                               │
│   browse · my shed · borrowing · neighbours · steward        │
│   sorting + reliability scores computed here from counters   │
└───────┬────────────────────────────────┬─────────────────────┘
        │ wagmi/viem reads + writes      │ fetch listing JSON
        ▼                                ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│ Toolshed.sol (Base)      │    │ IPFS (or an inline data: URI)│
│  · member roster         │    │  { name, photo, condition }  │
│  · tool terms + URI      │    └──────────────────────────────┘
│  · loan escrow + payouts │
│  · track-record counters │──── moves USDC ───▶ ┌────────────┐
└──────────────────────────┘                     │ USDC (ERC20)│
                                                 └────────────┘
```

### What's onchain and what isn't

Onchain, because it is money, ownership or a commitment two neighbours need to agree on without
trusting each other:

- the member roster (who may list and borrow),
- each tool's economic terms: deposit, daily late fee, maximum loan length, availability,
- the loan escrow and the settlement arithmetic,
- the raw track-record counters: loans returned, late returns, total late days, defaults,
  loans lent out.

Offchain, because putting it onchain would cost gas and buy nothing:

- photos, names and condition notes — a JSON document behind `metadataURI`,
- the reliability score and all sorting — computed in the browser from the onchain counters
  (`packages/nextjs/utils/toolshed/reputation.ts`),
- any notification, reminder or nudge.

### The loan state machine

```
                       requestLoan (deposit escrowed)
                                  │
                                  ▼
                            ┌───────────┐  declineRequest / cancelRequest / expireRequest
                            │ Requested │────────────────────────────────▶ refund, closed
                            └─────┬─────┘
                       approveRequest │ (owner: "I handed it over")
                                  ▼
       claimDefault  ┌──────────────────────┐   declareReturn
   ◀──────────────── │        Active        │ ─────────────────▶ ┌────────────────┐
   owner keeps all   └──────────────────────┘                    │ ReturnDeclared │
   (not if disputed)    ▲          │ confirmReturn               └───────┬────────┘
       disputeReturn    └──────────┼──────────────┐          confirmReturn │ finalizeReturn
       (once; clock resumes)       ▼              │          (owner)       │ (anyone, once the
                             ┌───────────┐        └────────────────────────┤  window AND the due
                             │ Completed │◀────────────────────────────────┘  date have passed)
                             └───────────┘   fee → owner, remainder → borrower

                        resolveDispute (steward) ──▶ Completed, at agreed late days
```

Every transition has a named caller with a reason to pay the gas: the borrower wants their
deposit back, the owner wants their late fee, and the two "anyone" transitions
(`expireRequest`, `finalizeReturn`) exist precisely so that an absent counterparty can't hold
money hostage — in practice the party who is owed the money calls them.

Two details in there are load-bearing, and both came out of the security review:

- **`finalizeReturn` waits for the due date as well as the confirm window.** Otherwise a
  borrower could declare a return the moment they took the tool, wait three days and refund
  themselves in full while the loan still had weeks to run — a free tool. An honest early return
  loses nothing by waiting, because the fee is measured at the declared time either way (and the
  owner can confirm it immediately).
- **An owner can dispute once.** Disputing restarts the fee clock; an owner who could do it
  repeatedly would outrun the borrower's ability to re-declare and settle, drive the fees to the
  cap and take the whole deposit off somebody who did nothing wrong. After one dispute the loan
  can only end by the owner confirming, by the borrower re-declaring and settling after the
  window, or by the steward — `claimDefault` is off the table.

**Payouts can't wedge the machine.** USDC can blacklist an address, and a push transfer to a
blacklisted borrower would otherwise revert the entire settlement — freezing the owner's fee and
the tool along with the borrower's refund. Every payout goes through `_payout`, which falls back
to a `credits[payee]` balance the payee pulls later with `withdrawCredit`. State always advances;
only the money waits.

### Money: where every cent can go

The deposit is the only pot of value in a loan, and it is the cap on everything:

```
lateDays   = ceil((endOfLoan - dueAt) / 1 day)     // any started day counts
feeToOwner = min(lateDays × feePerDay, deposit)
refund     = deposit − feeToOwner
```

`endOfLoan` is the moment the borrower declared the return, if they declared one; otherwise
it's the moment the owner confirms. That asymmetry is deliberate: it means an owner who takes
their time confirming cannot inflate the bill, and a borrower who never says anything keeps
accruing.

USDC has **6 decimals**, and every amount in the contract, the tests and the UI is in raw token
units (60 USDC = `60_000_000`). There is no cross-decimal maths anywhere in the contract, which
is why there are no scaling factors to get wrong.

Listing rules that keep the maths safe: `deposit > 0`, `0 < feePerDay <= deposit` (so one late
day can never swallow the whole deposit, and an unreturned tool always reaches the cap
eventually, which is what makes `claimDefault` reachable), and `1 <= maxDays <= 60`.

### Track record

The contract keeps counters only. Per member: `loansBorrowed`, `lateReturns`, `totalLateDays`,
`defaults`, `loansLent`, `openBorrows`. The score is computed in the frontend:

```ts
loans       = loansBorrowed + defaults
onTime      = loansBorrowed − lateReturns
reliability = (onTime + 1) / (onTime + lateReturns + defaults + 2)   // Laplace prior
score       = reliability × 1000 + min(loans, 50)                    // volume as tie-break
```

The `+1 / +2` prior is the interesting bit: without it, a neighbour with a single on-time return
would rank above one with forty, and a brand-new member would look either perfect or terrible.
With it, everybody starts at 50% and the ranking converges as the history grows.

It's used in two places: the browse screen sorts tools by their **owner's** record, and the
"asking to borrow" list on *My shed* sorts requests by the **borrower's** record, so the
reliable neighbours are the ones an owner sees and says yes to first. A member is also capped
at 5 open requests + loans at a time, so nobody can corner the shed.

### Roles and trust

- **Member** — on the roster. Can list tools, request loans, and settle their own loans.
- **Steward** (`STEWARD_ROLE`) — the association's account. Admits and removes members, and
  settles *disputed* returns with an agreed number of late days. That's all: the steward cannot
  touch an undisputed loan, cannot pay themselves, and is still capped by the deposit.

Nothing onchain can prove that a physical drill changed hands, so somebody has to be the
tie-breaker when two neighbours disagree; for a neighbourhood association, that's the committee.
Everything else is designed so the steward is never needed: they can't pause the contract, can't
freeze a deposit, and removing a member doesn't affect that member's running loans.

**Privacy note worth telling your members:** every listing, loan, deposit and late return is
public and permanent on Base, tied to a wallet address. Anybody can see who borrows a lot and
who returns things late.

### Why Base

Consumer app, hundreds of small interactions, non-crypto-native users, and USDC is native
there. Base gives Coinbase-wallet distribution and smart-wallet onboarding, and a loan request
costs a fraction of a cent, which matters when the deposit itself is only $60. The contract has
no dependency on anything Base-specific — it's a plain ERC-20 escrow, so it runs unchanged on
mainnet or another L2 if the association ever wants to move; only the USDC address changes.

### Repository layout

```
packages/foundry/
  contracts/Toolshed.sol          the whole protocol, ~690 lines with comments
  script/DeployToolshed.s.sol     picks the right USDC per chain, seeds a local roster
  test/Toolshed.t.sol             40 unit + fuzz tests against a mock 6-decimal USDC
  test/ToolshedFork.t.sol         the same lifecycle against real USDC on a Base fork
packages/nextjs/
  app/                            browse (/), /my-shed, /borrowing, /members, /steward
  components/toolshed/            cards, the deposit approve→execute button, the listing form
  hooks/toolshed/                 contract reads, chain-time clock
  utils/toolshed/                 fee maths mirror, reputation, USDC formatting, metadata I/O
  contracts/externalContracts.ts  USDC addresses per chain
scripts/fund-local-usdc.sh        give yourself USDC on a local fork
```

---

## Getting it running locally

### Requirements

- Node >= 20.18.3 and Yarn (the repo pins Yarn 4 via corepack)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)
- Git

### Four commands

```bash
git submodule update --init --recursive   # forge-std + OpenZeppelin, if you cloned this
yarn install

# terminal 1 — a local fork of Base, so real USDC exists at its real address
yarn fork --network base

# terminal 2 — deploy Toolshed and generate the frontend's ABI/address file
yarn deploy

# terminal 3 — the app on http://localhost:3000
yarn start
```

`yarn fork` (not `yarn chain`) matters: the contract needs a real USDC to escrow, and forking
Base gives you one without deploying a mock.

The local deploy admits the first four Anvil accounts as members and makes the deployer
(Anvil account #9) the steward, so there's something to click on immediately.

### Give yourself some USDC

The burner wallet in the corner has ETH but no USDC. Copy its address and:

```bash
yarn fund:local 0xYourBurnerAddress 300     # 300 USDC on the local fork
```

To act as a member you also need to be on the roster. Either connect with one of the seeded
Anvil accounts, or admit your burner from the steward account:

```bash
cast send <TOOLSHED_ADDRESS> "admitMember(address)" 0xYourBurnerAddress \
  --unlocked --from 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720 \
  --rpc-url http://127.0.0.1:8545
```

Then: list a tool from **My shed**, request it from **Browse** with a second wallet, approve,
and watch the late fee tick up by warping the chain forward:

```bash
cast rpc evm_increaseTime 432000 --rpc-url http://127.0.0.1:8545   # 5 days
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

### If port 8545 is taken

Run anvil elsewhere and tell the frontend:

```bash
anvil --fork-url https://mainnet.base.org --chain-id 31337 --port 8547
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8547 --broadcast --ffi \
  --account scaffold-eth-default --password localhost      # from packages/foundry
NEXT_PUBLIC_FOUNDRY_RPC_URL=http://127.0.0.1:8547 yarn start
```

### Photos

Out of the box there's no IPFS node, so the listing form takes a **photo URL** and stores the
listing JSON inline as a `data:application/json;base64,…` URI. That works with zero
infrastructure and costs a few hundred bytes of calldata per listing.

Point `NEXT_PUBLIC_IPFS_API_URL` at a Kubo RPC endpoint you can write to (your own node, or a
pinning service's compatible API) and the form switches to real file uploads, pinning both the
photo and the JSON and storing an `ipfs://…` URI instead. Set `NEXT_PUBLIC_IPFS_GATEWAY` if you
don't want to read through `ipfs.io`.

---

## Tests

```bash
yarn test                                   # all of it
cd packages/foundry
forge test -vvv                             # verbose
forge test --no-match-contract Fork         # unit + fuzz only, no network
forge coverage --no-match-contract Fork --report summary
```

45 unit and fuzz tests plus 2 fork tests, ~95% line coverage of `Toolshed.sol`. They cover each
closing path (decline, cancel, expire, confirm, auto-finalize, dispute, steward resolution,
default), access control on every restricted function, the fee cap, the frozen clock after a
declared return, and the reputation counters. There are regression tests for each issue the
security review turned up, including a blacklisting token mock (`ToolshedBlockedToken.t.sol`) that
checks a blocked borrower can't stall the owner's fee or the tool. Two invariants are fuzzed:
settlement always pays out exactly the deposit and never more, and an on-time return is always
free.

`ToolshedFork.t.sol` runs the lifecycle against Circle's real USDC on a Base fork; it skips
itself if no Base RPC is reachable (set `BASE_RPC_URL` to use your own).

Static analysis:

```bash
slither packages/foundry/contracts/Toolshed.sol \
  --solc-remaps @openzeppelin/contracts=packages/foundry/lib/openzeppelin-contracts/contracts
```

Everything it reports is understood and accepted:

- `timestamp` — deliberate. Every deadline here is measured in days; a few seconds of validator
  drift doesn't matter.
- `reentrancy-no-eth` / `reentrancy-benign` on `_payout` — the deferred-credit write necessarily
  happens after the transfer attempt. `token` is immutable and is a real USDC deployment, and
  every entry point that can reach it is `nonReentrant`.
- `low-level-calls` and `incorrect-equality` on `_payout` — that's the `try to pay, book it on
  failure` pattern and the ERC-20 return-value decode.
- `pragma` / `solc-version` — OpenZeppelin's headers span a range; everything compiles with one
  solc (0.8.33).

---

## Deploying

### 1. Pick the account

```bash
yarn generate            # creates a deployer keystore, or
yarn account:import      # imports an existing key
yarn account             # shows the address and balances — fund it with a little ETH
```

Never put a private key in a file in this repo. The keystore lives outside it, and `.env` is
gitignored — keep it that way.

### 2. Choose the steward

`STEWARD_ADDRESS` in `packages/foundry/.env` becomes the roster keeper and dispute arbiter, and
holds `DEFAULT_ADMIN_ROLE`. **Use a Gnosis Safe**, not the deployer EOA — it's the one account
with any privilege in the system, and a neighbourhood association should not have it behind one
person's phone. If you leave it unset it defaults to the deployer, which is fine locally and
wrong in production.

### 3. Deploy and verify

```bash
yarn deploy --network baseSepolia     # rehearsal — Circle's testnet USDC is wired in
yarn verify --network baseSepolia

yarn deploy --network base            # the real thing
yarn verify --network base
```

The deploy script picks USDC by chain id (Base `0x8335…2913`, Base Sepolia `0x036C…CF7e`,
mainnet `0xA0b8…eB48`), all verified onchain via `symbol()`/`decimals()`. On any other chain,
set `USDC_ADDRESS`. Verify immediately after deploying — an unverified contract asking
neighbours for a deposit looks exactly like a scam.

Sanity-check the live deployment before telling anyone about it:

```bash
cast call <TOOLSHED> "token()(address)" --rpc-url https://mainnet.base.org
cast call <TOOLSHED> "hasRole(bytes32,address)(bool)" \
  $(cast keccak "STEWARD_ROLE") <YOUR_SAFE> --rpc-url https://mainnet.base.org
```

### 4. Point the frontend at it

In `packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.base],          // was [localFork]
```

A public RPC is fine for 300 members, but a dedicated one is better —
set `NEXT_PUBLIC_ALCHEMY_API_KEY`, or add `[chains.base.id]: process.env.NEXT_PUBLIC_BASE_RPC_URL`
to `rpcOverrides`. Also get your own WalletConnect project id
(`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`); the shipped default is Scaffold-ETH's shared one.
`burnerWalletMode` is already `"localNetworksOnly"`, so the burner wallet disappears in
production.

### 5. Ship the frontend

```bash
yarn vercel          # hosted, fastest path
yarn ipfs            # static export pinned to IPFS
```

The app is fully static (no API routes, no server rendering of contract data), so both work.

### 6. Admit the members

From the steward account, `/steward` → *Admit a neighbour*, or in bulk from a CSV of addresses:

```bash
cast send <TOOLSHED> "admitMembers(address[])" "[0xabc…,0xdef…]" \
  --account <your-keystore> --rpc-url https://mainnet.base.org
```

Roughly 300 members is one or two batched transactions.

---

## Configuration reference

| Variable | Where | What it does |
|---|---|---|
| `STEWARD_ADDRESS` | `packages/foundry/.env` | Roster keeper / dispute arbiter. Use a Safe. Defaults to the deployer. |
| `USDC_ADDRESS` | `packages/foundry/.env` | Override the deposit token on an unknown chain. |
| `BASE_RPC_URL` | `packages/foundry/.env` | RPC for the fork test. Defaults to `https://mainnet.base.org`. |
| `NEXT_PUBLIC_IPFS_API_URL` | `packages/nextjs/.env.local` | Kubo RPC endpoint. Unset → inline `data:` URIs and pasted photo links. |
| `NEXT_PUBLIC_IPFS_GATEWAY` | `packages/nextjs/.env.local` | Gateway for reading `ipfs://` URIs. Defaults to `https://ipfs.io/ipfs/`. |
| `NEXT_PUBLIC_FOUNDRY_RPC_URL` | `packages/nextjs/.env.local` | Local fork RPC when 8545 is taken. |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | `packages/nextjs/.env.local` | Your own RPC key for live networks. |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | `packages/nextjs/.env.local` | Your own WalletConnect project. |

Contract constants, if the association wants different house rules (they're `constant`, so
changing them means a new deployment): `REQUEST_EXPIRY` 3 days, `RETURN_CONFIRM_WINDOW` 3 days,
`DEFAULT_GRACE` 30 days, `MAX_LOAN_DAYS` 60, `MAX_OPEN_BORROWS` 5. If you change them, change
the mirrored values in `packages/nextjs/utils/toolshed/loans.ts` too — that's the one place the
frontend duplicates contract logic, so the UI can show a live late-fee figure without a call
per loan.

## Known limitations

Worth knowing before this handles anyone's money:

- **Physical custody can't be proven onchain.** The contract minimises the damage — the clock
  freezes when the borrower declares a return, the owner can dispute, the steward arbitrates,
  and nothing exceeds the deposit — but a determined liar can still cost their neighbour a
  deposit's worth. That's a social problem with a social backstop: the track record and the
  committee.
- **The deposit is the whole remedy.** Price it at replacement cost. A tool worth more than its
  deposit is under-insured by design.
- **USDC is a centralised token.** Circle can freeze an address or pause the token. A frozen
  member can't be paid, but they can't stall anyone else either: their leg is credited and waits
  for `withdrawCredit`, and everybody else settles normally.
- **Request squatting is possible.** A member can keep re-requesting a tool to keep it off the
  shelf. It costs them their own deposit and gas, the owner can decline, and the steward can
  remove them — but there's no automatic defence.
- **No notifications.** Nothing reminds a borrower that a tool is due tomorrow. The onchain
  events (`LoanApproved`, `ReturnDeclared`, `LoanSettled`, …) are there if you want to build one.
- **No indexer.** Each screen reads the full tool, loan and member lists in one call, which is
  fine at a few hundred of each and would need The Graph or Ponder at ten thousand.
- **Not professionally audited.** It went through an independent adversarial review during
  development, which found and fixed two theft paths (the free-loan and dispute-spam ones above)
  and the payout wedge; it's fuzzed, fork-tested and Slither-clean. That is not the same as a
  paid audit. Get one before the shed is holding serious money.
