// Aave V3 supply config per chain. USDC = issuer-native (Circle) USDC, not bridged USDC.e / USDbC.
// All addresses checked on-chain 2026-09-21: pool == PoolAddressesProvider.getPool(), USDC is in
// pool.getReservesList() and its reserve is active, not frozen, not paused.
// Re-check before moving real funds — Aave governance can migrate pools or freeze reserves.

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
    // Aave docs + address-book (AaveV3Ethereum.POOL); confirmed via provider 0x2f39…4E9e getPool() on mainnet
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Circle USDC docs (Ethereum); confirmed symbol()=USDC and listed in Aave pool reserves on mainnet
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcDecimals: 6,
  },
  arbitrum: {
    chainId: 42161,
    // Aave docs + address-book (AaveV3Arbitrum.POOL); confirmed via provider 0xa976…3CDb getPool() on Arbitrum
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle USDC docs (Arbitrum native, not USDC.e 0xFF97…5CC8); confirmed symbol()=USDC and in Aave reserves
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
  },
  optimism: {
    chainId: 10,
    // Aave docs + address-book (AaveV3Optimism.POOL); confirmed via provider 0xa976…3CDb getPool() on Optimism
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle USDC docs (OP native, not USDC.e 0x7F5c…2e8a7); confirmed symbol()=USDC and in Aave reserves
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdcDecimals: 6,
  },
  base: {
    chainId: 8453,
    // Aave docs + address-book (AaveV3Base.POOL); confirmed via provider 0xe20f…d64D getPool() on Base
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    // Circle USDC docs (Base native, not USDbC 0xd9aA…6CA); confirmed symbol()=USDC and in Aave reserves
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
  },
};
