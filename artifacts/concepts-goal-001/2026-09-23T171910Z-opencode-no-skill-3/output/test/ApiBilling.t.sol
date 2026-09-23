// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ApiBilling, IERC20} from "../src/ApiBilling.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function deal(address, uint256) external;
    function expectRevert(bytes4) external;
    function toString(uint256) external view returns (string memory);
}

address constant VM_ADDR = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D;

contract ApiBillingTest {
    Vm constant vm = Vm(VM_ADDR);

    uint256 constant HOBBY_FEE = 5e6;
    uint256 constant PRO_FEE = 20e6;
    uint256 constant MONTH = 30 days;

    MockUSDC usdc;
    ApiBilling billing;

    address owner;
    address alice;
    address bob;
    address carol;
    address keeper;
    address sink;

    function setUp() public {
        owner = _addr("owner");
        alice = _addr("alice");
        bob = _addr("bob");
        carol = _addr("carol");
        keeper = _addr("keeper");
        sink = _addr("sink");
        usdc = new MockUSDC();
        billing = new ApiBilling(owner, IERC20(address(usdc)), HOBBY_FEE, PRO_FEE);
        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);
        usdc.mint(carol, 1000e6);
    }

    function _addr(string memory s) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(s)))));
    }

    function _fund(address user, uint256 amount) internal {
        vm.startPrank(user);
        usdc.approve(address(billing), type(uint256).max);
        billing.topUp(amount);
        vm.stopPrank();
    }

    function _subscribe(address user, uint8 planId, uint256 amount) internal {
        _fund(user, amount);
        vm.prank(user);
        billing.subscribe(planId);
    }

    function assertEq(address a, address b, string memory label) internal {
        if (a != b) {
            revert(
                string.concat(
                    label,
                    ": ",
                    vm.toString(uint256(uint160(a))),
                    " != ",
                    vm.toString(uint256(uint160(b)))
                )
            );
        }
    }

    function assertEq(uint256 a, uint256 b, string memory label) internal {
        if (a != b) revert(string.concat(label, ": ", vm.toString(a), " != ", vm.toString(b)));
    }

    function assertTrue(bool c, string memory label) internal {
        if (!c) revert(label);
    }

    function assertFalse(bool c, string memory label) internal {
        if (c) revert(label);
    }

    function assertGe(uint256 a, uint256 b, string memory label) internal {
        if (a < b) revert(string.concat(label, ": ", vm.toString(a), " < ", vm.toString(b)));
    }

    function test_PlansConfigured() public {
        assertEq(billing.planFees(1), HOBBY_FEE, "hobby fee");
        assertEq(billing.planFees(2), PRO_FEE, "pro fee");
        assertEq(billing.owner(), owner, "owner");
        assertEq(address(billing.usdc()), address(usdc), "usdc");
        assertEq(billing.PERIOD(), MONTH, "period");
        assertEq(billing.MAX_PREPAID_MONTHS(), 12, "prepay cap");
        assertEq(billing.totalUserFunds(), 0, "user funds start zero");
        assertEq(billing.revenueAvailable(), 0, "revenue starts zero");
    }

    function test_RevertWhen_TopUpZero() public {
        vm.prank(alice);
        usdc.approve(address(billing), type(uint256).max);
        vm.prank(alice);
        vm.expectRevert(ApiBilling.ZeroAmount.selector);
        billing.topUp(0);
    }

    function test_RevertWhen_TopUpWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert(ApiBilling.TokenTransferFailed.selector);
        billing.topUp(HOBBY_FEE);
    }

    function test_TopUp_CreditsAccount() public {
        _fund(alice, 7e6);
        (, , uint16 paidPeriods, uint256 credit) = billing.getSubscription(alice);
        assertEq(credit, 7e6, "credit");
        assertEq(uint256(paidPeriods), 0, "paid periods");
        assertEq(billing.totalUserFunds(), 7e6, "user funds");
        assertEq(usdc.balanceOf(address(billing)), 7e6, "contract balance");
        assertEq(billing.revenueAvailable(), 0, "no revenue yet");
        assertFalse(billing.isSubscribed(alice), "topping up alone does not subscribe");
    }

    function test_RevertWhen_SubscribeInvalidPlan() public {
        _fund(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert(ApiBilling.PlanInvalid.selector);
        billing.subscribe(0);
        vm.prank(alice);
        vm.expectRevert(ApiBilling.PlanInvalid.selector);
        billing.subscribe(3);
    }

    function test_RevertWhen_SubscribeWithoutEnoughCredit() public {
        _fund(alice, 4e6);
        vm.prank(alice);
        vm.expectRevert(ApiBilling.InsufficientCredit.selector);
        billing.subscribe(2);
    }

    function test_Subscribe_ChargesFirstMonth() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, HOBBY_FEE);
        (uint8 planId, uint64 until, uint16 paidPeriods, uint256 credit) = billing.getSubscription(
            alice
        );
        assertEq(uint256(planId), 1, "plan");
        assertEq(uint256(until), start + MONTH, "subscribed until");
        assertEq(uint256(paidPeriods), 1, "paid periods");
        assertEq(credit, 0, "credit spent");
        assertTrue(billing.isSubscribed(alice), "subscribed");
        assertEq(billing.totalUserFunds(), HOBBY_FEE, "user funds hold prepaid month");
        assertEq(billing.revenueAvailable(), 0, "revenue only after lapse or cancel");
    }

    function test_Subscribe_PrepaysUpToCap() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, 100e6);
        (, uint64 until, uint16 paidPeriods, uint256 credit) = billing.getSubscription(alice);
        assertEq(uint256(paidPeriods), 12, "capped at 12 months");
        assertEq(uint256(until), start + 12 * MONTH, "until cap");
        assertEq(credit, 100e6 - 12 * HOBBY_FEE, "leftover credit stays withdrawable");
        assertEq(
            billing.totalUserFunds(),
            100e6,
            "user funds equal credit plus prepaid months"
        );
    }

    function test_RevertWhen_SubscribeWhileActive() public {
        _subscribe(alice, 1, HOBBY_FEE);
        vm.prank(alice);
        vm.expectRevert(ApiBilling.AlreadySubscribed.selector);
        billing.subscribe(1);
    }

    function test_IsSubscribed_ExpiresExactlyAtBoundary() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, HOBBY_FEE);
        assertTrue(billing.isSubscribed(alice), "subscribed");
        vm.warp(start + MONTH - 1);
        assertTrue(billing.isSubscribed(alice), "last second still subscribed");
        vm.warp(start + MONTH);
        assertFalse(billing.isSubscribed(alice), "expires exactly at boundary");
    }

    function test_TopUp_ExtendsActiveSubscription() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, HOBBY_FEE);
        _fund(alice, 15e6);
        (, uint64 until, uint16 paidPeriods, uint256 credit) = billing.getSubscription(alice);
        assertEq(uint256(paidPeriods), 4, "three more months prepaid");
        assertEq(uint256(until), start + 4 * MONTH, "runway");
        assertEq(credit, 0, "credit consumed");
        assertEq(billing.totalUserFunds(), 20e6, "user funds");
    }

    function test_TopUp_DoesNotResurrectLapsedSubscription() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, HOBBY_FEE);
        vm.warp(start + MONTH + 10 days);
        assertFalse(billing.isSubscribed(alice), "lapsed");
        _fund(alice, HOBBY_FEE);
        assertFalse(billing.isSubscribed(alice), "no auto-resume after lapse");
        (, , uint16 paidPeriods, uint256 credit) = billing.getSubscription(alice);
        assertEq(uint256(paidPeriods), 0, "lapsed periods settled on top up");
        assertEq(credit, HOBBY_FEE, "credit");
        assertEq(billing.totalUserFunds(), HOBBY_FEE, "only credit left");
        assertEq(billing.revenueAvailable(), HOBBY_FEE, "expired month released");
        vm.prank(alice);
        billing.subscribe(1);
        assertTrue(billing.isSubscribed(alice), "explicit resubscribe works");
    }

    function test_Cancel_ImmediateFullRefund() public {
        _subscribe(alice, 1, HOBBY_FEE);
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 1000e6, "full month back same block");
        assertEq(usdc.balanceOf(address(billing)), 0, "contract empty");
        assertEq(billing.totalUserFunds(), 0, "user funds zero");
        assertEq(billing.revenueAvailable(), 0, "no revenue earned");
        assertFalse(billing.isSubscribed(alice), "no longer subscribed");
        (uint8 planId, , uint16 paidPeriods, uint256 credit) = billing.getSubscription(alice);
        assertEq(uint256(planId), 0, "reset plan");
        assertEq(uint256(paidPeriods), 0, "reset periods");
        assertEq(credit, 0, "reset credit");
        _subscribe(alice, 1, HOBBY_FEE);
        assertTrue(billing.isSubscribed(alice), "can resubscribe");
    }

    function test_Cancel_ProrataMidPeriod() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, HOBBY_FEE);
        vm.warp(start + 10 days);
        vm.prank(alice);
        billing.cancel();
        uint256 expected = (HOBBY_FEE * 20 days) / MONTH;
        assertEq(expected, 3333333, "expected prorata");
        assertEq(usdc.balanceOf(alice), 995e6 + expected, "alice refund");
        assertEq(usdc.balanceOf(address(billing)), HOBBY_FEE - expected, "contract keeps earned part");
        assertEq(billing.totalUserFunds(), 0, "user funds zero");
        assertEq(billing.revenueAvailable(), HOBBY_FEE - expected, "earned revenue visible");
        assertFalse(billing.isSubscribed(alice), "no longer subscribed");
    }

    function test_Cancel_MultiMonthPrepaid() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, 60e6);
        (, uint64 until, uint16 paidPeriods, ) = billing.getSubscription(alice);
        assertEq(uint256(paidPeriods), 12, "12 prepaid");
        assertEq(uint256(until), start + 360 days, "one year runway");
        vm.warp(start + 100 days);
        vm.prank(alice);
        billing.cancel();
        uint256 expected = (HOBBY_FEE * 260 days) / MONTH;
        assertEq(expected, 43333333, "expected refund");
        assertEq(usdc.balanceOf(alice), 940e6 + expected, "alice refund");
        assertEq(billing.revenueAvailable(), 60e6 - expected, "earned revenue");
        assertEq(billing.totalUserFunds(), 0, "user funds zero");
    }

    function test_Cancel_AfterLapseWithoutPriorSettle() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, 20e6);
        (, , uint16 paidPeriods, uint256 credit) = billing.getSubscription(alice);
        assertEq(uint256(paidPeriods), 4, "4 prepaid");
        assertEq(credit, 0, "credit");
        vm.warp(start + 200 days);
        assertFalse(billing.isSubscribed(alice), "lapsed");
        assertEq(billing.revenueAvailable(), 0, "revenue lazy until settle");
        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 980e6, "nothing left to refund");
        assertEq(billing.revenueAvailable(), 20e6, "cancel settled the lapse");
        assertEq(billing.totalUserFunds(), 0, "user funds zero");
        assertFalse(billing.isSubscribed(alice), "still not subscribed");
    }

    function test_RevertWhen_CancelWithNothing() public {
        vm.prank(bob);
        vm.expectRevert(ApiBilling.NothingToCancel.selector);
        billing.cancel();
    }

    function test_Withdraw_CreditOnly() public {
        _fund(alice, 10e6);
        vm.prank(alice);
        billing.withdraw(4e6);
        (, , , uint256 credit) = billing.getSubscription(alice);
        assertEq(credit, 6e6, "credit after withdraw");
        assertEq(usdc.balanceOf(alice), 994e6, "usdc back");
        assertEq(billing.totalUserFunds(), 6e6, "user funds");
        vm.prank(alice);
        vm.expectRevert(ApiBilling.InsufficientCredit.selector);
        billing.withdraw(7e6);
    }

    function test_Withdraw_AllCreditWhileSubscribed() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, 65e6);
        (, uint64 until, uint16 paidPeriods, uint256 credit) = billing.getSubscription(alice);
        assertEq(uint256(paidPeriods), 12, "twelve months prepaid");
        assertEq(credit, 5e6, "credit beyond prepay cap");
        assertEq(uint256(until), start + 360 days, "runway");
        vm.prank(alice);
        billing.withdraw(5e6);
        assertTrue(billing.isSubscribed(alice), "still subscribed after withdraw");
        (, , , credit) = billing.getSubscription(alice);
        assertEq(credit, 0, "credit drained");
        assertEq(billing.totalUserFunds(), 60e6, "prepaid months still reserved");
        assertEq(billing.revenueAvailable(), 0, "nothing earned yet");
        vm.warp(start + 360 days + 1);
        assertFalse(billing.isSubscribed(alice), "no renewal without credit");
    }

    function test_Settle_ReleasesLapsedRevenueAndIsPermissionless() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, HOBBY_FEE);
        vm.warp(start + MONTH + 5 days);
        assertEq(billing.revenueAvailable(), 0, "lazy until settle");
        vm.prank(keeper);
        billing.settle(alice);
        assertEq(billing.revenueAvailable(), HOBBY_FEE, "revenue released");
        assertEq(billing.totalUserFunds(), 0, "user funds zero");
        (, , uint16 paidPeriods, ) = billing.getSubscription(alice);
        assertEq(uint256(paidPeriods), 0, "periods cleared");
        assertFalse(billing.isSubscribed(alice), "lapsed");
        vm.prank(owner);
        billing.withdrawRevenue(sink, HOBBY_FEE);
        assertEq(usdc.balanceOf(sink), HOBBY_FEE, "revenue paid out");
        assertEq(usdc.balanceOf(address(billing)), 0, "contract empty");
        assertEq(billing.revenueAvailable(), 0, "no revenue left");
    }

    function test_Settle_NoopWhileActiveWithoutCredit() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, 10e6);
        vm.warp(start + 40 days);
        assertTrue(billing.isSubscribed(alice), "inside second prepaid month");
        vm.prank(keeper);
        billing.settle(alice);
        assertTrue(billing.isSubscribed(alice), "still subscribed");
        (, uint64 until, uint16 paidPeriods, uint256 credit) = billing.getSubscription(alice);
        assertEq(uint256(paidPeriods), 2, "two prepaid months");
        assertEq(uint256(until), start + 2 * MONTH, "until");
        assertEq(credit, 0, "no credit to spend");
        assertEq(billing.totalUserFunds(), 10e6, "user funds unchanged");
    }

    function test_SettleMany_BatchesUsers() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, HOBBY_FEE);
        _subscribe(bob, 2, PRO_FEE);
        vm.warp(start + MONTH + 1 days);
        address[] memory users = new address[](4);
        users[0] = alice;
        users[1] = bob;
        users[2] = carol;
        users[3] = keeper;
        vm.prank(keeper);
        billing.settleMany(users);
        assertEq(billing.revenueAvailable(), HOBBY_FEE + PRO_FEE, "revenue released for both");
        assertEq(billing.totalUserFunds(), 0, "user funds zero");
    }

    function test_RevertWhen_WithdrawRevenueByNonOwner() public {
        vm.prank(keeper);
        vm.expectRevert(ApiBilling.NotOwner.selector);
        billing.withdrawRevenue(keeper, 1);
    }

    function test_RevertWhen_WithdrawRevenueOverAvailable() public {
        _fund(alice, 7e6);
        assertEq(billing.revenueAvailable(), 0, "customer credit is not revenue");
        vm.prank(owner);
        vm.expectRevert(ApiBilling.InsufficientRevenue.selector);
        billing.withdrawRevenue(owner, 1);
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        billing.transferOwnership(bob);
        assertEq(billing.owner(), bob, "new owner");
        vm.prank(owner);
        vm.expectRevert(ApiBilling.NotOwner.selector);
        billing.withdrawRevenue(owner, 1);
        vm.prank(owner);
        vm.expectRevert(ApiBilling.NotOwner.selector);
        billing.transferOwnership(alice);
        vm.prank(bob);
        vm.expectRevert(ApiBilling.InsufficientRevenue.selector);
        billing.withdrawRevenue(bob, 1);
        vm.prank(bob);
        vm.expectRevert(ApiBilling.ZeroAddress.selector);
        billing.transferOwnership(address(0));
    }

    function test_RevertWhen_EthSentToContract() public {
        vm.deal(address(this), 1 ether);
        (bool ok, ) = address(billing).call{value: 1 ether}("");
        assertFalse(ok, "contract rejects plain eth transfers");
    }

    function test_PlanSwitchViaCancelAndResubscribe() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, 25e6);
        vm.warp(start + 5 days);
        vm.prank(alice);
        billing.cancel();
        uint256 expected = 20e6 + (HOBBY_FEE * 25 days) / MONTH;
        assertEq(usdc.balanceOf(alice), 975e6 + expected, "refund after switch-cancel");
        assertEq(billing.revenueAvailable(), 25e6 - expected, "earned part");
        _fund(alice, PRO_FEE);
        vm.prank(alice);
        billing.subscribe(2);
        (uint8 planId, uint64 until, uint16 paidPeriods, uint256 credit) = billing.getSubscription(
            alice
        );
        assertEq(uint256(planId), 2, "pro plan");
        assertEq(uint256(paidPeriods), 1, "one pro month");
        assertEq(uint256(until), start + 5 days + MONTH, "pro until");
        assertEq(credit, 0, "credit spent");
        assertTrue(billing.isSubscribed(alice), "subscribed to pro");
    }

    function test_GetSubscriptionFields() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 2, 25e6);
        (uint8 planId, uint64 until, uint16 paidPeriods, uint256 credit) = billing.getSubscription(
            alice
        );
        assertEq(uint256(planId), 2, "plan");
        assertEq(uint256(until), start + MONTH, "until");
        assertEq(uint256(paidPeriods), 1, "periods");
        assertEq(credit, 5e6, "credit");
        (, , , uint256 strangerCredit) = billing.getSubscription(bob);
        assertEq(strangerCredit, 0, "stranger credit");
        assertFalse(billing.isSubscribed(bob), "stranger not subscribed");
    }

    function test_Invariant_BalanceAlwaysCoversUserFunds() public {
        uint256 start = block.timestamp;
        _subscribe(alice, 1, 60e6);
        assertGe(usdc.balanceOf(address(billing)), billing.totalUserFunds(), "after prepay");
        assertEq(billing.totalUserFunds(), 60e6, "prepaid escrowed");
        vm.warp(start + 400 days);
        vm.prank(keeper);
        billing.settle(alice);
        assertGe(usdc.balanceOf(address(billing)), billing.totalUserFunds(), "after settle");
        assertEq(billing.totalUserFunds(), 0, "alice settled");
        assertEq(billing.revenueAvailable(), 60e6, "revenue after settle");
        _subscribe(bob, 2, 30e6);
        assertGe(usdc.balanceOf(address(billing)), billing.totalUserFunds(), "after bob joins");
        assertEq(billing.totalUserFunds(), 30e6, "bob credit plus period");
        vm.warp(start + 415 days);
        vm.prank(bob);
        billing.cancel();
        assertGe(usdc.balanceOf(address(billing)), billing.totalUserFunds(), "after bob cancels");
        assertEq(billing.totalUserFunds(), 0, "bob settled via cancel");
        assertEq(billing.revenueAvailable(), 70e6, "settled revenue only");
        assertEq(usdc.balanceOf(address(billing)), 70e6, "balance matches");
    }
}
