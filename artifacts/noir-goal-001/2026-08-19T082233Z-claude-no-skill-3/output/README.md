# dao-private-vote

Yes/no governance votes for a DAO whose membership is public, where nobody — including
the DAO — can tell how any individual member voted.

Membership NFT holders each put one commitment into an on-chain Merkle tree. To vote they
prove in zero knowledge that they know the secret behind *some* leaf of the snapshot the
proposal was created against, and publish a nullifier derived from that secret and the
proposal. The nullifier stops a second ballot; nothing about it points back at a leaf. The
transaction is sent by a relayer, never by the voter's own wallet.

**Read [NOTES.md](NOTES.md)** for the end-to-end walkthrough: every transaction, who sends
it, and exactly what a chain observer learns from it.

## Layout

    circuits/vote/          the ballot circuit (Noir)
    src/                    contracts: MembershipRegistry, PrivateBallot, generated HonkVerifier
    script/Deploy.s.sol     deploys everything and wires it together
    test/                   Solidity tests, incl. a real proof replayed against the real verifier
    js/                     a member's client: secret -> commitment -> proof -> relayed vote
    scripts/                build the circuit, deploy locally, run the whole demo

## Requirements

`nargo` 1.0.0-beta.26, `bb` 5.1.0, foundry, node 20+.

## Quickstart

    ./scripts/build-circuit.sh    # circuit tests, compile, regenerate the verifier, forge test
    npm install
    anvil                         # in another terminal
    ./scripts/demo-local.sh       # deploy, five members join, one proposal, two ballots, the tally

## Tests

    forge test          # contracts, tree, and one real proof end to end
    (cd circuits/vote && nargo test)
