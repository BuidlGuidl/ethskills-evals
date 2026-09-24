// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {ISubscriptionBilling} from "../src/interfaces/ISubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;

    address internal operator = makeAddr("operator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint32 internal constant HOBBY = 0;
    uint32 internal constant PRO = 1;
    uint128 internal constant HOBBY_PRICE = 5e6;
    uint128 internal constant PRO_PRICE = 20e6;
    uint256 internal constant MONTH = 30 days;

    function setUp() public {
        usdc = new MockUSDC();
        uint128[] memory prices = new uint128[](2);
        prices[0] = HOBBY_PRICE;
        prices[1] = PRO_PRICE;
        billing = new SubscriptionBilling(IERC20(address(usdc)), operator, prices);

        // Start at a realistic timestamp: `lastSettled` defaults to 0, and tests that never deposit
        // would otherwise see a 55-year accrual window.
        vm.warp(1_750_000_000);

        for (uint256 i; i < 2; ++i) {
            address u = i == 0 ? alice : bob;
            usdc.mint(u, 1_000e6);
            vm.prank(u);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function _fund(address user, uint256 amount) internal {
        vm.prank(user);
        billing.deposit(amount);
    }

    function _sub(address user, uint256 amount, uint32 planId) internal {
        vm.prank(user);
        billing.depositAndSubscribe(amount, planId);
    }

    /*//////////////////////////////////////////////////////////////
                                 BASICS
    //////////////////////////////////////////////////////////////*/

    function test_deployedWithBothPlans() public view {
        assertEq(billing.planCount(), 2);
        assertEq(billing.planPrice(HOBBY), HOBBY_PRICE);
        assertEq(billing.planPrice(PRO), PRO_PRICE);
        assertEq(billing.owner(), operator);
    }

    function test_depositCreditsBalanceAndMovesTokens() public {
        _fund(alice, 50e6);
        assertEq(billing.balanceOf(alice), 50e6);
        assertEq(usdc.balanceOf(address(billing)), 50e6);
        assertEq(billing.totalCustomerBalance(), 50e6);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_depositForCreditsTheOtherAccount() public {
        vm.prank(bob);
        billing.depositFor(alice, 25e6);
        assertEq(billing.balanceOf(alice), 25e6);
        assertEq(billing.balanceOf(bob), 0);
    }

    function test_subscribeRequiresAFullPeriodUpFront() public {
        _fund(alice, 4e6);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 4e6, HOBBY_PRICE)
        );
        billing.subscribe(HOBBY);
    }

    function test_subscribeSetsExpiryOnePeriodOutWhenExactlyFunded() public {
        _sub(alice, HOBBY_PRICE, HOBBY);
        assertTrue(billing.isSubscribed(alice));
        // Truncation in the per-second rate makes the funded window a hair longer than 30 days.
        assertApproxEqAbs(billing.expiresAt(alice), block.timestamp + MONTH, 60);
    }

    /*//////////////////////////////////////////////////////////////
                          CHARGING OVER TIME
    //////////////////////////////////////////////////////////////*/

    function test_oneMonthOfHobbyCostsThePlanPrice() public {
        _sub(alice, 60e6, HOBBY);
        skip(MONTH);
        billing.settle(alice);

        assertApproxEqAbs(billing.earned(), HOBBY_PRICE, 1e3);
        assertApproxEqAbs(billing.balanceOf(alice), 60e6 - HOBBY_PRICE, 1e3);
    }

    function test_twelveMonthsChargesTwelveTimes() public {
        _sub(alice, 100e6, HOBBY);
        for (uint256 i; i < 12; ++i) {
            skip(MONTH);
            billing.settle(alice); // sweeping monthly is the operator's habit, not a requirement
        }
        assertApproxEqAbs(billing.earned(), 12 * uint256(HOBBY_PRICE), 1e4);
    }

    function test_billingIsIdenticalWhetherOrNotTheOperatorSettles() public {
        _sub(alice, 100e6, HOBBY);
        _sub(bob, 100e6, HOBBY);

        for (uint256 i; i < 6; ++i) {
            skip(MONTH);
            billing.settle(alice); // alice is swept monthly, bob is never swept
        }

        // Same service, same cost — settlement cadence has no effect on what a customer pays.
        assertApproxEqAbs(billing.balanceOf(alice), billing.balanceOf(bob), 1e3);
    }

    function test_proCostsFourTimesHobby() public {
        _sub(alice, 100e6, HOBBY);
        _sub(bob, 100e6, PRO);
        skip(MONTH);

        uint256 aliceUsed = 100e6 - billing.balanceOf(alice);
        uint256 bobUsed = 100e6 - billing.balanceOf(bob);
        assertApproxEqAbs(bobUsed, 4 * aliceUsed, 1e3);
        assertApproxEqAbs(bobUsed, PRO_PRICE, 1e3);
    }

    function test_accrualIsProRataWithinAPeriod() public {
        _sub(alice, 60e6, HOBBY);
        skip(MONTH / 2);
        assertApproxEqAbs(billing.accruedOf(alice), HOBBY_PRICE / 2, 1e3);
        assertApproxEqAbs(billing.balanceOf(alice), 60e6 - HOBBY_PRICE / 2, 1e3);
    }

    /*//////////////////////////////////////////////////////////////
                           CANCEL AND REFUND
    //////////////////////////////////////////////////////////////*/

    function test_cancelMidPeriodRefundsTheUnusedPortion() public {
        _sub(alice, 20e6, HOBBY);
        skip(MONTH / 3); // ten days of hobby ≈ $1.6667

        vm.prank(alice);
        billing.cancelAndWithdraw();

        uint256 expectedCharge = HOBBY_PRICE / 3;
        assertApproxEqAbs(usdc.balanceOf(alice), 1_000e6 - expectedCharge, 1e3);
        assertApproxEqAbs(billing.earned(), expectedCharge, 1e3);
        assertEq(billing.balanceOf(alice), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_cancelImmediatelyCostsAlmostNothing() public {
        _sub(alice, 20e6, HOBBY);
        vm.prank(alice);
        billing.cancelAndWithdraw();

        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(billing.earned(), 0);
    }

    function test_cancelKeepsBalanceWithdrawableLater() public {
        _sub(alice, 20e6, HOBBY);
        skip(MONTH);

        vm.prank(alice);
        billing.cancel();
        assertFalse(billing.isSubscribed(alice));

        uint256 left = billing.balanceOf(alice);
        assertApproxEqAbs(left, 20e6 - HOBBY_PRICE, 1e3);

        skip(365 days); // no further charges once cancelled
        assertEq(billing.balanceOf(alice), left);

        vm.prank(alice);
        billing.withdraw(left, alice);
        assertApproxEqAbs(usdc.balanceOf(alice), 1_000e6 - HOBBY_PRICE, 1e3);
    }

    function test_cancelRevertsIfNotSubscribed() public {
        _fund(alice, 10e6);
        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.cancel();
    }

    /*//////////////////////////////////////////////////////////////
                             PLAN SWITCHING
    //////////////////////////////////////////////////////////////*/

    function test_upgradeChargesOldPlanProRataThenNewRate() public {
        _sub(alice, 100e6, HOBBY);
        skip(MONTH); // $5 of hobby

        vm.prank(alice);
        billing.subscribe(PRO);
        assertApproxEqAbs(billing.earned(), HOBBY_PRICE, 1e3);

        skip(MONTH); // $20 of pro
        billing.settle(alice);
        assertApproxEqAbs(billing.earned(), uint256(HOBBY_PRICE) + PRO_PRICE, 1e3);
    }

    function test_downgradeTakesEffectImmediatelyWithNoLostCredit() public {
        _sub(alice, 100e6, PRO);
        skip(MONTH);

        vm.prank(alice);
        billing.subscribe(HOBBY);
        skip(MONTH);

        assertApproxEqAbs(billing.balanceOf(alice), 100e6 - PRO_PRICE - HOBBY_PRICE, 1e3);
    }

    function test_switchingToTheSamePlanReverts() public {
        _sub(alice, 100e6, HOBBY);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.AlreadyOnPlan.selector, HOBBY));
        billing.subscribe(HOBBY);
    }

    function test_subscribeToUnknownPlanReverts() public {
        _fund(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, uint32(7)));
        billing.subscribe(7);
    }

    function test_deactivatedPlanBlocksNewSignupsButNotExistingOnes() public {
        _sub(alice, 100e6, HOBBY);

        vm.prank(operator);
        billing.setPlanActive(HOBBY, false);

        _fund(bob, 100e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.PlanNotAvailable.selector, HOBBY));
        billing.subscribe(HOBBY);

        skip(MONTH);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_addingAPlanDoesNotRepriceLiveSubscribers() public {
        _sub(alice, 100e6, HOBBY);

        vm.prank(operator);
        uint32 newPlan = billing.addPlan(9e6);
        assertEq(newPlan, 2);

        skip(MONTH);
        billing.settle(alice);
        assertApproxEqAbs(billing.earned(), HOBBY_PRICE, 1e3); // still $5, not $9
    }

    /*//////////////////////////////////////////////////////////////
                         RUNNING OUT OF MONEY
    //////////////////////////////////////////////////////////////*/

    function test_subscriptionLapsesWhenTheBalanceRunsOut() public {
        _sub(alice, HOBBY_PRICE, HOBBY);
        assertTrue(billing.isSubscribed(alice));

        skip(MONTH + 1 days);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.balanceOf(alice), 0);
    }

    function test_lapsedAccountNeverGoesIntoDebt() public {
        _sub(alice, HOBBY_PRICE, HOBBY);
        skip(365 days);

        billing.settle(alice);
        assertEq(billing.earned(), HOBBY_PRICE); // exactly what was deposited, never more
        assertEq(billing.balanceOf(alice), 0);
    }

    /// The failure mode this design has to avoid: a customer lapses, comes back months later, tops
    /// up, and the top-up is instantly consumed paying for downtime they never received.
    function test_topUpAfterALapseIsNotEatenByTheGap() public {
        _sub(alice, HOBBY_PRICE, HOBBY);
        skip(MONTH + 180 days); // one month used, six months dark

        _fund(alice, 10e6);
        assertEq(billing.balanceOf(alice), 10e6); // the whole top-up survives
        assertTrue(billing.isSubscribed(alice)); // and service resumes

        skip(MONTH);
        assertApproxEqAbs(billing.balanceOf(alice), 10e6 - HOBBY_PRICE, 1e3);
        assertEq(billing.earned(), HOBBY_PRICE); // still only the one month consumed so far
    }

    function test_topUpExtendsExpiryWithoutTouchingThePlan() public {
        _sub(alice, HOBBY_PRICE, HOBBY);
        uint64 before = billing.expiresAt(alice);

        _fund(alice, HOBBY_PRICE);
        assertApproxEqAbs(billing.expiresAt(alice), uint256(before) + MONTH, 60);
        assertEq(billing.statusOf(alice).planId, HOBBY);
    }

    /*//////////////////////////////////////////////////////////////
                              WITHDRAWALS
    //////////////////////////////////////////////////////////////*/

    function test_withdrawWhileSubscribedShortensExpiry() public {
        _sub(alice, 20e6, HOBBY);
        uint64 before = billing.expiresAt(alice);

        vm.prank(alice);
        billing.withdraw(10e6, alice);

        assertLt(billing.expiresAt(alice), before);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_cannotWithdrawTimeAlreadyUsed() public {
        _sub(alice, 20e6, HOBBY);
        skip(MONTH);

        vm.prank(alice);
        vm.expectRevert();
        billing.withdraw(20e6, alice); // $5 of it is already spent

        vm.prank(alice);
        billing.withdraw(15e6, alice); // the unused remainder is fine
        assertApproxEqAbs(billing.balanceOf(alice), 0, 1e3);
    }

    function test_withdrawToAnotherAddress() public {
        _fund(alice, 30e6);
        vm.prank(alice);
        billing.withdraw(30e6, bob);
        assertEq(usdc.balanceOf(bob), 1_000e6 + 30e6);
    }

    /*//////////////////////////////////////////////////////////////
                           OPERATOR CONTROLS
    //////////////////////////////////////////////////////////////*/

    function test_operatorWithdrawsOnlySettledRevenue() public {
        _sub(alice, 100e6, HOBBY);
        skip(MONTH);

        vm.prank(operator);
        vm.expectRevert(); // nothing settled yet
        billing.withdrawEarnings(operator, 1e6);

        billing.settle(alice);
        uint256 revenue = billing.earned();

        vm.prank(operator);
        billing.withdrawEarnings(operator, revenue);
        assertApproxEqAbs(usdc.balanceOf(operator), HOBBY_PRICE, 1e3);
        assertEq(billing.earned(), 0);
    }

    function test_operatorCannotWithdrawCustomerFunds() public {
        _sub(alice, 500e6, HOBBY);
        skip(1 days);

        vm.prank(operator);
        vm.expectRevert();
        billing.withdrawEarnings(operator, 100e6);

        vm.prank(operator);
        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.sweepSurplus(operator); // customer balances are not surplus
    }

    function test_nonOwnerCannotAdminister() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.addPlan(1e6);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        billing.withdrawEarnings(alice, 0);
        vm.stopPrank();
    }

    function test_pauseStopsSignupsButNeverTrapsFunds() public {
        _sub(alice, 100e6, HOBBY);
        _fund(bob, 100e6);

        vm.prank(operator);
        billing.pause();

        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        billing.subscribe(HOBBY);

        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        billing.deposit(1e6);

        // Exits stay open while paused.
        vm.prank(bob);
        billing.withdraw(100e6, bob);
        vm.prank(alice);
        billing.cancelAndWithdraw();
        assertEq(billing.totalCustomerBalance(), 0);
    }

    function test_strayTransfersAreRecoverableAndOnlyThose() public {
        _sub(alice, 100e6, HOBBY);
        usdc.mint(address(billing), 42e6); // someone transferred in directly

        assertEq(billing.surplus(), 42e6);
        vm.prank(operator);
        billing.sweepSurplus(operator);

        assertEq(usdc.balanceOf(operator), 42e6);
        assertEq(billing.balanceOf(alice), 100e6);
    }

    function test_ownershipHandoverIsTwoStep() public {
        vm.prank(operator);
        billing.transferOwnership(alice);
        assertEq(billing.owner(), operator); // not yet

        vm.prank(alice);
        billing.acceptOwnership();
        assertEq(billing.owner(), alice);
    }

    /*//////////////////////////////////////////////////////////////
                            BACKEND READ PATH
    //////////////////////////////////////////////////////////////*/

    function test_statusOfReportsEverythingTheBackendNeeds() public {
        _sub(alice, 20e6, PRO);
        skip(MONTH / 2);

        ISubscriptionBilling.Status memory s = billing.statusOf(alice);
        assertTrue(s.subscribed);
        assertEq(s.planId, PRO);
        assertApproxEqAbs(s.accrued, PRO_PRICE / 2, 1e3);
        assertApproxEqAbs(s.balance, 20e6 - PRO_PRICE / 2, 1e3);
        assertEq(s.expiresAt, billing.expiresAt(alice));
    }

    function test_isSubscribedToPinsTheTier() public {
        _sub(alice, 100e6, HOBBY);
        assertTrue(billing.isSubscribedTo(alice, HOBBY));
        assertFalse(billing.isSubscribedTo(alice, PRO));
    }

    function test_unknownAddressIsNotSubscribed() public {
        address stranger = makeAddr("stranger");
        assertFalse(billing.isSubscribed(stranger));
        assertEq(billing.expiresAt(stranger), 0);
        assertEq(billing.balanceOf(stranger), 0);
    }

    function test_areSubscribedBatches() public {
        _sub(alice, 100e6, HOBBY);
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;

        bool[] memory out = billing.areSubscribed(users);
        assertTrue(out[0]);
        assertFalse(out[1]);
    }

    function test_settleManySweepsABatch() public {
        _sub(alice, 100e6, HOBBY);
        _sub(bob, 100e6, PRO);
        skip(MONTH);

        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        billing.settleMany(users);

        assertApproxEqAbs(billing.earned(), uint256(HOBBY_PRICE) + PRO_PRICE, 1e3);
    }

    /*//////////////////////////////////////////////////////////////
                                 PERMIT
    //////////////////////////////////////////////////////////////*/

    function test_depositWithPermitNeedsNoPriorApproval() public {
        (address carol, uint256 pk) = makeAddrAndKey("carol");
        usdc.mint(carol, 100e6);

        (uint8 v, bytes32 r, bytes32 s) = _signPermit(pk, carol, 50e6, block.timestamp + 1 hours);
        vm.prank(carol);
        billing.depositWithPermit(50e6, block.timestamp + 1 hours, v, r, s);

        assertEq(billing.balanceOf(carol), 50e6);
    }

    /// A griefer can front-run the permit; the deposit must still work off the allowance it set.
    function test_frontRunPermitDoesNotBlockTheDeposit() public {
        (address carol, uint256 pk) = makeAddrAndKey("carol");
        usdc.mint(carol, 100e6);
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _signPermit(pk, carol, 50e6, deadline);
        vm.prank(bob);
        usdc.permit(carol, address(billing), 50e6, deadline, v, r, s); // consumed by the attacker

        vm.prank(carol);
        billing.depositWithPermit(50e6, deadline, v, r, s);
        assertEq(billing.balanceOf(carol), 50e6);
    }

    function _signPermit(uint256 pk, address owner_, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner_,
                address(billing),
                value,
                usdc.nonces(owner_),
                deadline
            )
        );
        (v, r, s) = vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
    }

    /*//////////////////////////////////////////////////////////////
                                  FUZZ
    //////////////////////////////////////////////////////////////*/

    /// Cancelling always returns deposit minus exactly the time used, and never more than deposited.
    function testFuzz_refundIsDepositMinusTimeUsed(uint96 deposit_, uint32 elapsed, bool pro) public {
        uint32 planId = pro ? PRO : HOBBY;
        uint256 price = pro ? PRO_PRICE : HOBBY_PRICE;
        uint256 dep = bound(uint256(deposit_), price, 1_000_000e6);
        uint256 dt = bound(uint256(elapsed), 0, 400 days);

        usdc.mint(alice, dep);
        uint256 walletBefore = usdc.balanceOf(alice);

        vm.startPrank(alice);
        billing.depositAndSubscribe(dep, planId);
        skip(dt);
        billing.cancelAndWithdraw();
        vm.stopPrank();

        uint256 spent = walletBefore - usdc.balanceOf(alice);
        uint256 expected = (dt * price) / MONTH;
        if (expected > dep) expected = dep;

        assertLe(spent, dep, "charged more than was deposited");
        assertApproxEqAbs(spent, expected, 1e3, "charge does not match time used");
        assertEq(billing.earned(), spent, "revenue does not match what the customer paid");
    }

    /// Whatever the sequence of top-ups, the contract always holds at least what it owes.
    function testFuzz_solvencyAcrossTopUps(uint96[8] calldata amounts, uint32[8] calldata gaps) public {
        usdc.mint(alice, 10_000_000e6);
        vm.startPrank(alice);
        billing.depositAndSubscribe(PRO_PRICE, PRO);
        for (uint256 i; i < 8; ++i) {
            skip(bound(uint256(gaps[i]), 0, 90 days));
            uint256 amt = bound(uint256(amounts[i]), 1, 10_000e6);
            billing.deposit(amt);
            billing.settle(alice);
            assertGe(
                usdc.balanceOf(address(billing)),
                billing.totalCustomerBalance() + billing.earned(),
                "contract is short"
            );
        }
        vm.stopPrank();
    }
}
