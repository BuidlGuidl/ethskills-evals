# Toolshed contracts

Foundry project for `src/Toolshed.sol`. See the [root README](../../README.md) for the
architecture, the deposit/late-fee mechanism and deployment steps.

```bash
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0  # populates lib/
forge build
forge test -vv
```

- `src/Toolshed.sol` — the contract
- `test/Toolshed.t.sol` — unit, state-machine and fuzz tests
- `test/mocks/MockUSDC.sol` — 6-decimal USDC stand-in
- `script/Deploy.s.sol` — deploy to any chain (mock USDC on chain 31337)
- `script/SeedLocal.s.sol` + `script/seed-local.sh` — local demo data
