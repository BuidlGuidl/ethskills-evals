// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BaseDeployConfig {
    uint256 internal constant BASE_CHAIN_ID = 8453;

    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;

    address internal constant UNISWAP_V3_SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address internal constant UNISWAP_V3_POSITION_MANAGER =
        0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1;

    uint24 internal constant USDC_WETH_POOL_FEE = 500;
    int24 internal constant FULL_RANGE_TICK_LOWER = -887270;
    int24 internal constant FULL_RANGE_TICK_UPPER = 887270;
}
