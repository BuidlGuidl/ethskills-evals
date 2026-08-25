# Recommendation

Do not build a subgraph for this panel. The product asks for current contract state for one known wallet and a fixed list of 40 tokens. Indexing every transfer for every holder creates deployment, backfill, monitoring, reorg, and synchronization work without serving a historical or cross-wallet query.

The claim that the indexed balances would therefore be "always accurate" is also too strong. A subgraph can lag the chain, fail or pause, and expose data from a block behind the RPC head. Reconstructing balances from `Transfer` events additionally assumes each supported token's balance changes are completely represented by standard events; unusual implementations such as rebasing tokens can violate that assumption. The ERC-20 contract's `balanceOf` is the authoritative current value.

# Implementation

On opening the panel, call `balanceOf(connectedWallet)` on each of the 40 configured token contracts through a Multicall contract on Base (for example, Multicall3 `aggregate3`). Encode 40 independent `balanceOf` subcalls, execute the batch at the `latest` block tag, and decode the 40 returned `uint256` values. Use the configured token decimals to format them; token addresses and decimals can be maintained with the supported-token configuration rather than discovered on every open.

This takes **one onchain read/RPC `eth_call` for all 40 balances**, containing **40 internal read subcalls** executed by Multicall. It is not 40 separate client-to-RPC round trips. `aggregate3` can allow individual failures so one broken token does not hide the other 39, although failures should be surfaced rather than displayed as zero.

The result is a consistent snapshot because all 40 subcalls execute against the same block. When the user reopens the panel, issue the multicall again with `latest`; the EVM evaluates each token's current `balanceOf`, so transfers, mints, burns, and any other contract-defined balance changes since the previous read are naturally reflected. Do not treat the prior response as permanently valid: key any short-lived cache by chain, wallet, and block number, or simply refetch on open as required. Also refetch after an in-app transaction confirms, and discard an in-flight response if the wallet or chain changes.

A subgraph becomes justified later if the product needs transaction history, time-series balances, P&L inputs, holder-wide searches/rankings, or other event-derived queries. None of those are part of this panel.
