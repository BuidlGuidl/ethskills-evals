// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Not an assertion suite — this prints the gas numbers quoted in NOTES.md so
/// you can re-measure them after any change:  forge test --match-contract GasTest -vv
contract GasTest is Test {
    SubscriptionBilling b;
    MockUSDC u;
    address owner = address(0xB0B);

    function setUp() public {
        u = new MockUSDC();
        b = new SubscriptionBilling(IERC20(address(u)), owner);
        vm.prank(owner);
        b.setPlan(1, 5_000_000, true);
        vm.warp(1_800_000_000);
    }

    function test_printGasCosts() public {
        uint256 n = 200;
        address[] memory accts = new address[](n);
        for (uint256 i; i < n; ++i) {
            address a = address(uint160(1000 + i));
            accts[i] = a;
            u.mint(a, 100e6);
            vm.startPrank(a);
            u.approve(address(b), type(uint256).max);
            uint256 g = gasleft();
            b.depositAndSubscribe(100e6, 1);
            if (i == 1) console2.log("depositAndSubscribe gas:", g - gasleft());
            vm.stopPrank();
        }
        skip(30 days);
        uint256 g1 = gasleft();
        b.settle(accts);
        console2.log("settle 200 accounts gas:", g1 - gasleft());

        address[] memory one = new address[](1);
        one[0] = accts[0];
        skip(1 days);
        uint256 g2 = gasleft();
        b.settle(one);
        console2.log("settle 1 account gas:", g2 - gasleft());

        vm.startPrank(accts[5]);
        uint256 g3 = gasleft();
        b.cancelAndWithdraw(accts[5]);
        console2.log("cancelAndWithdraw gas:", g3 - gasleft());
        vm.stopPrank();

        uint256 g4 = gasleft();
        b.isSubscribed(accts[9]);
        console2.log("isSubscribed (view) gas:", g4 - gasleft());
    }
}
