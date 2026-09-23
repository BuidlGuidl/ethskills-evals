// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, StdInvariant} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Drives the contract with random deposits, sign-ups, plan changes,
/// cancellations, time jumps and withdrawals.
contract BillingHandler is Test {
    SubscriptionBilling public billing;
    MockUSDC public usdc;
    address public owner;

    address[] public actors;
    address internal current;

    uint256 public totalDeposited;
    uint256 public totalPaidOut;

    modifier useActor(uint256 seed) {
        current = actors[seed % actors.length];
        vm.startPrank(current);
        _;
        vm.stopPrank();
    }

    constructor(SubscriptionBilling billing_, MockUSDC usdc_, address owner_) {
        billing = billing_;
        usdc = usdc_;
        owner = owner_;
        for (uint256 i; i < 5; ++i) {
            address a = address(uint160(uint256(keccak256(abi.encode("actor", i)))));
            actors.push(a);
            usdc.mint(a, 10_000_000e6);
            vm.prank(a);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function deposit(uint256 seed, uint96 amount) external useActor(seed) {
        amount = uint96(bound(amount, 1, 100_000e6));
        billing.deposit(current, amount);
        totalDeposited += amount;
    }

    function subscribe(uint256 seed, uint8 planId) external useActor(seed) {
        planId = uint8(bound(planId, 1, 2));
        try billing.subscribe(planId) {} catch {}
    }

    function changePlan(uint256 seed, uint8 planId) external useActor(seed) {
        planId = uint8(bound(planId, 1, 2));
        try billing.changePlan(planId) {} catch {}
    }

    function cancel(uint256 seed) external useActor(seed) {
        try billing.cancel() {} catch {}
    }

    function withdrawCredit(uint256 seed, uint96 amount) external useActor(seed) {
        uint256 credit = billing.statusOf(current).credit;
        if (credit == 0) return;
        amount = uint96(bound(amount, 1, credit));
        billing.withdrawCredit(current, amount);
        totalPaidOut += amount;
    }

    function settle(uint256 seed) external {
        billing.settle(actors[seed % actors.length]);
    }

    function withdrawRevenue(uint96 amount) external {
        uint256 accrued = billing.merchantAccrued();
        if (accrued == 0) return;
        amount = uint96(bound(amount, 1, accrued));
        vm.prank(owner);
        billing.withdrawRevenue(owner, amount);
        totalPaidOut += amount;
    }

    function warp(uint32 delta) external {
        vm.warp(block.timestamp + bound(delta, 1 hours, 120 days));
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract BillingInvariantTest is StdInvariant, Test {
    MockUSDC internal usdc;
    SubscriptionBilling internal billing;
    BillingHandler internal handler;
    address internal owner = makeAddr("owner");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner);

        vm.startPrank(owner);
        billing.setPlan(1, 5e6, true);
        billing.setPlan(2, 20e6, true);
        vm.stopPrank();

        handler = new BillingHandler(billing, usdc, owner);
        targetContract(address(handler));
    }

    /// @notice The contract always holds at least what it owes: every account's
    /// credit, every escrowed period, and every USDC of booked revenue.
    function invariant_solvent() public view {
        assertGe(usdc.balanceOf(address(billing)), billing.totalUserFunds() + billing.merchantAccrued());
    }

    /// @notice Money in equals money out plus money held. Nothing is minted or burned.
    function invariant_conservation() public view {
        assertEq(
            usdc.balanceOf(address(billing)) + handler.totalPaidOut(),
            handler.totalDeposited(),
            "USDC appeared or vanished"
        );
    }

    /// @notice Per account: an active subscription is always inside its paid
    /// period after projection, so `isSubscribed` can never report stale truth.
    function invariant_activeMeansInsidePaidPeriod() public view {
        uint256 n = handler.actorCount();
        uint256 period = billing.PERIOD();
        for (uint256 i; i < n; ++i) {
            address a = handler.actors(i);
            SubscriptionBilling.Status memory st = billing.statusOf(a);
            if (!st.active) continue;
            assertGt(st.periodEnd, block.timestamp, "active past the end of its paid period");
            assertLe(st.periodEnd, block.timestamp + period);
            assertGe(st.expiresAt, st.periodEnd, "expiry cannot precede the paid period");
        }
    }

    /// @notice A customer can always exit: cancelling and withdrawing returns
    /// exactly the `refundable` figure the contract advertised.
    function invariant_refundableIsHonoured() public {
        uint256 n = handler.actorCount();
        for (uint256 i; i < n; ++i) {
            address a = handler.actors(i);
            SubscriptionBilling.Status memory st = billing.statusOf(a);
            if (st.refundable == 0) continue;

            uint256 snap = vm.snapshotState();
            uint256 before = usdc.balanceOf(a);
            vm.startPrank(a);
            if (st.active) billing.cancelAndWithdraw(a);
            else billing.withdrawCredit(a, st.credit);
            vm.stopPrank();
            assertEq(usdc.balanceOf(a) - before, st.refundable, "advertised refund was not honoured");
            vm.revertToState(snap);
        }
    }
}
