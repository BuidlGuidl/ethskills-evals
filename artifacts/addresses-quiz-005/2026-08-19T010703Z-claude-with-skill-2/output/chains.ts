// Chain configuration for the "park idle USDC in Aave" feature.
//
// Every address below was verified on-chain against the chain it is listed for
// on 2026-08-19 (mainnet 25785778, arbitrum 496006644, optimism 155751545,
// base 50156260). Verification for each pool/token pair was:
//   - `cast code` non-empty on that chain (not just on mainnet);
//   - pool `ADDRESSES_PROVIDER()` matches the Aave governance provider for the
//     market, and the pool address matches bgd-labs/aave-address-book;
//   - the USDC address appears in that pool's `getReservesList()` and
//     `getReserveAToken(usdc)` returns a live aToken — i.e. this exact token is
//     a listed reserve of this exact pool, which is what `supply()` requires;
//   - reserve config decoded as active=1, frozen=0, paused=0;
//   - USDC identity confirmed via Circle's FiatToken `currency()` == "USD" and
//     a non-zero `masterMinter()`, NOT via `symbol()` — see the note below.
//
// Re-check before moving real funds: whoever runs this did not watch the checks
// above, and Aave reserves can be frozen or paused by governance at any time.
// The cheap pre-flight is `getReserveAToken(usdc)` non-zero plus the
// active/frozen/paused bits, on the chain you are about to transact on.

export type Address = `0x${string}`;

export interface ChainConfig {
  chainId: number;
  /** Aave V3 Pool proxy — the contract `supply()` is called on. */
  aaveV3Pool: Address;
  /** Underlying asset passed to `supply()`. Circle-native USDC, 6 decimals. */
  usdc: Address;
}

export const CHAINS = {
  mainnet: {
    chainId: 1,
    // Aave V3 Ethereum *Core* market Pool proxy; bgd-labs/aave-address-book
    // AaveV3Ethereum.POOL. Mainnet also runs Prime/Lido, EtherFi and Horizon
    // instances on different Pool addresses — Core is the general USDC market.
    aaveV3Pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    // Circle USDC on Ethereum; listed in the Core pool as aEthUSDC.
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  arbitrum: {
    chainId: 42161,
    // Aave V3 Arbitrum Pool proxy; aave-address-book AaveV3Arbitrum.POOL.
    // Shares its address with Optimism (same deterministic deploy) — confirmed
    // present on Arbitrum directly, not assumed from the Optimism entry.
    aaveV3Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    // Circle-NATIVE USDC on Arbitrum; listed as aArbUSDCn. Not the bridged
    // USDC.e 0xFF97…5CC8, which is a separate listed reserve (aArbUSDC) and
    // also reports symbol() == "USDC".
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },
  optimism: {
    chainId: 10,
    // Aave V3 Optimism Pool proxy; aave-address-book AaveV3Optimism.POOL.
    aaveV3Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    // Circle-NATIVE USDC on Optimism; listed as aOptUSDCn. Not the bridged
    // USDC.e 0x7F5c…1607, which is a separate listed reserve (aOptUSDC) and
    // also reports symbol() == "USDC".
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  },
  base: {
    chainId: 8453,
    // Aave V3 Base Pool proxy; aave-address-book AaveV3Base.POOL. Distinct
    // address from the Arbitrum/Optimism pool — do not reuse that one here.
    aaveV3Pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    // Circle-native USDC on Base; listed as aBasUSDC. Not the bridged USDbC
    // 0xd9Aa…b6CA, which is a separate listed reserve.
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
} as const satisfies Record<string, ChainConfig>;

export type SupportedChain = keyof typeof CHAINS;
