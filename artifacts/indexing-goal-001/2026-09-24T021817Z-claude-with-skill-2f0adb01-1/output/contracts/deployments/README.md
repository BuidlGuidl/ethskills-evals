# Deployments

One file per network, `<network>.json`, recording the contract address and —
critically — the **block it was deployed in**.

`scripts/configure-subgraph.mjs <network>` reads these and writes them into
`subgraph/subgraph.yaml`. The `startBlock` is what makes the indexer replay the
contract's complete history; set it later than the real deployment block and the
feed, streaks and leaderboard silently lose everything before it.

`forge script script/Deploy.s.sol` prints both values. `local.json` is written by
`scripts/seed-local.sh` and is gitignored; real networks should be committed.
