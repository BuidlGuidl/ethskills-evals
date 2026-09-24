// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

type Currency is address;
type PoolId is bytes32;
type BeforeSwapDelta is int256;

interface IHooksLike {}

struct PoolKey {
    Currency currency0;
    Currency currency1;
    uint24 fee;
    int24 tickSpacing;
    IHooksLike hooks;
}

struct SwapParams {
    bool zeroForOne;
    int256 amountSpecified;
    uint160 sqrtPriceLimitX96;
}

library PoolIdLibrary {
    function toId(PoolKey memory poolKey) internal pure returns (PoolId) {
        return PoolId.wrap(keccak256(abi.encode(poolKey)));
    }

    function toIdCalldata(PoolKey calldata poolKey) internal pure returns (PoolId) {
        return PoolId.wrap(keccak256(abi.encode(poolKey)));
    }
}

library BeforeSwapDeltaLibrary {
    BeforeSwapDelta internal constant ZERO_DELTA = BeforeSwapDelta.wrap(0);
}

library LPFeeLibrary {
    uint24 internal constant DYNAMIC_FEE_FLAG = 0x800000;
    uint24 internal constant OVERRIDE_FEE_FLAG = 0x400000;
    uint24 internal constant MAX_LP_FEE = 1_000_000;

    function isDynamicFee(uint24 fee) internal pure returns (bool) {
        return fee == DYNAMIC_FEE_FLAG;
    }

    function isValid(uint24 fee) internal pure returns (bool) {
        return fee <= MAX_LP_FEE;
    }
}

library HookFlags {
    uint160 internal constant BEFORE_SWAP_FLAG = 1 << 7;
}
