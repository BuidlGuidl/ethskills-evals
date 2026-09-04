// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/IERC20.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Not assertions — measurements. These numbers go straight into NOTES.md so the
///         running-cost estimates there are real rather than guessed. Run with:
///         forge test --match-contract Gas -vv
contract GasTest is Test {
    SubscriptionBilling billing;
    MockUSDC usdc;
    address owner = makeAddr("owner");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        uint8[] memory ids = new uint8[](2);
        uint128[] memory prices = new uint128[](2);
        (ids[0], prices[0]) = (1, 5e6);
        (ids[1], prices[1]) = (2, 20e6);
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner, ids, prices);
    }

    function _makeSubscribers(uint256 n) internal returns (address[] memory who) {
        who = new address[](n);
        for (uint256 i; i < n; ++i) {
            address a = address(uint160(0xC0FFEE0000 + i));
            who[i] = a;
            usdc.mint(a, 1000e6);
            vm.startPrank(a);
            usdc.approve(address(billing), type(uint256).max);
            billing.subscribeWithDeposit(1, 100e6);
            vm.stopPrank();
        }
    }

    function test_gas_batchSettle() public {
        uint256[3] memory sizes = [uint256(1), 50, 200];
        for (uint256 s; s < sizes.length; ++s) {
            uint256 n = sizes[s];
            setUp();
            address[] memory who = _makeSubscribers(n);
            vm.warp(block.timestamp + 30 days);

            uint256 before = gasleft();
            billing.settle(who);
            uint256 used = before - gasleft();
            console2.log("settle batch size", n);
            console2.log("  total gas    ", used);
            console2.log("  gas per acct ", used / n);
        }
    }

    function test_gas_settleAndCollect200() public {
        address[] memory who = _makeSubscribers(200);
        vm.warp(block.timestamp + 30 days);
        uint256 before = gasleft();
        vm.prank(owner);
        billing.settleAndCollect(who, owner);
        console2.log("settleAndCollect(200) total gas", before - gasleft());
    }

    function test_gas_customerPaths() public {
        address a = address(uint160(0xBEEF));
        usdc.mint(a, 1000e6);
        vm.startPrank(a);
        usdc.approve(address(billing), type(uint256).max);

        uint256 g = gasleft();
        billing.subscribeWithDeposit(1, 60e6);
        console2.log("subscribeWithDeposit (first time)", g - gasleft());

        vm.warp(block.timestamp + 30 days);
        g = gasleft();
        billing.deposit(60e6);
        console2.log("deposit (top up)                 ", g - gasleft());

        g = gasleft();
        billing.closeAccount(a);
        console2.log("closeAccount (cancel + refund)   ", g - gasleft());
        vm.stopPrank();
    }
}
