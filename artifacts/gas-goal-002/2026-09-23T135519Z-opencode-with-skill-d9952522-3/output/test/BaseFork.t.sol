// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {RelayBatcher} from "../src/RelayBatcher.sol";

interface IUSDC {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// Fork test against real USDC on Base mainnet. Skipped unless BASE_RPC_URL is
/// set, so plain `forge test` runs offline:
///     BASE_RPC_URL=https://mainnet.base.org forge test --match-path test/BaseFork.t.sol -vv
/// Gas numbers quoted in PLAN.md come from this setup (fork + eth_estimateGas).
contract BaseForkTest is Test {
    // Native USDC on Base (Circle).
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    // Large USDC holder used to fund the test relayer (impersonated, fork only).
    address constant USDC_WHALE = 0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59;

    function test_real_usdc_batch_gas_and_payments() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            console2.log("skipping: set BASE_RPC_URL to run the Base fork test");
            return;
        }
        uint256 fork = vm.createFork(rpc);
        vm.selectFork(fork);

        RelayBatcher batcher = new RelayBatcher();
        address relayer = makeAddr("relayer");
        uint256 amt = 1e6; // 1 USDC
        uint256 n = 100;

        // fund relayer from the whale (vm.prank: no ETH needed on the fork);
        // avoids `deal`, which USDC's packed V2.2 balance storage can corrupt
        vm.prank(USDC_WHALE);
        require(IUSDC(USDC).transfer(relayer, n * amt), "whale transfer failed");

        address[] memory recipients = new address[](n);
        uint256[] memory amounts = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            recipients[i] = address(uint160(0xC01D + i * 0x1111)); // fresh payees
            amounts[i] = amt;
        }

        vm.startPrank(relayer);
        IUSDC(USDC).approve(address(batcher), type(uint256).max);
        uint256 g0 = gasleft();
        batcher.batchTransfer(USDC, recipients, amounts);
        uint256 spent = g0 - gasleft();
        vm.stopPrank();

        for (uint256 i; i < n; ++i) {
            assertEq(IUSDC(USDC).balanceOf(recipients[i]), amt, "payment missing");
        }
        console2.log("USDC batchTransfer N=100 total gas:", spent);
        console2.log("per item:", spent / n);
        // measured 2026-09-23: ~30.1k/item (fork estimate 3,010,124 total).
        // bound loose enough for live-state drift, tight enough to catch
        // a regression toward standalone-transfer cost (~62.6k).
        assertLt(spent / n, 33_000);
    }
}
