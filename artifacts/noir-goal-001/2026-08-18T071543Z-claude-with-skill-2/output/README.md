# Anonymous DAO voting (Noir + Foundry)

Yes/no governance votes for a DAO whose membership is public, where the tally is
public but no ballot can be attributed to a member.

**Read [NOTES.md](./NOTES.md)** — it walks one member through one proposal and
names, for every transaction, which wallet sends it and what a chain observer
learns.

## Layout

```
circuits/vote/          Noir circuit (membership + nullifier + ballot)
src/                    Solidity contracts
  verifiers/            generated HonkVerifier — do not hand-edit
script/Deploy.s.sol     deploys and wires everything
test/                   Foundry tests, incl. real proofs against the real verifier
client/                 Node: secret -> identity -> proof -> vote tx
scripts/                setup.sh, build-circuit.sh, deploy-local.sh
lib/                    forge-std + OpenZeppelin (restore with ./scripts/setup.sh)
vendor/                 LeanIMT + Poseidon, vendored (see vendor/README.md)
```

## Requirements

`nargo` 1.0.0-beta.26, `bb` 5.1.0, Foundry, Node 20+.
`@aztec/bb.js` and `@noir-lang/noir_js` in `package.json` are pinned to match
those two binaries exactly — a version drift changes proof serialisation and the
deployed verifier starts rejecting valid proofs.

## Quick start

```bash
./scripts/setup.sh           # forge install + npm install + forge build
forge test

anvil                        # terminal 1
./scripts/deploy-local.sh    # terminal 2
node client/demo.mjs         # members join, a proposal opens
npm run vote                 # one member casts an anonymous ballot
node client/demo.mjs tally 0
```

See NOTES.md §6 for the full loop including circuit rebuilds.
