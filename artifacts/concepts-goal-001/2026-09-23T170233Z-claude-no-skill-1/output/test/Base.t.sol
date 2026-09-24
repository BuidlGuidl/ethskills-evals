// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

abstract contract BillingTest is Test {
    uint8 internal constant HOBBY = 1;
    uint8 internal constant PRO = 2;
    uint128 internal constant HOBBY_PRICE = 5e6;
    uint128 internal constant PRO_PRICE = 20e6;

    MockUSDC internal usdc;
    SubscriptionBilling internal billing;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public virtual {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner);

        vm.startPrank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, true);
        billing.setPlan(PRO, PRO_PRICE, true);
        vm.stopPrank();

        // Start well past the epoch so period arithmetic is not trivially zero.
        vm.warp(1_800_000_000);
    }

    function fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.startPrank(who);
        usdc.approve(address(billing), amount);
        billing.deposit(who, amount);
        vm.stopPrank();
    }

    /// @dev The accounting invariant every test asserts after acting.
    function assertSolvent() internal view {
        assertGe(
            usdc.balanceOf(address(billing)),
            billing.totalUserFunds() + billing.merchantAccrued(),
            "contract is short of what it owes"
        );
    }
}
