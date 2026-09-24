// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling billing;
    MockUSDC usdc;

    address operator = makeAddr("operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address treasury = makeAddr("treasury");

    uint96 constant HOBBY_PRICE = 5e6; // $5 / 30 days
    uint96 constant PRO_PRICE = 20e6; // $20 / 30 days
    uint32 constant HOBBY = 1;
    uint32 constant PRO = 2;

    uint256 constant MONTH = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), operator);

        vm.startPrank(operator);
        billing.addPlan("hobby", HOBBY_PRICE);
        billing.addPlan("pro", PRO_PRICE);
        vm.stopPrank();

        for (uint160 i; i < 2; ++i) {
            address u = i == 0 ? alice : bob;
            usdc.mint(u, 1000e6);
            vm.prank(u);
            usdc.approve(address(billing), type(uint256).max);
        }
        // Avoid timestamp 0/1 edge cases.
        vm.warp(1_800_000_000);
    }

    function _fundAndSubscribe(address who, uint256 amount, uint32 planId) internal {
        vm.startPrank(who);
        billing.deposit(amount);
        billing.subscribe(planId);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // The core question the backend asks
    // ------------------------------------------------------------------

    function test_isSubscribed_trueWhilePaidUp_falseAfterRunwayEnds() public {
        _fundAndSubscribe(alice, 5e6, HOBBY); // exactly one month of hobby

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.expiresAt(alice), block.timestamp + MONTH);

        vm.warp(block.timestamp + MONTH - 1);
        assertTrue(billing.isSubscribed(alice), "still paid up one second before");

        vm.warp(block.timestamp + 1);
        assertFalse(billing.isSubscribed(alice), "lapses with no transaction sent");
    }

    function test_isSubscribed_falseForStranger() public view {
        assertFalse(billing.isSubscribed(address(0xdead)));
        assertEq(billing.expiresAt(address(0xdead)), 0);
    }

    function test_depositOnlyIsNotSubscribed() public {
        vm.prank(alice);
        billing.deposit(100e6);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_subscriptionOf_reportsEverythingBackendNeeds() public {
        _fundAndSubscribe(alice, 20e6, PRO);
        vm.warp(block.timestamp + 15 days);

        (bool active, uint32 planId, uint256 price, uint256 balance, uint256 expiry) =
            billing.subscriptionOf(alice);

        assertTrue(active);
        assertEq(planId, PRO);
        assertEq(price, PRO_PRICE);
        assertEq(balance, 10e6, "half the month consumed");
        assertEq(expiry, block.timestamp + 15 days);
    }

    // ------------------------------------------------------------------
    // Accrual
    // ------------------------------------------------------------------

    function test_chargeAccruesContinuouslyWithoutAnyTransaction() public {
        _fundAndSubscribe(alice, 50e6, HOBBY);

        assertEq(billing.availableBalance(alice), 50e6);

        vm.warp(block.timestamp + 15 days);
        assertEq(billing.availableBalance(alice), 47.5e6, "half a hobby month = $2.50");
        assertEq(billing.pendingRevenue(alice), 2.5e6);

        vm.warp(block.timestamp + 15 days);
        assertEq(billing.availableBalance(alice), 45e6);
    }

    function test_settleMovesAccrualToRevenueWithoutChangingNetBalance() public {
        _fundAndSubscribe(alice, 50e6, HOBBY);
        vm.warp(block.timestamp + 10 days);

        uint256 before = billing.availableBalance(alice);
        billing.settle(alice); // anyone may call
        assertEq(billing.availableBalance(alice), before, "settle is bookkeeping only");
        assertEq(billing.collectedRevenue(), uint256(5e6) / 3);
        assertEq(billing.pendingRevenue(alice), 0);
    }

    function test_repeatedSettlingDoesNotRoundRevenueAway() public {
        _fundAndSubscribe(alice, 50e6, HOBBY);
        uint256 start = block.timestamp;

        // Settle every 100 seconds for a day. Truncation without carry would
        // lose up to 1 unit per call.
        for (uint256 i; i < 864; ++i) {
            vm.warp(start + (i + 1) * 100);
            billing.settle(alice);
        }

        uint256 expected = (uint256(1 days) * HOBBY_PRICE) / MONTH;
        // Carry means at most the final partial second is unbilled.
        assertApproxEqAbs(billing.collectedRevenue(), expected, 1);
        assertEq(billing.availableBalance(alice), 50e6 - billing.collectedRevenue());
    }

    function test_griefSettlingCannotDrainAnAccount() public {
        _fundAndSubscribe(alice, 50e6, HOBBY);
        uint256 start = block.timestamp;
        vm.warp(start + 1 days);

        for (uint256 i; i < 50; ++i) {
            billing.settle(alice);
        }
        assertEq(billing.collectedRevenue(), (uint256(1 days) * HOBBY_PRICE) / MONTH);
    }

    // ------------------------------------------------------------------
    // Running out
    // ------------------------------------------------------------------

    function test_runningOutChargesOnlyForServiceReceived() public {
        _fundAndSubscribe(alice, 5e6, HOBBY); // one month

        vm.warp(block.timestamp + 90 days); // three months of wall clock
        assertFalse(billing.isSubscribed(alice));

        billing.settle(alice);
        assertEq(billing.collectedRevenue(), 5e6, "capped at what was prepaid");
        assertEq(billing.availableBalance(alice), 0);
    }

    function test_toppingUpAfterLapseDoesNotBackbillTheGap() public {
        _fundAndSubscribe(alice, 5e6, HOBBY);
        vm.warp(block.timestamp + 60 days); // lapsed 30 days ago
        assertFalse(billing.isSubscribed(alice));

        vm.prank(alice);
        billing.deposit(5e6);

        assertTrue(billing.isSubscribed(alice), "resumes immediately");
        assertEq(billing.availableBalance(alice), 5e6, "gap is not billed");
        assertEq(billing.expiresAt(alice), block.timestamp + MONTH);
        assertEq(billing.collectedRevenue(), 5e6);
    }

    // ------------------------------------------------------------------
    // Cancellation and refunds
    // ------------------------------------------------------------------

    function test_cancelRefundsExactlyTheUnusedPortion() public {
        _fundAndSubscribe(alice, 20e6, HOBBY);
        vm.warp(block.timestamp + 6 days); // 1/5 of a month = $1

        vm.prank(alice);
        uint256 refund = billing.cancelAndWithdraw(alice);

        assertEq(refund, 19e6);
        assertEq(usdc.balanceOf(alice), 1000e6 - 1e6);
        assertEq(billing.collectedRevenue(), 1e6);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancelStopsFurtherCharges() public {
        _fundAndSubscribe(alice, 20e6, HOBBY);
        vm.warp(block.timestamp + 6 days);
        vm.prank(alice);
        billing.cancel();

        vm.warp(block.timestamp + 365 days);
        assertEq(billing.availableBalance(alice), 19e6, "no accrual while cancelled");
        assertEq(billing.pendingRevenue(alice), 0);
    }

    function test_cancelRevertsIfNotSubscribed() public {
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        vm.prank(alice);
        billing.cancel();
    }

    function test_withdrawWhileSubscribedShortensRunway() public {
        _fundAndSubscribe(alice, 50e6, HOBBY);
        vm.prank(alice);
        billing.withdraw(45e6, alice);

        assertEq(billing.availableBalance(alice), 5e6);
        assertEq(billing.expiresAt(alice), block.timestamp + MONTH);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_withdrawCannotExceedAvailable() public {
        _fundAndSubscribe(alice, 10e6, HOBBY);
        vm.warp(block.timestamp + 15 days); // $2.50 consumed

        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 10e6, 7.5e6));
        vm.prank(alice);
        billing.withdraw(10e6, alice);
    }

    // ------------------------------------------------------------------
    // Plans
    // ------------------------------------------------------------------

    function test_switchingPlansBillsOldRateFirst() public {
        _fundAndSubscribe(alice, 100e6, HOBBY);
        vm.warp(block.timestamp + 30 days); // $5 at hobby

        vm.prank(alice);
        billing.subscribe(PRO);

        assertEq(billing.availableBalance(alice), 95e6);
        assertEq(billing.collectedRevenue(), 5e6);

        vm.warp(block.timestamp + 30 days); // $20 at pro
        assertEq(billing.availableBalance(alice), 75e6);
    }

    function test_subscribeRejectsUnknownAndClosedPlans() public {
        vm.prank(alice);
        billing.deposit(100e6);

        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, uint32(9)));
        vm.prank(alice);
        billing.subscribe(9);

        vm.prank(operator);
        billing.setPlanOpen(HOBBY, false);

        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.PlanClosed.selector, HOBBY));
        vm.prank(alice);
        billing.subscribe(HOBBY);
    }

    function test_closingAPlanDoesNotEvictExistingSubscribers() public {
        _fundAndSubscribe(alice, 50e6, HOBBY);

        vm.prank(operator);
        billing.setPlanOpen(HOBBY, false);

        vm.warp(block.timestamp + 10 days);
        assertTrue(billing.isSubscribed(alice), "grandfathered at the agreed price");
        assertEq(billing.availableBalance(alice), 50e6 - uint256(5e6) / 3);
    }

    function test_operatorCannotRepriceAnExistingPlan() public {
        _fundAndSubscribe(alice, 50e6, HOBBY);

        // No repricing surface exists at all: the call finds no such function.
        vm.prank(operator);
        (bool ok,) = address(billing)
            .call(abi.encodeWithSignature("setPlanPrice(uint32,uint96)", HOBBY, uint96(500e6)));
        assertFalse(ok, "there is no way to reprice a live plan");

        vm.warp(block.timestamp + 30 days);
        assertEq(billing.pendingRevenue(alice), 5e6, "still $5/month");
    }

    function test_subscribeRequiresAtLeastADayOfRunway() public {
        vm.startPrank(alice);
        billing.deposit(0.1e6); // $0.10 -> ~14 hours of hobby
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientRunway.selector, uint256(1 days))
        );
        billing.subscribe(HOBBY);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Operator powers and their limits
    // ------------------------------------------------------------------

    function test_operatorCannotWithdrawUnsettledOrCustomerFunds() public {
        _fundAndSubscribe(alice, 100e6, HOBBY);
        vm.warp(block.timestamp + 30 days);

        // $5 is owed but not settled yet, so nothing is withdrawable.
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 1, 0));
        vm.prank(operator);
        billing.withdrawRevenue(treasury, 1);

        billing.settle(alice);

        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 6e6, 5e6));
        vm.prank(operator);
        billing.withdrawRevenue(treasury, 6e6);

        vm.prank(operator);
        billing.withdrawRevenue(treasury, 5e6);
        assertEq(usdc.balanceOf(treasury), 5e6);
    }

    function test_nonOperatorCannotAddPlansOrWithdraw() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.addPlan("free lunch", 1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.withdrawRevenue(alice, 1);
        vm.stopPrank();
    }

    function test_customersCanExitWithNoOperatorInvolvement() public {
        // The operator key is gone. Subscribers must still be able to leave whole.
        _fundAndSubscribe(alice, 50e6, PRO);
        vm.warp(block.timestamp + 3 days);

        vm.prank(alice);
        uint256 refund = billing.cancelAndWithdraw(alice);
        assertEq(refund, 50e6 - 2e6); // $20 * 3/30 = $2
        assertEq(usdc.balanceOf(alice), 1000e6 - 2e6);
    }

    function test_sweepSurplusOnlyTakesStrayTokens() public {
        _fundAndSubscribe(alice, 50e6, HOBBY);
        usdc.mint(address(billing), 7e6); // someone transferred in by mistake

        vm.prank(operator);
        uint256 swept = billing.sweepSurplus(treasury);
        assertEq(swept, 7e6);
        assertEq(usdc.balanceOf(treasury), 7e6);

        vm.expectRevert(SubscriptionBilling.NothingToSweep.selector);
        vm.prank(operator);
        billing.sweepSurplus(treasury);

        assertEq(billing.availableBalance(alice), 50e6, "customer untouched");
    }

    // ------------------------------------------------------------------
    // Third-party funding
    // ------------------------------------------------------------------

    function test_anyoneCanTopUpAnotherAccount() public {
        vm.prank(bob);
        billing.depositFor(alice, 25e6);

        vm.prank(alice);
        billing.subscribe(PRO);

        assertTrue(billing.isSubscribed(alice));
        assertEq(usdc.balanceOf(bob), 1000e6 - 25e6);
    }

    function test_depositWithPermitNeedsNoApprove() public {
        (address carol, uint256 pk) = makeAddrAndKey("carol");
        usdc.mint(carol, 100e6);

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = _permitDigest(carol, address(billing), 30e6, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);

        vm.startPrank(carol);
        billing.depositWithPermit(30e6, deadline, v, r, s);
        billing.subscribe(PRO);
        vm.stopPrank();

        assertTrue(billing.isSubscribed(carol));
    }

    function _permitDigest(address owner, address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner,
                spender,
                value,
                usdc.nonces(owner),
                deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
    }

    // ------------------------------------------------------------------
    // Solvency invariant
    // ------------------------------------------------------------------

    function testFuzz_contractAlwaysCoversCustomerBalancesPlusRevenue(
        uint96 deposit1,
        uint96 deposit2,
        uint32 jump,
        bool cancelAlice
    ) public {
        deposit1 = uint96(bound(deposit1, 1e6, 500e6));
        deposit2 = uint96(bound(deposit2, 5e6, 500e6));
        jump = uint32(bound(jump, 0, 400 days));

        _fundAndSubscribe(alice, deposit1, HOBBY);
        _fundAndSubscribe(bob, deposit2, PRO);

        vm.warp(block.timestamp + jump);

        if (cancelAlice) {
            vm.prank(alice);
            billing.cancelAndWithdraw(alice);
        }
        billing.settle(alice);
        billing.settle(bob);

        assertGe(
            usdc.balanceOf(address(billing)),
            billing.totalCustomerBalance() + billing.collectedRevenue(),
            "contract must hold at least everything it owes"
        );
        assertEq(
            billing.totalCustomerBalance(), billing.availableBalance(alice) + billing.availableBalance(bob)
        );
    }

    function testFuzz_refundNeverExceedsDepositAndNeverGoesNegative(uint96 amount, uint32 jump) public {
        amount = uint96(bound(amount, 1e6, 1000e6));
        jump = uint32(bound(jump, 0, 1000 days));

        _fundAndSubscribe(alice, amount, PRO);
        vm.warp(block.timestamp + jump);

        uint256 owed = billing.pendingRevenue(alice);
        assertLe(owed, amount);

        vm.prank(alice);
        uint256 refund = billing.cancelAndWithdraw(alice);
        assertEq(refund + owed, amount);
    }
}
