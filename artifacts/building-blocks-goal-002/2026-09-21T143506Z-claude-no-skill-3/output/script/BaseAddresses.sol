// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Base mainnet (chain id 8453) addresses. Verified on-chain against Aerodrome factory/voter and Chainlink descriptions.
library BaseAddresses {
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;

    address internal constant AERO_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address internal constant AERO_FACTORY = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;
    address internal constant AERO_VOTER = 0x16613524e02ad97eDfeF371bC883F2F5d6C480A5;
    /// vAMM-WETH/USDC pool 0xcDAC0d6c6C59727a65F871236188350531885C43 and its gauge.
    address internal constant WETH_USDC_POOL = 0xcDAC0d6c6C59727a65F871236188350531885C43;
    address internal constant WETH_USDC_GAUGE = 0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025;

    address internal constant CL_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address internal constant CL_USDC_USD = 0x7e860098F58bBFC8648a4311b374B1D669a2bc6B;
    address internal constant CL_AERO_USD = 0x4EC5970fC728C5f65ba413992CD5fF6FD70fcfF0;
    address internal constant CL_SEQUENCER_UPTIME = 0xBCF85224fc0756B9Fa45aA7892530B47e10b6433;

    // Max accepted oracle age = feed heartbeat + buffer. Re-check heartbeats on data.chain.link before deploying.
    uint256 internal constant ETH_MAX_AGE = 1 hours;
    uint256 internal constant USDC_MAX_AGE = 25 hours;
    uint256 internal constant AERO_MAX_AGE = 25 hours;
}
