// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import {BillingTest} from "./Base.t.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {ISubscriptionBilling} from "../src/ISubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @notice Covers the parts of the API the happy-path tests do not reach:
/// permit deposits, batch settlement, the small read helpers, and the
/// argument-validation reverts.
contract SurfaceTest is BillingTest {
    function test_depositWithPermit_needsNoPriorApproval() public {
        (address carol, uint256 pk) = makeAddrAndKey("carol");
        usdc.mint(carol, 50e6);

        bytes32 digest = _permitDigest(carol, address(billing), 50e6, 0, type(uint256).max);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);

        vm.prank(carol);
        billing.depositWithPermit(carol, 50e6, type(uint256).max, v, r, s);

        assertEq(billing.statusOf(carol).credit, 50e6);
        assertEq(usdc.allowance(carol, address(billing)), 0, "allowance was consumed");
        assertSolvent();
    }

    /// @dev A griefer can front-run the permit with the same signature, spending
    /// the nonce. The deposit must still go through on the allowance it created,
    /// rather than reverting on the replayed permit.
    function test_depositWithPermit_survivesAFrontRunPermit() public {
        (address carol, uint256 pk) = makeAddrAndKey("carol");
        usdc.mint(carol, 50e6);

        bytes32 digest = _permitDigest(carol, address(billing), 50e6, 0, type(uint256).max);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);

        vm.prank(bob); // griefer submits the permit first
        usdc.permit(carol, address(billing), 50e6, type(uint256).max, v, r, s);

        vm.prank(carol);
        billing.depositWithPermit(carol, 50e6, type(uint256).max, v, r, s);
        assertEq(billing.statusOf(carol).credit, 50e6, "deposit still landed");
    }

    function test_settleMany() public {
        fund(alice, 30e6);
        fund(bob, 60e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);
        vm.prank(bob);
        billing.subscribe(PRO);

        vm.warp(block.timestamp + 2 * billing.PERIOD());

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        assertEq(billing.accruedIncluding(accounts), 2 * HOBBY_PRICE + 2 * PRO_PRICE);
        billing.settleMany(accounts);
        assertEq(billing.merchantAccrued(), 2 * HOBBY_PRICE + 2 * PRO_PRICE);
        // Once settled, the projection adds nothing further.
        assertEq(billing.accruedIncluding(accounts), billing.merchantAccrued());
        assertSolvent();
    }

    function test_settleManyToleratesUnknownAccounts() public {
        address[] memory accounts = new address[](2);
        accounts[0] = alice; // never deposited
        accounts[1] = address(0xdead);
        billing.settleMany(accounts);
        assertEq(billing.merchantAccrued(), 0);
    }

    function test_entitlementOf() public {
        (bool active, uint8 plan) = billing.entitlementOf(alice);
        assertFalse(active);
        assertEq(plan, 0);

        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(PRO);

        (active, plan) = billing.entitlementOf(alice);
        assertTrue(active);
        assertEq(plan, PRO, "gateway can rate-limit by tier");
    }

    /// @dev `rawSubscription` deliberately does NOT project; it is the stored
    /// record. This is what makes it useful for debugging a settlement.
    function test_rawSubscriptionIsUnprojected() public {
        fund(alice, 30e6);
        vm.prank(alice);
        billing.subscribe(HOBBY);
        uint256 start = block.timestamp;

        vm.warp(start + 2 * billing.PERIOD());

        SubscriptionBilling.Subscription memory raw = billing.rawSubscription(alice);
        assertEq(raw.periodStart, start, "raw state is still at the original period");
        assertEq(raw.credit, 25e6);
        assertEq(billing.statusOf(alice).credit, 15e6, "projected state has renewed twice");

        billing.settle(alice);
        assertEq(billing.rawSubscription(alice).credit, 15e6, "settlement writes it down");
    }

    function test_plansView() public {
        SubscriptionBilling.Plan memory plan = billing.plans(PRO);
        assertEq(plan.price, PRO_PRICE);
        assertTrue(plan.active);

        assertEq(billing.plans(9).price, 0, "unset plan reads as zero");

        vm.prank(owner);
        billing.setPlan(PRO, 25e6, false);
        plan = billing.plans(PRO);
        assertEq(plan.price, 25e6);
        assertFalse(plan.active);
    }

    // -- argument validation ---------------------------------------------

    function test_depositRejectsZeroes() public {
        usdc.mint(alice, 10e6);
        vm.startPrank(alice);
        usdc.approve(address(billing), 10e6);

        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.deposit(alice, 0);

        vm.expectRevert(SubscriptionBilling.ZeroAddress.selector);
        billing.deposit(address(0), 1e6);
        vm.stopPrank();
    }

    function test_withdrawCreditRejectsZeroesAndOverdraw() public {
        fund(alice, 10e6);
        vm.startPrank(alice);

        vm.expectRevert(SubscriptionBilling.ZeroAddress.selector);
        billing.withdrawCredit(address(0), 1e6);

        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.withdrawCredit(alice, 0);

        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionBilling.InsufficientCredit.selector, uint256(11e6), uint256(10e6))
        );
        billing.withdrawCredit(alice, 11e6);
        vm.stopPrank();
    }

    function test_pauseBlocksEntryButNotExit() public {
        fund(alice, 30e6);
        vm.prank(owner);
        billing.setPaused(true);

        usdc.mint(alice, 10e6);
        vm.startPrank(alice);
        usdc.approve(address(billing), 10e6);

        vm.expectRevert(SubscriptionBilling.Paused.selector);
        billing.deposit(alice, 10e6);

        vm.expectRevert(SubscriptionBilling.Paused.selector);
        billing.subscribe(HOBBY);

        // ...but the credit already inside is still reachable.
        billing.withdrawCredit(alice, 30e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), 40e6);
    }

    function test_changePlanRejectsSamePlanAndNonSubscribers() public {
        fund(alice, 60e6);

        vm.prank(alice);
        vm.expectRevert(SubscriptionBilling.NotSubscribed.selector);
        billing.changePlan(PRO);

        vm.prank(alice);
        billing.subscribe(PRO);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.SamePlan.selector, PRO));
        billing.changePlan(PRO);
    }

    function test_setPlanRejectsIdZeroAndZeroPrice() public {
        vm.startPrank(owner);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionBilling.UnknownPlan.selector, uint8(0)));
        billing.setPlan(0, 1e6, true);

        vm.expectRevert(SubscriptionBilling.ZeroAmount.selector);
        billing.setPlan(3, 0, true);
        vm.stopPrank();
    }

    function test_constructorRejectsZeroAddresses() public {
        vm.expectRevert(SubscriptionBilling.ZeroAddress.selector);
        new SubscriptionBilling(IERC20(address(0)), owner);
    }

    function test_withdrawRevenueAndSweepRejectZeroRecipient() public {
        vm.startPrank(owner);
        vm.expectRevert(SubscriptionBilling.ZeroAddress.selector);
        billing.withdrawRevenue(address(0), 0);

        vm.expectRevert(SubscriptionBilling.ZeroAddress.selector);
        billing.sweep(IERC20(address(usdc)), address(0));
        vm.stopPrank();
    }

    function test_sweepRecoversAnUnrelatedToken() public {
        MockUSDC stray = new MockUSDC();
        stray.mint(address(billing), 5e6);

        vm.prank(owner);
        billing.sweep(IERC20(address(stray)), owner);
        assertEq(stray.balanceOf(owner), 5e6);
    }

    function _permitDigest(address holder, address spender, uint256 value, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                holder,
                spender,
                value,
                nonce,
                deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
    }
}
