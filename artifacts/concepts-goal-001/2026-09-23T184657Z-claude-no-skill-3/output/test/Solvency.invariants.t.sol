// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @dev Drives the contract with random-but-legal customer and merchant activity, including
///      time travel, and tracks what the world outside the contract has put in and taken out.
contract BillingHandler is Test {
    SubscriptionBilling public billing;
    MockUSDC public usdc;
    address public merchant;
    address[] public actors;

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    constructor(SubscriptionBilling billing_, MockUSDC usdc_, address merchant_) {
        billing = billing_;
        usdc = usdc_;
        merchant = merchant_;
        for (uint256 i; i < 4; i++) {
            address actor = address(uint160(0xA11CE + i));
            actors.push(actor);
            usdc.mint(actor, 10_000e6);
            vm.prank(actor);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function deposit(uint256 seed, uint256 amount) external {
        address actor = _actor(seed);
        amount = bound(amount, 1, 200e6);
        if (usdc.balanceOf(actor) < amount) return;
        totalDeposited += amount;
        vm.prank(actor);
        billing.deposit(amount);
    }

    function subscribe(uint256 seed, bool pro) external {
        address actor = _actor(seed);
        vm.prank(actor);
        try billing.subscribe(pro ? 2 : 1) {} catch {}
    }

    function cancel(uint256 seed) external {
        address actor = _actor(seed);
        vm.prank(actor);
        try billing.cancel() {} catch {}
    }

    function withdraw(uint256 seed, uint256 amount) external {
        address actor = _actor(seed);
        uint256 available = billing.rawSubscription(actor).balance;
        billing.settle(actor);
        available = billing.rawSubscription(actor).balance;
        if (available == 0) return;
        amount = bound(amount, 1, available);
        totalWithdrawn += amount;
        vm.prank(actor);
        billing.withdraw(amount);
    }

    function switchPlan(uint256 seed, bool pro) external {
        address actor = _actor(seed);
        vm.prank(actor);
        try billing.switchPlan(pro ? 2 : 1) {} catch {}
    }

    function settle(uint256 seed) external {
        billing.settle(_actor(seed));
    }

    function withdrawRevenue(uint256 amount) external {
        uint256 available = billing.accruedRevenue();
        if (available == 0) return;
        amount = bound(amount, 1, available);
        totalWithdrawn += amount;
        vm.prank(merchant);
        billing.withdrawRevenue(merchant, amount);
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1 hours, 45 days));
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract SolvencyInvariantsTest is Test {
    MockUSDC usdc;
    SubscriptionBilling billing;
    BillingHandler handler;
    address merchant = makeAddr("merchant");

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), merchant, 5e6, 20e6);
        handler = new BillingHandler(billing, usdc, merchant);
        targetContract(address(handler));
    }

    /// @notice The contract always holds at least everything it owes: customer credit,
    ///         escrowed periods, and revenue the merchant has not taken yet.
    function invariant_neverOwesMoreThanItHolds() public view {
        assertGe(usdc.balanceOf(address(billing)), billing.customerFunds() + billing.accruedRevenue());
    }

    /// @notice Money in minus money out equals money still held. Nothing is minted or lost.
    function invariant_tokenConservation() public view {
        assertEq(
            usdc.balanceOf(address(billing)),
            handler.totalDeposited() - handler.totalWithdrawn(),
            "token flow does not reconcile"
        );
    }

    /// @notice `customerFunds` really is the sum of every account's balance and escrow,
    ///         so the merchant's rescue path can never reach customer money.
    function invariant_customerFundsMatchesPerAccountSum() public view {
        uint256 sum;
        for (uint256 i; i < handler.actorCount(); i++) {
            SubscriptionBilling.Subscription memory s = billing.rawSubscription(handler.actors(i));
            sum += uint256(s.balance) + s.escrow;
        }
        assertEq(billing.customerFunds(), sum);
    }

    /// @notice An account reported as subscribed always has a paid-for period covering now.
    function invariant_activeImpliesPaidThrough() public view {
        for (uint256 i; i < handler.actorCount(); i++) {
            address actor = handler.actors(i);
            (bool active,, uint64 until,, uint256 escrow) = billing.statusOf(actor);
            if (active) {
                assertGt(until, block.timestamp, "active without coverage");
                assertGt(escrow, 0, "active without escrow backing the period");
            }
        }
    }
}
