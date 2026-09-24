// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title Multicall3Local
/// @notice A minimal, `aggregate3`-compatible stand-in for Multicall3, used only
///         for local development. Base (and every network the app targets) has
///         the real Multicall3 at 0xcA11bde05977b3631167028862bE2a173976CA11; a
///         bare `anvil` has nothing there, which makes viem's batched reads fail.
///         `scripts/seed-local.sh` deploys this and installs its code at the
///         canonical address via `anvil_setCode`, so local dev behaves like Base.
/// @dev Not deployed to any real network. See https://github.com/mds1/multicall
///      for the canonical implementation.
contract Multicall3Local {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData) {
        uint256 length = calls.length;
        returnData = new Result[](length);
        for (uint256 i = 0; i < length; i++) {
            Call3 calldata call = calls[i];
            (bool success, bytes memory data) = call.target.call(call.callData);
            if (!success && !call.allowFailure) {
                // Bubble the revert reason up, as Multicall3 does.
                if (data.length == 0) revert("Multicall3: call failed");
                assembly {
                    revert(add(data, 0x20), mload(data))
                }
            }
            returnData[i] = Result(success, data);
        }
    }
}
