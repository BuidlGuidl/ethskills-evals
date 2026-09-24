// Aave V3 Pool + native USDC per chain, for the idle-USDC supply() call.
// Every address checked on-chain on 2026-09-21: PoolAddressesProvider.getPool() returns the pool,
// and pool.getReserveData(usdc) returns a live USDC aToken. Re-check before moving real funds.
// USDC is Circle's native token everywhere; the bridged USDC.e / USDbC versions are deliberately not used.

export type ChainConfig = {
  chainId: number;
  aavePool: `0x${string}`;
  usdc: `0x${string}`;
  usdcDecimals: number;
};

export const chains = {
  mainnet: {
    chainId: 1,
    // Aave address book AaveV3Ethereum.POOL (Core market); getPool() of provider 0x2f39…4E9e
    aavePool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Circle USDC docs, Ethereum; Aave reserve with aToken aEthUSDC
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdcDecimals: 6,
  },
  arbitrum: {
    chainId: 42161,
    // Aave address book AaveV3Arbitrum.POOL; getPool() of provider 0xa976…3CDb
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle USDC docs, Arbitrum One (native, not USDC.e); Aave reserve with aToken aArbUSDCn
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    usdcDecimals: 6,
  },
  optimism: {
    chainId: 10,
    // Aave address book AaveV3Optimism.POOL; getPool() of provider 0xa976…3CDb
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle USDC docs, OP Mainnet (native, not USDC.e); Aave reserve with aToken aOptUSDCn
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    usdcDecimals: 6,
  },
  base: {
    chainId: 8453,
    // Aave address book AaveV3Base.POOL; getPool() of provider 0xe20f…d64D
    aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    // Circle USDC docs, Base (native, not USDbC); Aave reserve with aToken aBasUSDC
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdcDecimals: 6,
  },
} as const satisfies Record<string, ChainConfig>;

export type ChainName = keyof typeof chains;
