#!/usr/bin/env bash
# Restore everything a fresh clone needs. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

# lib/ holds third-party Foundry deps; vendor/ holds the two that forge cannot
# fetch (see vendor/README.md) and is checked in.
[ -d lib/forge-std ] || forge install --no-git --shallow foundry-rs/forge-std@v1.9.6
[ -d lib/openzeppelin-contracts ] || forge install --no-git --shallow OpenZeppelin/openzeppelin-contracts@v5.1.0

npm install
forge build
echo "ready: run 'forge test', then see NOTES.md §6 for the local demo"
