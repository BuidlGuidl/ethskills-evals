// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Base mainnet (chain 8453). All verified onchain 2026-09-21 (symbol/token0/gauge/description calls).
library BaseAddresses {
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;

    address internal constant AERO_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address internal constant AERO_POOL_FACTORY = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;
    address internal constant AERO_VOTER = 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5;

    address internal constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address internal constant CHAINLINK_SEQUENCER_UPTIME = 0xBCF85224fc0756B9Fa45aA7892530B47e10b6433;
}
