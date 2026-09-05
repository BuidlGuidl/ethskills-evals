# USDC Tip Jar

A tip jar for Base that accepts USDC tips with a message, plus a web app with the tip feed, a tip
form and a wallet connect flow. The project lives in [`usdc-tip-jar/`](./usdc-tip-jar) — see
[`usdc-tip-jar/README.md`](./usdc-tip-jar/README.md) for the full setup, contract reference and
troubleshooting.

It runs entirely locally against a fork of Base, so tips move the real Circle USDC contract at
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. Nothing is deployed to a live network.

## Quick start

Requires Node >= 20.18.3, Yarn and [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
cd usdc-tip-jar
yarn install

yarn fork --network base   # terminal 1 — local fork of Base on :8545 (chain ID 31337)
yarn deploy                # terminal 2 — deploy TipJar, wire up the frontend ABIs
yarn start                 # terminal 3 — http://localhost:3000
```

Then, to actually send a tip: click the 💵 button in the header for gas, copy your address, run
`yarn fund-usdc 0xYourAddress` for USDC, and use the form on the page.

Run `yarn test` for the contract test suite.
