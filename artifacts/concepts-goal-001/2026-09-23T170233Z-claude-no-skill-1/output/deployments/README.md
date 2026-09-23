# Deployments

One JSON record per chain, written by `script/Deploy.s.sol` and committed.
The ops scripts and the backend resolve the contract address from here, so it is
never copy-pasted between a terminal and a config file.

Local (`anvil.json`) is gitignored — recreate it with `make deploy-local`.
