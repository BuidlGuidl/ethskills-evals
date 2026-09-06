// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @notice Prices the recurring operator transaction, because "someone has to call this every
/// month" is only an acceptable design if the call is cheap next to the revenue it releases.
///
///   forge test --match-contract GasBenchmark -vv
contract GasBenchmarkTest is Test {
    SubscriptionBilling internal billing;
    MockERC20 internal usdc;
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        billing = new SubscriptionBilling(IERC20(address(usdc)), address(this), treasury);
        billing.setPlan(1, 5_000_000, true, "hobby");
        billing.setPlan(2, 20_000_000, true, "pro");
        vm.warp(1_800_000_000);
    }

    function test_SweepCost() public {
        console2.log("subscribers | settleAndCollect gas | gas/account");
        _bench(10);
        _bench(50);
        _bench(100);
        _bench(250);
    }

    function _bench(uint256 n) internal {
        // Fresh contract per size so the runs do not contaminate each other.
        usdc = new MockERC20("USD Coin", "USDC", 6);
        billing = new SubscriptionBilling(IERC20(address(usdc)), address(this), treasury);
        billing.setPlan(2, 20_000_000, true, "pro");

        address[] memory accounts = new address[](n);
        for (uint256 i; i < n; ++i) {
            address a = address(uint160(0x10000 + i));
            accounts[i] = a;
            usdc.mint(a, 240e6);
            vm.startPrank(a);
            usdc.approve(address(billing), type(uint256).max);
            billing.subscribe(2, 240e6); // a year of pro
            vm.stopPrank();
        }

        vm.warp(block.timestamp + 30 days);

        uint256 before = gasleft();
        billing.settleAndCollect(accounts);
        uint256 used = before - gasleft();

        console2.log(n, used, used / n);
    }

    function test_CustomerFacingCosts() public {
        address alice = makeAddr("alice");
        usdc.mint(alice, 1000e6);
        vm.startPrank(alice);
        usdc.approve(address(billing), type(uint256).max);

        uint256 g = gasleft();
        billing.subscribe(2, 60e6);
        console2.log("subscribe        ", g - gasleft());

        vm.warp(block.timestamp + 10 days);
        g = gasleft();
        billing.topUp(20e6);
        console2.log("topUp            ", g - gasleft());

        g = gasleft();
        billing.changePlan(1);
        console2.log("changePlan       ", g - gasleft());

        vm.warp(block.timestamp + 10 days);
        g = gasleft();
        billing.cancel(alice);
        console2.log("cancel           ", g - gasleft());
        vm.stopPrank();

        g = gasleft();
        billing.isSubscribed(alice);
        console2.log("isSubscribed(view)", g - gasleft());
    }
}
