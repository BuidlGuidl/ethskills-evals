// Aave V3 supply config per chain.
// All addresses verified on-chain 2026-09-21: USDC symbol()/decimals() == "USDC"/6,
// Pool.getReserveData(usdc) returns a live aToken, reserve active / not frozen / not paused.
// USDC = native Circle USDC (not bridged USDC.e) on every L2.

export type ChainConfig = {
  chainId: number;
  aavePool: `0x${string}`;
  usdc: `0x${string}`;
  usdcDecimals: number;
};

export const chains = {
  mainnet: {
    chainId: 1,
    // Aave V3 Pool (Ethereum core market), from Aave address book (@bgd-labs/aave-address-book AaveV3Ethereum.POOL)
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Circle native USDC, from Circle's USDC contract addresses docs (developers.circle.com)
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcDecimals: 6,
  },
  arbitrum: {
    chainId: 42161,
    // Aave V3 Pool, from Aave address book (AaveV3Arbitrum.POOL)
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle native USDC, from Circle's USDC contract addresses docs (not USDC.e 0xFF97...5CC8)
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
  },
  optimism: {
    chainId: 10,
    // Aave V3 Pool, from Aave address book (AaveV3Optimism.POOL)
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle native USDC, from Circle's USDC contract addresses docs (not USDC.e 0x7F5c...31607)
    usdc: "0x0b2C639c533813f4Aa9D7837cAf62653d097Ff85",
    usdcDecimals: 6,
  },
  base: {
    chainId: 8453,
    // Aave V3 Pool, from Aave address book (AaveV3Base.POOL)
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    // Circle native USDC, from Circle's USDC contract addresses docs (not USDbC 0xd9aA...6CA)
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
  },
} as const satisfies Record<string, ChainConfig>;

export type ChainName = keyof typeof chains;
