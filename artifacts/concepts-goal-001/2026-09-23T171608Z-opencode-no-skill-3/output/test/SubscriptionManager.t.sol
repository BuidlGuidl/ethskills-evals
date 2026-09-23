// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionManagerTest is Test {
    SubscriptionManager internal sm;
    MockUSDC internal usdc;

    address internal owner = address(this);
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant HOBBY_PRICE = 5e6; // $5
    uint256 internal constant PRO_PRICE = 20e6; // $20
    uint64 internal constant PERIOD = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        sm = new SubscriptionManager(address(usdc));

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(sm), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(sm), type(uint256).max);
    }

    // -- helpers -----------------------------------------------------------

    function _deposit(address user, uint256 amount) internal {
        vm.prank(user);
        sm.deposit(amount);
    }

    function _subscribe(address user, uint256 planId) internal {
        vm.prank(user);
        sm.subscribe(planId);
    }

    // -- plans -------------------------------------------------------------

    function test_defaultPlans() public view {
        (uint256 price, uint64 period, bool active) = sm.plans(sm.HOBBY());
        assertEq(price, HOBBY_PRICE);
        assertEq(period, PERIOD);
        assertTrue(active);

        (price, period, active) = sm.plans(sm.PRO());
        assertEq(price, PRO_PRICE);
        assertEq(period, PERIOD);
        assertTrue(active);
    }

    function test_setPlan_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.NotOwner.selector);
        sm.setPlan(3, 50e6, PERIOD, true);

        sm.setPlan(3, 50e6, PERIOD, true);
        (uint256 price,, bool active) = sm.plans(3);
        assertEq(price, 50e6);
        assertTrue(active);
    }

    function test_setPlan_rejectsZeroPeriod() public {
        vm.expectRevert(SubscriptionManager.ZeroPeriod.selector);
        sm.setPlan(3, 50e6, 0, true);
    }

    // -- deposit -----------------------------------------------------------

    function test_deposit() public {
        _deposit(alice, 100e6);
        (uint256 planId, uint256 balance,, bool subscribed) = sm.getAccount(alice);
        assertEq(planId, 0);
        assertEq(balance, 100e6);
        assertFalse(subscribed);
        assertEq(usdc.balanceOf(address(sm)), 100e6);
    }

    function test_deposit_zeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.ZeroAmount.selector);
        sm.deposit(0);
    }

    // -- subscribe ---------------------------------------------------------

    function test_subscribe_chargesFirstPeriodImmediately() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());

        assertTrue(sm.isSubscribed(alice));
        (uint256 planId, uint256 balance, uint256 paidThrough,) = sm.getAccount(alice);
        assertEq(planId, sm.HOBBY());
        assertEq(balance, 100e6 - HOBBY_PRICE);
        assertEq(paidThrough, block.timestamp + PERIOD);
        assertEq(sm.collectedFees(), HOBBY_PRICE);
    }

    function test_subscribe_insufficientBalanceReverts() public {
        _deposit(alice, 4e6);
        uint256 hobby = sm.HOBBY(); // read before expectRevert (a call would consume it)
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionManager.InsufficientBalance.selector, HOBBY_PRICE, 4e6
            )
        );
        sm.subscribe(hobby);
    }

    function test_subscribe_inactivePlanReverts() public {
        _deposit(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.PlanNotActive.selector);
        sm.subscribe(99);
    }

    function test_subscribe_alreadySubscribedReverts() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());
        uint256 pro = sm.PRO();
        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.AlreadySubscribed.selector);
        sm.subscribe(pro);
    }

    // -- monthly charging --------------------------------------------------

    function test_processPayment_chargesEachElapsedPeriod() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());

        // 3 periods elapse; anyone can trigger settlement.
        vm.warp(block.timestamp + 3 * PERIOD + 1);
        vm.prank(bob);
        sm.processPayment(alice);

        (uint256 planId, uint256 balance, uint256 paidThrough,) = sm.getAccount(alice);
        assertEq(planId, sm.HOBBY());
        assertEq(balance, 100e6 - 4 * HOBBY_PRICE); // initial + 3 renewals
        assertEq(paidThrough, block.timestamp + PERIOD - 1);
        assertEq(sm.collectedFees(), 4 * HOBBY_PRICE);
        assertTrue(sm.isSubscribed(alice));
    }

    function test_processPayment_nothingDueIsNoop() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());
        uint256 feesBefore = sm.collectedFees();
        sm.processPayment(alice);
        assertEq(sm.collectedFees(), feesBefore);
    }

    function test_processPayment_lapsesWhenBalanceRunsOut() public {
        _deposit(alice, 12e6); // covers 2 periods, not 3
        _subscribe(alice, sm.HOBBY()); // balance now 7e6

        vm.warp(block.timestamp + PERIOD + 1);
        sm.processPayment(alice); // charges period 2, balance 2e6
        assertTrue(sm.isSubscribed(alice));

        vm.warp(block.timestamp + PERIOD + 1);
        sm.processPayment(alice); // can't cover period 3 -> lapse

        assertFalse(sm.isSubscribed(alice));
        (uint256 planId, uint256 balance,,) = sm.getAccount(alice);
        assertEq(planId, 0);
        assertEq(balance, 2e6); // leftover stays, withdrawable
        assertEq(sm.collectedFees(), 2 * HOBBY_PRICE);
    }

    function test_isSubscribed_accurateWithoutKeeper() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());

        // Even if nobody ever calls processPayment, the view knows the sub
        // expired once paidThrough passes.
        vm.warp(block.timestamp + PERIOD + 1);
        assertFalse(sm.isSubscribed(alice));
    }

    function test_processPayments_batch() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());
        _deposit(bob, 100e6);
        _subscribe(bob, sm.PRO());

        vm.warp(block.timestamp + PERIOD + 1);
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        sm.processPayments(users);

        assertEq(sm.collectedFees(), 2 * HOBBY_PRICE + 2 * PRO_PRICE);
    }

    // -- resubscribe after lapse -------------------------------------------

    function test_resubscribeAfterLapse() public {
        _deposit(alice, 12e6);
        _subscribe(alice, sm.HOBBY());

        vm.warp(block.timestamp + 2 * PERIOD + 1);
        sm.processPayment(alice); // lapses
        assertFalse(sm.isSubscribed(alice));

        _deposit(alice, 20e6); // 2e6 leftover + 20e6 covers the $20 pro period
        _subscribe(alice, sm.PRO());
        assertTrue(sm.isSubscribed(alice));
        (uint256 planId,, uint256 paidThrough,) = sm.getAccount(alice);
        assertEq(planId, sm.PRO());
        assertEq(paidThrough, block.timestamp + PERIOD);
    }

    // -- cancel & withdraw -------------------------------------------------

    function test_cancel_refundsUnusedBalance() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());

        vm.warp(block.timestamp + 10 days); // mid-period
        uint256 walletBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        sm.cancel();

        assertFalse(sm.isSubscribed(alice));
        assertEq(usdc.balanceOf(alice), walletBefore + 95e6); // everything except the paid period
        (uint256 planId, uint256 balance, uint256 paidThrough,) = sm.getAccount(alice);
        assertEq(planId, 0);
        assertEq(balance, 0);
        assertEq(paidThrough, 0);
    }

    function test_cancel_worksWithNoSubscription() public {
        _deposit(alice, 50e6);
        vm.prank(alice);
        sm.cancel();
        assertEq(usdc.balanceOf(alice), 1_000e6);
    }

    function test_withdraw_blockedWhileSubscribed() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());
        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.AlreadySubscribed.selector);
        sm.withdraw(10e6);
    }

    function test_withdraw_afterLapseSettlesFirst() public {
        _deposit(alice, 12e6);
        _subscribe(alice, sm.HOBBY()); // balance 7e6

        // Two periods pass without a keeper run; sub expired, 1 renewal is owed.
        vm.warp(block.timestamp + 2 * PERIOD + 1);
        assertFalse(sm.isSubscribed(alice));

        vm.prank(alice);
        sm.withdraw(2e6); // 7e6 - 5e6 (owed renewal) = 2e6
        assertEq(usdc.balanceOf(alice), 1_000e6 - 10e6);
    }

    // -- fees --------------------------------------------------------------

    function test_sweepFees() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());

        sm.sweepFees(HOBBY_PRICE, owner);
        assertEq(sm.collectedFees(), 0);
        assertEq(usdc.balanceOf(owner), HOBBY_PRICE);

        // User funds remain fully backed.
        assertEq(usdc.balanceOf(address(sm)), 100e6 - HOBBY_PRICE);
    }

    function test_sweepFees_cannotTouchUserBalances() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());

        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionManager.InsufficientFees.selector, HOBBY_PRICE + 1, HOBBY_PRICE
            )
        );
        sm.sweepFees(HOBBY_PRICE + 1, owner);
    }

    function test_sweepFees_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.NotOwner.selector);
        sm.sweepFees(1, alice);
    }

    // -- ownership ---------------------------------------------------------

    function test_transferOwnership() public {
        sm.transferOwnership(alice);
        assertEq(sm.owner(), alice);

        vm.expectRevert(SubscriptionManager.NotOwner.selector);
        sm.transferOwnership(bob);
    }

    // -- invariant-ish solvency check --------------------------------------

    function test_solvency_contractBalanceCoversObligations() public {
        _deposit(alice, 100e6);
        _subscribe(alice, sm.HOBBY());
        _deposit(bob, 60e6);
        _subscribe(bob, sm.PRO());

        vm.warp(block.timestamp + 2 * PERIOD + 1);
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        sm.processPayments(users);

        (, uint256 aliceBal,,) = sm.getAccount(alice);
        (, uint256 bobBal,,) = sm.getAccount(bob);
        assertEq(usdc.balanceOf(address(sm)), aliceBal + bobBal + sm.collectedFees());
    }
}
