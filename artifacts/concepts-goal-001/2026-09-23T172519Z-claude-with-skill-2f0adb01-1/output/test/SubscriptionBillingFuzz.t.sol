// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TestBase} from "./TestBase.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {IERC20} from "../src/IERC20.sol";

/// @notice Property tests for the two things that must hold for any inputs:
/// the contract is always solvent, and a subscriber can always get their
/// unused funds back.
contract SubscriptionBillingFuzzTest is TestBase {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;

    address internal operator = address(0xA11CE);
    address internal user = address(0xB0B);

    uint16 internal hobby;
    uint16 internal pro;

    function setUp() public {
        vm.warp(1_750_000_000);
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), operator);
        vm.startPrank(operator);
        hobby = billing.createPlan(5_000_000, "hobby");
        pro = billing.createPlan(20_000_000, "pro");
        vm.stopPrank();
    }

    function _solvent() internal view {
        assertTrue(
            usdc.balanceOf(address(billing)) >= billing.totalSubscriberBalance() + billing.revenueAccrued(),
            "contract holds at least what it owes"
        );
    }

    /// @notice For any deposit and any elapsed time, the contract can pay out every
    /// refund and every unit of earned revenue.
    function testFuzz_SolventForAnyDepositAndElapsedTime(uint96 amount, uint32 elapsed, bool usePro)
        public
    {
        amount = uint96(_bound(amount, 1, 1_000_000_000_000));
        uint16 planId = usePro ? pro : hobby;

        usdc.mint(user, amount);
        vm.startPrank(user);
        usdc.approve(address(billing), amount);
        billing.subscribe(planId, amount);
        vm.stopPrank();

        vm.warp(block.timestamp + elapsed);
        billing.collect(user);
        _solvent();

        // Whatever the quote says is refundable must actually be payable.
        uint256 quoted = billing.refundableOf(user);
        uint256 before = usdc.balanceOf(user);
        vm.prank(user);
        billing.cancel();
        assertEq(usdc.balanceOf(user) - before, quoted, "refund quote is honoured exactly");

        // Everything the user did not get back is revenue the operator can withdraw.
        assertEq(billing.revenueAccrued(), amount - quoted, "no value created or destroyed");
        _solvent();
    }

    /// @notice A subscriber never pays more than they deposited, however long they lapse.
    function testFuzz_NeverChargedMoreThanDeposited(uint96 amount, uint32 elapsed) public {
        amount = uint96(_bound(amount, 1, 1_000_000_000_000));
        usdc.mint(user, amount);
        vm.startPrank(user);
        usdc.approve(address(billing), amount);
        billing.subscribe(hobby, amount);
        vm.stopPrank();

        vm.warp(block.timestamp + elapsed);
        billing.collect(user);
        assertTrue(billing.revenueAccrued() <= amount, "charges are capped at the prepaid amount");
    }

    /// @notice Settling at arbitrary intermediate points must not change the total
    /// charged compared with settling once at the end.
    function testFuzz_SettlementFrequencyDoesNotChangeTotal(uint32 gapA, uint32 gapB) public {
        uint256 a = _bound(gapA, 1, 60 days);
        uint256 b = _bound(gapB, 1, 60 days);

        address other = address(0xCAFE);
        uint96 amount = 60_000_000; // $60 == 12 hobby months, enough to outlast both gaps

        usdc.mint(user, amount);
        usdc.mint(other, amount);
        vm.startPrank(user);
        usdc.approve(address(billing), amount);
        billing.subscribe(hobby, amount);
        vm.stopPrank();
        vm.startPrank(other);
        usdc.approve(address(billing), amount);
        billing.subscribe(hobby, amount);
        vm.stopPrank();

        uint256 start = block.timestamp;
        vm.warp(start + a);
        billing.collect(user); // settled twice
        vm.warp(start + a + b);
        billing.collect(user);
        billing.collect(other); // settled once

        assertApproxEq(
            billing.subscriptionOf(user).balance,
            billing.subscriptionOf(other).balance,
            1,
            "two settlements cost the same as one"
        );
    }

    function _bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        return min + (value % (max - min + 1));
    }
}
