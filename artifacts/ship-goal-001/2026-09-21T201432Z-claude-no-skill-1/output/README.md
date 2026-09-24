# Toolshed

A lending library for a neighbourhood association of ~300 members. Members list tools they own, other
members borrow them against a USDC deposit, and a daily late fee comes out of that deposit and goes to the
owner when a tool comes back late. Everyone builds a track record, and the screens sort by it.

Two Solidity contracts hold the roster, the listings and the money. A React app talks to them directly —
there is no backend and no database.

---

## How a loan works

1. **List.** A member lists a tool: name, photo URI, condition notes, the deposit they want held, and the
   late fee per day. `deposit > 0` and `dailyLateFee <= deposit` are enforced on chain.
2. **Request.** Another member asks for it for *N* days (1–90). The deposit is pulled into the contract at
   this moment, so a request is always funded — an owner never hands a tool to someone whose money has
   already moved on. Several people can queue up on the same tool.
3. **Approve.** The owner picks someone and calls `approveRequest`. The clock starts *then*, not at request
   time, and the tool is marked out. Requests the owner turns down (`declineRequest`) or the borrower pulls
   (`cancelRequest`) refund the deposit in full.
4. **Return.** The owner calls `confirmReturn`. Late days are counted from the due date, rounded **up** —
   any part of a day past due is a whole late day. The fee is `lateDays × dailyLateFee`, **capped at the
   deposit**, paid to the owner; the rest goes back to the borrower. The loan is written to both members'
   track records.
5. **Records.** The borrower's `loansBorrowed` goes up, and `lateReturns` too if it came back late. The
   owner's `loansLent` goes up.

Three things make step 4 survive real neighbours:

- **`reportReturn`** — the borrower can stamp "I gave it back" on chain. That freezes the late-fee clock at
  that moment even if the owner takes days to confirm.
- **`finalizeReportedReturn`** — if the owner never confirms, the borrower can close the loan out themselves
  three days after reporting, settling at the reported time. Deposits cannot be held hostage.
- **`claimDefault`** — if the tool is 14 days past due with no return reported, the owner takes the whole
  deposit and the borrower's record takes a `defaults`.

And an escape hatch: the association steward can `settleDispute(loanId, toOwner, countedLate)` on an active
loan, splitting the deposit any way up to its full amount. It is the only discretionary power in the system
and it cannot invent money — the deposit is the ceiling on every payout.

## Track records and sorting

`reliabilityBps` is the share of a member's settled loans that came back on time, in basis points. Someone
with no loans yet scores a neutral 7500 so newcomers are not buried. Defaults count as late returns *and* as
defaults, so "2 loans, 1 late" and "2 loans, 1 never returned" rank the same on the number but read
differently on the card.

Two screens sort by this:

- **Browse** ranks listed tools by their owner's track record (switchable to deposit or recency).
- **My shed** ranks the requests waiting on you by the *borrower's* track record, so the reliable neighbour
  is at the top of the list when you decide who gets the saw.

## Architecture

```
contracts/                    Foundry project
  src/MemberRegistry.sol      roster + track records. Steward curates members; only an authorised
                              "ledger" (the Toolshed contract) can write track records.
  src/Toolshed.sol            tools, loans, USDC escrow, late-fee settlement.
  src/test/MockUSDC.sol       6-decimal ERC-20 for local dev only.
  test/Toolshed.t.sol         26 tests incl. a fuzz test that no settlement invents or loses money.
  script/Deploy.s.sol         deploys + wires both contracts, writes deployments/<chainId>.json.
  script/seed.sh              fills a local anvil with members, tools and loan history.

web/                          Vite + React + TypeScript + wagmi/viem
  src/lib/config.ts           chain + contract addresses from env
  src/lib/data.ts             reads the whole shed in three calls, derives everything else
  src/lib/tx.ts               one send-and-wait helper + human-readable contract errors
  src/components/             Browse, MyShed, MyLoans, Members
  src/abis/                   generated from the Foundry build by scripts/sync-abis.mjs
```

**Why no backend.** At 300 members the entire state is small: a few hundred tools, a few thousand loans.
The frontend pulls it with three `eth_call`s — `getTools`, `getLoans`, `getMembers` — and does the sorting
and filtering in memory. That removes a server, a database and a sync problem from a v1 that does not need
them. Every state-changing call emits an event, so when the association outgrows this (see *Limits*), an
indexer can be dropped in front without touching the contracts.

**Why the registry is separate.** Membership and reputation outlive any one version of the lending logic. If
Toolshed v2 ships, the steward authorises the new contract as a ledger, revokes the old one, and 300
members' track records carry over.

**Money.** USDC only, 6 decimals, pulled with `SafeERC20`. The contract never holds more than the sum of
open deposits and always pays out exactly the deposit it took in: `lateFee + refund == deposit`, with
`lateFee` capped at the deposit. There is no protocol fee and no admin withdrawal.

## Running it locally

Prerequisites: [Foundry](https://getfoundry.sh), Node 20+, and a browser wallet (MetaMask or similar).

```bash
# 1. Contracts
cd contracts
forge install            # only needed on a fresh clone
forge test               # 26 tests should pass

# 2. Local chain
anvil                    # leave running in its own terminal (http://127.0.0.1:8545)

# 3. Deploy (anvil account #0; with no USDC_ADDRESS set it also deploys MockUSDC)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# addresses are printed and written to contracts/deployments/31337.json

# 4. Seed a neighbourhood: 5 members, 7 tools, 16 loans of history, 2 open requests, 1 overdue loan
./script/seed.sh

# 5. Frontend
cd ../web
npm install
cp .env.example .env      # paste the addresses from deployments/31337.json
npm run dev               # http://localhost:5173
```

In your wallet: add a network on `http://127.0.0.1:8545` with chain id `31337`, then import anvil accounts
**#1–#5** — those are the seeded members (account #0 is the steward, and sees the "add a member" panel on
the Members tab). Each seeded member holds 2,000 mock USDC.

The seed script leaves the shed in a state worth looking at: Ana is 4-for-4 on time, Tom has 6 loans with 2
late, Dev is 0-for-1, one pressure washer is overdue and accruing, and two neighbours are queued on the same
circular saw so you can see the request ranking.

After editing anything in `contracts/src`, run `npm run sync-abis` in `web/` to refresh `src/abis`.

## Deploying for real

The app is chain-agnostic; it has been built for an L2 where a $3 late fee is not eaten by gas. Base or
Base Sepolia are the obvious choices.

```bash
cd contracts
export PRIVATE_KEY=0x...                               # deployer
export STEWARD=0x...                                   # association steward (roster + disputes)
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # native USDC on Base mainnet
                                                       # Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e

forge script script/Deploy.s.sol \
  --rpc-url $BASE_RPC_URL --broadcast \
  --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

The script deploys `MemberRegistry` and `Toolshed`, authorises Toolshed as the registry's ledger, hands the
steward role over if `STEWARD` differs from the deployer, and writes `deployments/<chainId>.json`. It
refuses to deploy MockUSDC anywhere but chain 31337.

Then:

1. **Add the roster.** As the steward, call `addMembers(address[], string[])` — one transaction for ~50
   members at a time is comfortable. The Members tab has a single-member form for the steward; for the
   initial 300, script it with `cast send`.
2. **Point the frontend at it.** In `web/`, set `VITE_CHAIN_ID`, `VITE_RPC_URL` and the three addresses,
   then `npm run build`. The output in `web/dist` is a static bundle — any static host (Vercel, Netlify,
   Cloudflare Pages, S3) works. There is nothing to run server-side.
3. **Photos.** Tools store a photo *URI*, not an image. `ipfs://<cid>` is resolved through a public gateway;
   an `https://` URL also works. For v1 the association pins photos itself (Pinata, web3.storage, or the
   association's own web host) and members paste the URI. A direct upload widget is the obvious next
   addition.

### Checklist before letting neighbours in

- Confirm `usdc()` on the deployed Toolshed is the real USDC for that chain — the address is immutable, a
  wrong one means redeploying.
- Confirm `registry.isLedger(toolshed)` is true and `registry.steward()` is the account the association
  actually controls (ideally a multisig — it is the dispute arbiter and roster admin).
- Send a member 1 USDC and walk one loan end to end on the real chain before onboarding everyone.

## Tests

```bash
cd contracts && forge test -vv
```

26 tests cover the happy path, every refund path, late-fee rounding and capping, the reported-return clock
freeze, the borrower's escape after the confirmation window, defaults, disputes, access control, and
re-adding a removed member. The fuzz test asserts that for any loan length, lateness and fee schedule,
`lateFee + refund == deposit` and the contract ends holding nothing.

## Limits worth knowing about

- **Reads do not paginate in the UI.** `getTools`/`getLoans`/`getMembers` are paginated on chain, but the
  app asks for the first 1,000 tools, 5,000 loans and 1,000 members in one go. That covers a 300-member
  association for years. The fix when it bites is an indexer over the events, not a contract change.
- **The steward is trusted.** They add and remove members and can split a disputed deposit. They cannot
  touch a deposit that is not in dispute, mint anything, or edit a track record. Use a multisig.
- **Removing a member** stops them requesting or being handed new tools; an in-flight loan still settles
  normally, and their escrowed deposit is always refundable.
- **Late fees accrue whether or not anyone acts.** A forgetful owner who never confirms a return does not
  cost the borrower more than the reported time — but only if the borrower calls `reportReturn`. That
  button is the borrower's protection and the UI pushes it hard.
- **Names and addresses are public.** The roster is on chain: display names are visible to anyone. Use
  "Marisol (12 Oak)" only if the association is comfortable with that; addresses alone also work.
- **USDC is upgradeable and has a blocklist.** A blocked borrower's refund would revert; the steward's
  `settleDispute` can route the remainder to the owner, but there is no perfect answer to that outside of
  changing token.
