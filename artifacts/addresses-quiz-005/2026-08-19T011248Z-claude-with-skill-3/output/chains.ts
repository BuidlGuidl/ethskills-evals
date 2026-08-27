/**
 * Aave V3 supply targets for the "park idle USDC" feature.
 *
 * Every address below was checked on 2026-08-18 against two sources: the Aave
 * address book (github.com/bgd-labs/aave-address-book, the generated `src/AaveV3*.sol`
 * files) and a live `cast` call on the chain in question. The checks were:
 *   - pool: has bytecode, and `ADDRESSES_PROVIDER()` returns the market's provider
 *     from the address book (so it is that chain's V3 pool, not a lookalike).
 *   - usdc: appears in `POOL.getReservesList()`, `decimals() == 6`, and the reserve
 *     is active / not frozen / not paused per the market's ProtocolDataProvider.
 *
 * Two things to know before this moves real money:
 *  1. Each chain's USDC is Circle-issued native USDC, NOT the bridged token. The
 *     bridged ones are also listed Aave reserves and several still report the
 *     symbol "USDC", so symbol alone does not tell them apart. See per-chain notes.
 *  2. Aave supply caps are real and close-ish on the smaller markets (Optimism's
 *     USDC cap was 28.0M with 11.4M supplied on 2026-08-18). A supply() past the
 *     cap reverts with error 51 (SUPPLY_CAP_EXCEEDED) — handle it rather than
 *     assuming a supply always succeeds.
 */

export interface ChainConfig {
  chainId: number;
  /** Aave V3 Pool — target of supply(asset, amount, onBehalfOf, referralCode). */
  aaveV3Pool: `0x${string}`;
  /** Native USDC (6 decimals) — the `asset` argument, and the approve() target. */
  usdc: `0x${string}`;
}

export const CHAINS = {
  mainnet: {
    chainId: 1,
    // Aave V3 Ethereum "Core" market Pool — aave-address-book AaveV3Ethereum.POOL; verified on-chain, ADDRESSES_PROVIDER() == 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e.
    // Note: Aave also runs separate mainnet V3 markets (Prime/Lido 0x4e03…58B1, EtherFi 0x0AA9…F3c0) — this is deliberately the Core market, where USDC liquidity is.
    aaveV3Pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    // Circle USDC (native issuance) — circle.com/usdc contract list; confirmed as a listed Core reserve, decimals 6, currency() == "USD".
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },

  arbitrum: {
    chainId: 42161,
    // Aave V3 Arbitrum Pool — aave-address-book AaveV3Arbitrum.POOL; verified on Arbitrum One, ADDRESSES_PROVIDER() == 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb.
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle-issued native USDC on Arbitrum — Circle docs; listed Aave reserve, decimals 6, currency() == "USD".
    // NOT 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8 — that is bridged USDC.e (name "USD Coin (Arb1)"), which is also an Aave reserve and also reports symbol "USDC".
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },

  optimism: {
    chainId: 10,
    // Aave V3 Optimism Pool — aave-address-book AaveV3Optimism.POOL; verified on OP Mainnet, ADDRESSES_PROVIDER() == 0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb.
    // Same address as Arbitrum by deterministic deployment — that is a coincidence of the deploy process, not a rule; Base is different (below).
    aaveV3Pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    // Circle-issued native USDC on OP Mainnet — Circle docs; listed Aave reserve, decimals 6, currency() == "USD".
    // NOT 0x7F5c764cBc14f9669B88837ca1490cCa17c31607 — that is the bridged token (l1Token() == mainnet USDC), still listed in Aave and still reporting symbol "USDC".
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },

  base: {
    chainId: 8453,
    // Aave V3 Base Pool — aave-address-book AaveV3Base.POOL; verified on Base, ADDRESSES_PROVIDER() == 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D.
    // Distinct from the Arbitrum/Optimism pool address; 0x794a61…14aD has no bytecode on Base, so reusing it here would send funds to a dead address.
    aaveV3Pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    // Circle-issued native USDC on Base — Circle docs; listed Aave reserve, decimals 6, currency() == "USD".
    // NOT 0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA — that is bridged USDbC ("USD Base Coin"), a separate and much shallower Aave reserve.
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
} as const satisfies Record<string, ChainConfig>;

export type SupportedChain = keyof typeof CHAINS;

export const isSupportedChain = (name: string): name is SupportedChain => name in CHAINS;
