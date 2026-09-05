/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** TipJar address on the local chain; written by scripts/deploy-local.sh. */
  readonly VITE_TIPJAR_ADDRESS?: string
  /** TipJar address on Base mainnet, if one is ever deployed there. */
  readonly VITE_TIPJAR_ADDRESS_BASE?: string
  /** Token the local jar collects; defaults to Base USDC (present on the fork). */
  readonly VITE_USDC_ADDRESS?: string
  readonly VITE_LOCAL_RPC_URL?: string
  readonly VITE_LOCAL_CHAIN_ID?: string
  /** Local only: unlocked Anvil account to transact as, no browser wallet needed. */
  readonly VITE_DEV_WALLET?: string
  /** Optional: enables the WalletConnect connector. */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
