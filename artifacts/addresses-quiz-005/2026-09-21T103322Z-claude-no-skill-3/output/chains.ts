// Aave V3 supply config per chain. Checked on-chain 2026-09-21: every USDC reserve active, not frozen, not paused.
// USDC is native (Circle-issued) on every chain, not bridged USDC.e.

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
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // bgd-labs/aave-address-book AaveV3Ethereum.POOL
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // bgd-labs/aave-address-book AaveV3Ethereum.ASSETS.USDC.UNDERLYING
    usdcDecimals: 6,
  },
  arbitrum: {
    chainId: 42161,
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // bgd-labs/aave-address-book AaveV3Arbitrum.POOL
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // bgd-labs/aave-address-book AaveV3Arbitrum.ASSETS.USDCn.UNDERLYING (native, not USDC.e)
    usdcDecimals: 6,
  },
  optimism: {
    chainId: 10,
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // bgd-labs/aave-address-book AaveV3Optimism.POOL
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // bgd-labs/aave-address-book AaveV3Optimism.ASSETS.USDCn.UNDERLYING (native, not USDC.e)
    usdcDecimals: 6,
  },
  base: {
    chainId: 8453,
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // bgd-labs/aave-address-book AaveV3Base.POOL
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // bgd-labs/aave-address-book AaveV3Base.ASSETS.USDC.UNDERLYING
    usdcDecimals: 6,
  },
};
