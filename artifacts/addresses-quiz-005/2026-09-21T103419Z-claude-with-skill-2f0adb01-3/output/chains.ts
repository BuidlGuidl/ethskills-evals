// Aave V3 supply config per chain.
// Checked on-chain 2026-09-21 on every chain: PoolAddressesProvider.getPool() == aavePool,
// USDC is in pool.getReservesList(), and the reserve is active, not frozen, not paused.
// USDC is Circle's native USDC on every chain. Do not use bridged USDC.e.

export type ChainKey = "mainnet" | "arbitrum" | "optimism" | "base";

export interface ChainConfig {
  chainId: number;
  aavePool: `0x${string}`;
  usdc: `0x${string}`;
  usdcDecimals: 6;
}

export const chains: Record<ChainKey, ChainConfig> = {
  mainnet: {
    chainId: 1,
    // Aave V3 Pool: Aave docs; matches getPool() on PoolAddressesProvider 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Native USDC: Circle docs; symbol() == "USDC" on-chain
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcDecimals: 6,
  },
  arbitrum: {
    chainId: 42161,
    // Aave V3 Pool: Aave docs; matches getPool() on PoolAddressesProvider 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Native USDC: Circle docs; symbol() == "USDC" on-chain (not USDC.e 0xFF970A61...)
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
  },
  optimism: {
    chainId: 10,
    // Aave V3 Pool: Aave docs; matches getPool() on PoolAddressesProvider 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Native USDC: Circle docs; symbol() == "USDC" on-chain (not USDC.e 0x7F5c764c...)
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdcDecimals: 6,
  },
  base: {
    chainId: 8453,
    // Aave V3 Pool: Aave docs; matches getPool() on PoolAddressesProvider 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    // Native USDC: Circle docs; symbol() == "USDC" on-chain (not USDbC 0xd9aAEc86...)
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
  },
};
