# Anonymous DAO ballots

Yes/no governance votes for a DAO whose membership is public, where nobody —
including the DAO — can tell how any individual member voted.

**Read [NOTES.md](NOTES.md)** for the end-to-end flow, what each on-chain
transaction reveals, the design reasoning, and the honest list of what is *not*
hidden.

```bash
npm install
./scripts/build-circuits.sh
(cd contracts && forge build && forge test)
(cd circuits && nargo test)

anvil                    # in another terminal
./scripts/demo-local.sh  # deploy -> join -> propose -> vote -> tally
```

```
circuits/     Noir: dao_zk (shared), join, vote
contracts/    Foundry: MemberRegistry, PrivateBallot, generated Honk verifiers
scripts/      build, deploy, and the member-facing Node scripts
```
