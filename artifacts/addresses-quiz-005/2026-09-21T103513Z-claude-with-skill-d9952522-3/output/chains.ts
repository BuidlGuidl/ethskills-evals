// Aave V3 supply config per chain. USDC is issuer-native (Circle) everywhere — not bridged USDC.e / USDbC.
// Verified 2026-09-21: each pool == PoolAddressesProvider.getPool() on its chain, and USDC is in
// pool.getReservesList() with the reserve active, not frozen, not paused.
// Re-check before moving real funds (see bgd-labs/aave-address-book).

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
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // aave-address-book AaveV3Ethereum.POOL; on-chain provider 0x2f39…4E9e getPool()
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // aave-address-book AaveV3Ethereum ASSETS.USDC.UNDERLYING; Circle native USDC
    usdcDecimals: 6,
  },
  arbitrum: {
    chainId: 42161,
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // aave-address-book AaveV3Arbitrum.POOL; on-chain provider 0xa976…3CDb getPool()
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // aave-address-book AaveV3Arbitrum ASSETS.USDCn.UNDERLYING; native USDC, not USDC.e 0xFF97…5CC8
    usdcDecimals: 6,
  },
  optimism: {
    chainId: 10,
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // aave-address-book AaveV3Optimism.POOL; on-chain provider 0xa976…3CDb getPool()
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // aave-address-book AaveV3Optimism ASSETS.USDCn.UNDERLYING; native USDC, not USDC.e 0x7F5c…1607
    usdcDecimals: 6,
  },
  base: {
    chainId: 8453,
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // aave-address-book AaveV3Base.POOL; on-chain provider 0xe20f…d64D getPool()
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // aave-address-book AaveV3Base ASSETS.USDC.UNDERLYING; native USDC, not USDbC
    usdcDecimals: 6,
  },
};
