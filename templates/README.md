# Workspace templates

Committed snapshots of generated projects. A task spec's `template:` field copies one into the run workspace. No `.git` and no `node_modules` — the executor runs `yarn install` itself; `yarn.lock` is baked in so dependency resolution stays stable across runs.

## se-2

Scaffold-ETH 2, hardhat flavor (`packages/hardhat` + `packages/nextjs`). Used by frontend-ux-goal-001.

```bash
npx create-eth@latest se-2 --skip-install -s hardhat
cd se-2 && yarn install                     # bakes yarn.lock
rm -rf .git node_modules packages/*/node_modules .yarn/install-state.gz
```

## se-2-foundry

Scaffold-ETH 2, foundry flavor (`packages/foundry` + `packages/nextjs`). Used by frontend-playbook-goal-001. Same recipe with `-s foundry`, plus one extra strip:

```bash
rm -rf packages/foundry/lib/*/.git
```

The lib submodules (forge-std, openzeppelin-contracts, solidity-bytes-utils) become plain dirs — forge reads them as such (`libs = ['lib', 'node_modules']`), and the revs create-eth pinned live in `foundry.lock`.
