// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { console2 } from "forge-std/console2.sol";
import { Vm } from "forge-std/Vm.sol";
import { Disburser } from "../src/Disburser.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Runs only with --fork-url (Base mainnet). Measures Disburser
///         batching cost against real USDC. The test contract acts as the
///         relayer (vm.prank is not used: pranked state calls on forks revert).
contract DisburserForkTest is Test {
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    Disburser public disburser;
    address public relayer;

    function setUp() public {
        if (block.chainid == 31337) {
            vm.skip(true, "fork only");
            return;
        }
        disburser = new Disburser();
        relayer = address(this);
        deal(BASE_USDC, relayer, 1_000_000_000e6);
        IERC20(BASE_USDC).approve(address(disburser), type(uint256).max);
    }

    function _recipient(uint256 i) internal pure returns (address) {
        return address(uint160(0x20000 + i));
    }

    function _packed(uint256 n, uint256 amount) internal pure returns (bytes memory) {
        bytes memory out = new bytes(n * 32);
        for (uint256 i = 0; i < n; i++) {
            bytes32 c = bytes32(abi.encodePacked(_recipient(i), uint96(amount)));
            assembly {
                mstore(add(add(out, 32), mul(i, 32)), c)
            }
        }
        return out;
    }

    function _batchGas(uint256 n) internal returns (uint256) {
        bytes memory packed = _packed(n, 1_000_000);
        uint256 g0 = gasleft();
        disburser.disburseFrom(BASE_USDC, packed, false);
        uint256 used = g0 - gasleft();
        assertEq(IERC20(BASE_USDC).balanceOf(address(disburser)), 0);
        return used;
    }

    function test_ForkRealUSDCBatchGas() public {
        bytes32 failedTopic = keccak256("TransferFailed(address,uint256,address,uint256)");

        uint256 coldSingle = _batchGas(1);
        bytes memory packed250 = _packed(250, 1_000_000);
        vm.recordLogs();
        uint256 g0 = gasleft();
        disburser.disburseFrom(BASE_USDC, packed250, false);
        uint256 coldBatch250 = g0 - gasleft();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 failedCount;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(disburser) && logs[i].topics[0] == failedTopic) {
                failedCount++;
                uint256 idx = uint256(logs[i].topics[2]);
                (address recipient, uint256 amount) = abi.decode(logs[i].data, (address, uint256));
                console2.log("failed idx:", idx);
                console2.log("  recipient:", recipient);
                console2.log("  amount:", amount);
            }
        }
        console2.log("failed count:", failedCount);
        uint256 coldMarginal = (coldBatch250 - coldSingle) / 249;

        g0 = gasleft();
        IERC20(BASE_USDC).transfer(address(0x30000), 1_000_000);
        uint256 coldStandaloneExec = g0 - gasleft();

        uint256 warmSingle = _batchGas(1);
        g0 = gasleft();
        disburser.disburseFrom(BASE_USDC, packed250, false);
        uint256 warmBatch250 = g0 - gasleft();
        uint256 warmMarginal = (warmBatch250 - warmSingle) / 249;

        g0 = gasleft();
        IERC20(BASE_USDC).transfer(address(0x30000), 1_000_000);
        uint256 warmStandaloneExec = g0 - gasleft();

        console2.log("=== cold recipients (first-ever payout) ===");
        console2.log("USDC standalone exec (cold):", coldStandaloneExec);
        console2.log("USDC standalone tx (cold, +21k intrinsic):", coldStandaloneExec + 21000);
        console2.log("USDC batch-of-1 fixed overhead (cold):", coldSingle);
        console2.log("USDC batch-of-250 total (cold):", coldBatch250);
        console2.log("USDC batched marginal per transfer (cold):", coldMarginal);
        console2.log("=== warm recipients (already hold USDC) ===");
        console2.log("USDC standalone exec (warm):", warmStandaloneExec);
        console2.log("USDC standalone tx (warm, +21k intrinsic):", warmStandaloneExec + 21000);
        console2.log("USDC batch-of-1 fixed overhead (warm):", warmSingle);
        console2.log("USDC batch-of-250 total (warm):", warmBatch250);
        console2.log("USDC batched marginal per transfer (warm):", warmMarginal);

        assertEq(failedCount, 0, "no transfers should fail");
        assertEq(IERC20(BASE_USDC).balanceOf(address(disburser)), 0, "leftover must be swept");
        assertEq(IERC20(BASE_USDC).balanceOf(_recipient(0)), 4_000_000);
        assertEq(IERC20(BASE_USDC).balanceOf(_recipient(137)), 2_000_000);
        assertEq(IERC20(BASE_USDC).balanceOf(_recipient(249)), 2_000_000);
        assertEq(IERC20(BASE_USDC).balanceOf(address(0x30000)), 2_000_000);
        assertLt(warmMarginal, 20000, "warm marginal should be well under 20k");
        assertLt(coldMarginal, 35000, "cold marginal should be well under 35k");
        assertLt(
            warmMarginal + (warmSingle / 250),
            warmStandaloneExec - 30000,
            "batched warm must save >=30k gas vs standalone warm exec"
        );
        assertLt(
            coldMarginal + (coldSingle / 250),
            coldStandaloneExec - 30000,
            "batched cold must save >=30k gas vs standalone cold exec"
        );
    }
}
