// Aave V3 Pool + native USDC per chain, for Pool.supply(usdc, amount, onBehalfOf, 0).
// All addresses checked onchain 2026-09-21: PoolAddressesProvider.getPool() == pool,
// USDC symbol/decimals == "USDC"/6, USDC reserve active and not frozen/paused.

export type ChainKey = "mainnet" | "arbitrum" | "optimism" | "base";

export interface ChainConfig {
  chainId: number;
  aavePool: `0x${string}`;
  usdc: `0x${string}`;
  usdcDecimals: number;
}

export const chains: Record<ChainKey, ChainConfig> = {
  mainnet: {
    chainId: 1,
    // Aave address book (AaveV3Ethereum.POOL); confirmed via PoolAddressesProvider 0x2f39…4E9e getPool()
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Circle native USDC on Ethereum (Circle docs); confirmed as active Aave reserve
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcDecimals: 6,
  },
  arbitrum: {
    chainId: 42161,
    // Aave address book (AaveV3Arbitrum.POOL); confirmed via PoolAddressesProvider 0xa976…3CDb getPool()
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle native USDC on Arbitrum (Circle docs; not bridged USDC.e 0xFF97…5CC8); confirmed as active Aave reserve
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
  },
  optimism: {
    chainId: 10,
    // Aave address book (AaveV3Optimism.POOL); confirmed via PoolAddressesProvider 0xa976…3CDb getPool()
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle native USDC on OP Mainnet (Circle docs; not bridged USDC.e 0x7F5c…2e607); confirmed as active Aave reserve
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdcDecimals: 6,
  },
  base: {
    chainId: 8453,
    // Aave address book (AaveV3Base.POOL); confirmed via PoolAddressesProvider 0xe20f…d64D getPool()
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    // Circle native USDC on Base (Circle docs; not USDbC 0xd9aA…6CA); confirmed as active Aave reserve
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
  },
};
