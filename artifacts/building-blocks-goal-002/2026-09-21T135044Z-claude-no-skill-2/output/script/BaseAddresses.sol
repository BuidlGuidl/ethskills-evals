// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AerodromeUsdcVault} from "../src/AerodromeUsdcVault.sol";

/// @notice Base mainnet (chainId 8453) addresses. Verified onchain 2026-09-21 (block ~51.6M):
///         router.poolFor(WETH, USDC, false) == POOL, voter.gauges(POOL) == GAUGE (alive),
///         gauge.rewardToken() == AERO, factory fee = 30 bps, feeds report "ETH / USD", "USDC / USD".
library BaseAddresses {
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;

    address internal constant AERODROME_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address internal constant AERODROME_VOTER = 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5;
    address internal constant POOL_WETH_USDC = 0xcDAC0d6c6C59727a65F871236188350531885C43; // vAMM-WETH/USDC
    address internal constant GAUGE_WETH_USDC = 0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025;

    address internal constant CL_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70; // heartbeat 20 min
    address internal constant CL_USDC_USD = 0x7e860098F58bBFC8648a4311b374B1D669a2bc6B; // heartbeat 24 h
    address internal constant CL_SEQUENCER_UPTIME = 0xBCF85224fc0756B9Fa45aA7892530B47e10b6433;

    function vaultConfig(address keeper, address feeRecipient)
        internal
        pure
        returns (AerodromeUsdcVault.Config memory)
    {
        return AerodromeUsdcVault.Config({
            usdc: USDC,
            weth: WETH,
            aero: AERO,
            router: AERODROME_ROUTER,
            pool: POOL_WETH_USDC,
            gauge: GAUGE_WETH_USDC,
            ethUsdFeed: CL_ETH_USD,
            usdcUsdFeed: CL_USDC_USD,
            sequencerUptimeFeed: CL_SEQUENCER_UPTIME,
            ethFeedMaxAge: 1 hours,
            usdcFeedMaxAge: 25 hours,
            keeper: keeper,
            feeRecipient: feeRecipient
        });
    }
}
