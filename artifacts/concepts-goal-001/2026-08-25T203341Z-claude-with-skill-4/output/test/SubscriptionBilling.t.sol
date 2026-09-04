// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockERC20, FeeOnTransferERC20} from "./mocks/MockERC20.sol";

contract SubscriptionBillingTest is Test {
    SubscriptionBilling internal billing;
    MockERC20 internal usdc;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal randomer = makeAddr("randomer");

    uint8 internal constant HOBBY = 1;
    uint8 internal constant PRO = 2;
    uint64 internal constant HOBBY_PRICE = 5_000_000; // $5.00
    uint64 internal constant PRO_PRICE = 20_000_000; // $20.00

    uint256 internal PERIOD;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner, treasury);
        PERIOD = billing.PERIOD();

        vm.startPrank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, true, "hobby");
        billing.setPlan(PRO, PRO_PRICE, true, "pro");
        vm.stopPrank();

        // Start well clear of timestamp 0 so `startedAt` is a realistic value.
        vm.warp(1_800_000_000);

        _fund(alice, 1000e6);
        _fund(bob, 1000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _one(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    // ---------------------------------------------------------------------------------------
    // The core promise: prepay, get metered, get the remainder back.
    // ---------------------------------------------------------------------------------------

    function test_SubscribeThenExpiryIsProportionalToDeposit() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 15e6); // three months of hobby

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.expiresAt(alice), block.timestamp + 3 * PERIOD);
        assertEq(billing.refundableOf(alice), 15e6);
    }

    function test_SubscriptionLapsesWithNoTransaction() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);

        assertTrue(billing.isSubscribed(alice));

        // Nobody sends anything. Time is the only thing that happens.
        vm.warp(block.timestamp + PERIOD - 1);
        assertTrue(billing.isSubscribed(alice));

        vm.warp(block.timestamp + 1);
        assertFalse(billing.isSubscribed(alice), "expired without any transaction");
        assertEq(billing.refundableOf(alice), 0);
        assertEq(billing.pendingOf(alice), 5e6, "operator is owed the whole deposit");
    }

    function test_CancelRefundsUnusedProrated() public {
        vm.prank(alice);
        billing.subscribe(PRO, 60e6); // three months of pro

        vm.warp(block.timestamp + PERIOD / 2); // half a month in

        uint256 expectedSpend = PRO_PRICE / 2; // $10
        assertEq(billing.owedOf(alice), expectedSpend);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 refund = billing.cancel(alice);

        assertEq(refund, 60e6 - expectedSpend);
        assertEq(usdc.balanceOf(alice) - balBefore, refund);
        assertEq(billing.claimable(), expectedSpend);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.expiresAt(alice), 0);
    }

    function test_CancelToTheSecond() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);
        vm.warp(block.timestamp + 1); // one second of service

        vm.prank(alice);
        uint256 refund = billing.cancel(alice);

        // One second of a $5/30d plan is ~0.000001929 USDC, floored to 1 base unit.
        assertEq(5e6 - refund, (uint256(HOBBY_PRICE) * 1) / PERIOD);
        assertEq(5e6 - refund, 1);
    }

    function test_TopUpExtendsExpiry() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);
        uint256 firstExpiry = billing.expiresAt(alice);

        vm.warp(block.timestamp + PERIOD / 2);
        vm.prank(alice);
        billing.topUp(5e6);

        assertEq(billing.expiresAt(alice), firstExpiry + PERIOD);
    }

    function test_TopUpForSomeoneElse() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);

        vm.prank(bob);
        billing.topUpFor(alice, 10e6);

        assertEq(billing.refundableOf(alice), 15e6);
        assertEq(billing.expiresAt(alice), block.timestamp + 3 * PERIOD);
        // Bob paid; only Alice can pull it back out.
        assertEq(billing.refundableOf(bob), 0);
    }

    function test_PartialWithdrawShortensExpiry() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 15e6);

        vm.prank(alice);
        billing.withdraw(5e6, alice);

        assertEq(billing.expiresAt(alice), block.timestamp + 2 * PERIOD);
        assertTrue(billing.isSubscribed(alice));
    }

    function test_WithdrawCannotTakeMoneyAlreadySpent() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 10e6);
        vm.warp(block.timestamp + PERIOD); // $5 consumed

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InsufficientBalance.selector, 6e6, 5e6));
        billing.withdraw(6e6, alice);

        vm.prank(alice);
        billing.withdraw(5e6, alice);
        assertEq(billing.refundableOf(alice), 0);
    }

    // ---------------------------------------------------------------------------------------
    // Accrual is settle-frequency independent. This is what stops `settle` being a grief vector.
    // ---------------------------------------------------------------------------------------

    function test_SettlingEverySecondYieldsTheSameRevenue() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);
        vm.prank(bob);
        billing.subscribe(HOBBY, 5e6);

        uint256 start = block.timestamp;

        // A hostile stranger settles Alice once per second for 1000 seconds.
        for (uint256 i = 1; i <= 1000; ++i) {
            vm.warp(start + i);
            vm.prank(randomer);
            billing.settle(_one(alice));
        }
        // Bob is settled once, at the end.
        vm.prank(randomer);
        billing.settle(_one(bob));

        assertEq(billing.refundableOf(alice), billing.refundableOf(bob), "griefing changed nothing");
        assertEq(5e6 - billing.refundableOf(alice), (uint256(HOBBY_PRICE) * 1000) / PERIOD);
    }

    function testFuzz_SettleCadenceDoesNotChangeTotal(uint8 chunks, uint32 elapsed) public {
        chunks = uint8(bound(chunks, 1, 40));
        elapsed = uint32(bound(elapsed, 1, uint32(PERIOD)));

        vm.prank(alice);
        billing.subscribe(PRO, 20e6);
        vm.prank(bob);
        billing.subscribe(PRO, 20e6);

        uint256 start = block.timestamp;
        for (uint256 i = 1; i <= chunks; ++i) {
            vm.warp(start + (uint256(elapsed) * i) / chunks);
            billing.settle(_one(alice));
        }
        vm.warp(start + elapsed);
        billing.settle(_one(alice));
        billing.settle(_one(bob));

        assertEq(billing.refundableOf(alice), billing.refundableOf(bob));
    }

    function test_SettleIsPermissionlessAndOnlyMovesMoneyOneWay() public {
        vm.prank(alice);
        billing.subscribe(PRO, 20e6);
        vm.warp(block.timestamp + PERIOD / 4);

        uint256 expiryBefore = billing.expiresAt(alice);

        vm.prank(randomer);
        uint256 settled = billing.settle(_one(alice));

        assertEq(settled, PRO_PRICE / 4);
        assertEq(billing.claimable(), PRO_PRICE / 4);
        assertEq(billing.expiresAt(alice), expiryBefore, "settling must not change a user's expiry");
        assertTrue(billing.isSubscribed(alice), "settling must not cut anybody off");
    }

    function test_CollectIsPermissionlessButOnlyPaysTheRecipient() public {
        vm.prank(alice);
        billing.subscribe(PRO, 20e6);
        vm.warp(block.timestamp + PERIOD);

        address[] memory accts = new address[](1);
        accts[0] = alice;

        vm.prank(randomer);
        (uint256 settled, uint256 collected) = billing.settleAndCollect(accts);

        assertEq(settled, 20e6);
        assertEq(collected, 20e6);
        assertEq(usdc.balanceOf(treasury), 20e6);
        assertEq(usdc.balanceOf(randomer), 0, "caller gets nothing but the satisfaction");
        assertEq(billing.claimable(), 0);
    }

    function test_NeverSettlingHarmsNobody() public {
        vm.prank(alice);
        billing.subscribe(PRO, 40e6);

        // Two years pass with no maintenance transaction of any kind.
        vm.warp(block.timestamp + 730 days);

        // Alice's access ended on schedule, and the operator's money is still there.
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.pendingOf(alice), 40e6);

        billing.settle(_one(alice));
        billing.collect();
        assertEq(usdc.balanceOf(treasury), 40e6);
    }

    // ---------------------------------------------------------------------------------------
    // Lapse and resume
    // ---------------------------------------------------------------------------------------

    function test_LapsedAccountIsNotChargedArrearsOnTopUp() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);

        // Runs out after a month, then does nothing for six months.
        vm.warp(block.timestamp + 7 * PERIOD);
        assertFalse(billing.isSubscribed(alice));

        vm.prank(alice);
        billing.topUp(5e6);

        // A full month of service from now — not instantly eaten by six months of "arrears".
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.refundableOf(alice), 5e6);
        assertEq(billing.expiresAt(alice), block.timestamp + PERIOD);
    }

    function test_LapsedThenCancelRefundsNothingAndClears() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);
        vm.warp(block.timestamp + 3 * PERIOD);

        vm.prank(alice);
        uint256 refund = billing.cancel(alice);
        assertEq(refund, 0);
        assertEq(billing.pendingOf(alice), 0);
        assertEq(billing.claimable(), 5e6);
    }

    // ---------------------------------------------------------------------------------------
    // Plans
    // ---------------------------------------------------------------------------------------

    function test_ChangePlanCarriesTheRemainderAtTheNewRate() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 10e6); // two hobby months

        vm.warp(block.timestamp + PERIOD); // one month used, $5 left
        vm.prank(alice);
        billing.changePlan(PRO);

        assertEq(billing.claimable(), 5e6);
        assertEq(billing.refundableOf(alice), 5e6);
        // $5 left at $20/month is a quarter of a month.
        assertEq(billing.expiresAt(alice), block.timestamp + PERIOD / 4);
    }

    function test_PriceChangeDoesNotTouchExistingSubscribers() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);
        uint256 expiryBefore = billing.expiresAt(alice);

        vm.prank(owner);
        billing.setPlan(HOBBY, 500_000_000, true, "hobby"); // owner tries $500/month

        assertEq(billing.expiresAt(alice), expiryBefore, "grandfathered rate must hold");
        vm.warp(block.timestamp + PERIOD - 1);
        assertTrue(billing.isSubscribed(alice));
        // Still billed at the old $5/month: one second of runway left, not $500 of arrears.
        assertEq(billing.refundableOf(alice), 5e6 - (uint256(HOBBY_PRICE) * (PERIOD - 1)) / PERIOD);
        assertEq(billing.refundableOf(alice), 2);
    }

    function test_DeactivatingAPlanDoesNotEvictItsSubscribers() public {
        vm.prank(alice);
        billing.subscribe(HOBBY, 5e6);

        vm.prank(owner);
        billing.setPlan(HOBBY, HOBBY_PRICE, false, "hobby");

        assertTrue(billing.isSubscribed(alice));

        // Existing subscriber can still top up and still cancel.
        vm.prank(alice);
        billing.topUp(5e6);
        vm.prank(alice);
        billing.cancel(alice);

        // But nobody new can join.
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.PlanInactive.selector, HOBBY));
        billing.subscribe(HOBBY, 5e6);
    }

    function test_UnknownPlanReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.InvalidPlan.selector, uint8(9)));
        billing.subscribe(9, 5e6);
    }

    function test_CannotSubscribeTwice() public {
        vm.startPrank(alice);
        billing.subscribe(HOBBY, 5e6);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.AlreadySubscribed.selector, HOBBY));
        billing.subscribe(PRO, 5e6);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------------------------
    // What the operator can and cannot do
    // ---------------------------------------------------------------------------------------

    function test_OwnerCannotTouchUserDeposits() public {
        vm.prank(alice);
        billing.subscribe(PRO, 100e6);

        vm.prank(owner);
        uint256 swept = billing.sweepSurplus(owner);
        assertEq(swept, 0, "nothing to sweep: it is all user money");
        assertEq(usdc.balanceOf(owner), 0);

        // And Alice can still get every cent back.
        vm.prank(alice);
        assertEq(billing.cancel(alice), 100e6);
    }

    function test_SweepSurplusOnlyTakesStrayTokens() public {
        vm.prank(alice);
        billing.subscribe(PRO, 100e6);
        usdc.mint(address(billing), 7e6); // someone fat-fingers a transfer

        vm.prank(owner);
        assertEq(billing.sweepSurplus(owner), 7e6);
        assertEq(usdc.balanceOf(owner), 7e6);

        vm.prank(alice);
        assertEq(billing.cancel(alice), 100e6);
    }

    function test_RescueTokenCannotTouchTheBillingToken() public {
        vm.prank(owner);
        vm.expectRevert(SubscriptionBilling.CannotRescueBillingToken.selector);
        billing.rescueToken(IERC20(address(usdc)), owner, 1);
    }

    function test_OnlyOwnerGates() public {
        vm.prank(randomer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, randomer));
        billing.setPlan(3, 1e6, true, "x");

        vm.prank(randomer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, randomer));
        billing.setRevenueRecipient(randomer);
    }

    function test_LostOwnerKeyDoesNotTrapAnybody() public {
        vm.prank(alice);
        billing.subscribe(PRO, 40e6);
        vm.warp(block.timestamp + PERIOD);

        // Pretend the owner key is gone: no setPlan, no setRevenueRecipient ever again.
        // Users can still be served, still top up, still leave with their money.
        vm.prank(alice);
        billing.topUp(20e6);
        vm.prank(bob);
        billing.subscribe(HOBBY, 5e6);
        vm.prank(alice);
        uint256 refund = billing.cancel(alice);
        assertEq(refund, 40e6 + 20e6 - 20e6);

        // And revenue still reaches the recipient set before the key was lost.
        vm.prank(randomer);
        billing.collect();
        assertEq(usdc.balanceOf(treasury), 20e6);
    }

    function test_OwnershipTransferIsTwoStep() public {
        vm.prank(owner);
        billing.transferOwnership(bob);
        assertEq(billing.owner(), owner, "not until accepted");

        vm.prank(bob);
        billing.acceptOwnership();
        assertEq(billing.owner(), bob);
    }

    // ---------------------------------------------------------------------------------------
    // Solvency
    // ---------------------------------------------------------------------------------------

    function test_ContractIsAlwaysSolvent() public {
        vm.prank(alice);
        billing.subscribe(PRO, 100e6);
        vm.prank(bob);
        billing.subscribe(HOBBY, 30e6);

        for (uint256 i; i < 12; ++i) {
            vm.warp(block.timestamp + PERIOD / 3);
            address[] memory accts = new address[](2);
            (accts[0], accts[1]) = (alice, bob);
            billing.settle(accts);
            _assertSolvent();
            if (i == 4) {
                vm.prank(alice);
                billing.topUp(50e6);
            }
            if (i == 6) billing.collect();
            _assertSolvent();
        }

        vm.prank(alice);
        billing.cancel(alice);
        vm.prank(bob);
        billing.cancel(bob);
        billing.collect();
        _assertSolvent();

        assertEq(usdc.balanceOf(address(billing)), 0, "everything found an owner");
    }

    function _assertSolvent() internal view {
        uint256 held = usdc.balanceOf(address(billing));
        uint256 owed = billing.totalUserBalance() + billing.claimable();
        assertGe(held, owed, "contract cannot pay what it owes");
    }

    function testFuzz_RefundPlusRevenueEqualsDeposit(uint96 deposit, uint32 wait) public {
        deposit = uint96(bound(deposit, 1, 1_000_000e6));
        wait = uint32(bound(wait, 0, 400 days));
        usdc.mint(alice, deposit);

        vm.prank(alice);
        billing.subscribe(PRO, deposit);
        vm.warp(block.timestamp + wait);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 refund = billing.cancel(alice);
        billing.collect();

        assertEq(usdc.balanceOf(alice) - balBefore, refund);
        assertEq(refund + usdc.balanceOf(treasury), deposit, "not a cent created or destroyed");
        assertEq(usdc.balanceOf(address(billing)), 0);
    }

    function test_FeeOnTransferTokenDoesNotOverCredit() public {
        FeeOnTransferERC20 weird = new FeeOnTransferERC20(100); // 1%
        SubscriptionBilling b2 = new SubscriptionBilling(IERC20(address(weird)), owner, treasury);
        vm.prank(owner);
        b2.setPlan(HOBBY, HOBBY_PRICE, true, "hobby");

        weird.mint(alice, 100e6);
        vm.startPrank(alice);
        weird.approve(address(b2), type(uint256).max);
        b2.subscribe(HOBBY, 10e6);
        vm.stopPrank();

        assertEq(b2.refundableOf(alice), 9.9e6, "credited what actually arrived");
        assertLe(b2.totalUserBalance(), weird.balanceOf(address(b2)));
    }

    // ---------------------------------------------------------------------------------------
    // Reads the backend depends on
    // ---------------------------------------------------------------------------------------

    function test_StatusOfMatchesIndividualGetters() public {
        vm.prank(alice);
        billing.subscribe(PRO, 25e6);
        vm.warp(block.timestamp + PERIOD / 8);

        (bool subscribed, uint8 planId, uint256 expiry, uint256 refundable, uint64 rate) = billing.statusOf(alice);
        assertEq(subscribed, billing.isSubscribed(alice));
        assertEq(planId, PRO);
        assertEq(expiry, billing.expiresAt(alice));
        assertEq(refundable, billing.refundableOf(alice));
        assertEq(rate, PRO_PRICE);
    }

    function test_UnknownAddressIsCleanlyNotSubscribed() public view {
        assertFalse(billing.isSubscribed(randomer));
        assertEq(billing.expiresAt(randomer), 0);
        assertEq(billing.owedOf(randomer), 0);
        assertEq(billing.refundableOf(randomer), 0);
    }

    function test_PendingOfManyPricesASweep() public {
        vm.prank(alice);
        billing.subscribe(PRO, 20e6);
        vm.prank(bob);
        billing.subscribe(HOBBY, 5e6);
        vm.warp(block.timestamp + PERIOD / 2);

        address[] memory accts = new address[](3);
        (accts[0], accts[1], accts[2]) = (alice, bob, randomer);
        assertEq(billing.pendingOfMany(accts), 10e6 + 2.5e6);
    }
}
