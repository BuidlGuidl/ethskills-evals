// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Drives the contract with random, time-advancing call sequences.
contract Handler is Test {
    SubscriptionBilling public billing;
    MockUSDC public usdc;
    address[] public actors;
    uint256 public PERIOD;

    uint256 public ghostDeposited;
    uint256 public ghostWithdrawn;
    uint256 public ghostRevenuePaid;

    constructor(SubscriptionBilling billing_, MockUSDC usdc_, address[] memory actors_) {
        billing = billing_;
        usdc = usdc_;
        actors = actors_;
        PERIOD = billing.PERIOD();
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _advance(uint256 seed) internal {
        vm.warp(block.timestamp + (seed % (PERIOD / 3)));
    }

    function deposit(uint256 actorSeed, uint256 amount, uint256 timeSeed) external {
        _advance(timeSeed);
        address a = _actor(actorSeed);
        amount = bound(amount, 1e6, 500e6);
        usdc.mint(a, amount);
        vm.startPrank(a);
        usdc.approve(address(billing), amount);
        billing.deposit(amount);
        vm.stopPrank();
        ghostDeposited += amount;
    }

    function subscribe(uint256 actorSeed, uint256 planSeed, uint256 timeSeed) external {
        _advance(timeSeed);
        address a = _actor(actorSeed);
        uint32 plan = uint32((planSeed % 2) + 1);
        vm.prank(a);
        try billing.subscribe(plan) {} catch {}
    }

    function changePlan(uint256 actorSeed, uint256 planSeed, uint256 timeSeed) external {
        _advance(timeSeed);
        address a = _actor(actorSeed);
        uint32 plan = uint32((planSeed % 2) + 1);
        vm.prank(a);
        try billing.changePlan(plan) {} catch {}
    }

    function cancel(uint256 actorSeed, uint256 timeSeed) external {
        _advance(timeSeed);
        vm.prank(_actor(actorSeed));
        try billing.cancel() {} catch {}
    }

    function withdraw(uint256 actorSeed, uint256 amount, uint256 timeSeed) external {
        _advance(timeSeed);
        address a = _actor(actorSeed);
        uint256 free = billing.accountOf(a).balance;
        if (free == 0) return;
        amount = bound(amount, 1, free);
        uint256 before = usdc.balanceOf(a);
        vm.prank(a);
        try billing.withdraw(amount) {
            ghostWithdrawn += usdc.balanceOf(a) - before;
        } catch {}
    }

    function cancelAndWithdrawAll(uint256 actorSeed, uint256 timeSeed) external {
        _advance(timeSeed);
        address a = _actor(actorSeed);
        uint256 before = usdc.balanceOf(a);
        vm.prank(a);
        try billing.cancelAndWithdrawAll() {
            ghostWithdrawn += usdc.balanceOf(a) - before;
        } catch {}
    }

    function settle(uint256 actorSeed, uint256 timeSeed) external {
        _advance(timeSeed);
        billing.settle(_actor(actorSeed)); // permissionless, so no prank needed
    }

    function withdrawRevenue(uint256 amount, uint256 timeSeed) external {
        _advance(timeSeed);
        uint256 available = billing.withdrawableRevenue();
        if (available == 0) return;
        amount = bound(amount, 1, available);
        billing.withdrawRevenue(amount);
        ghostRevenuePaid += amount;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract InvariantsTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;
    Handler internal handler;
    address internal payout = makeAddr("payout");

    function setUp() public {
        usdc = new MockUSDC();
        address owner = address(this);
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner, payout);
        billing.addPlan(5e6);
        billing.addPlan(20e6);
        vm.warp(1_750_000_000);

        address[] memory actors = new address[](4);
        actors[0] = makeAddr("a1");
        actors[1] = makeAddr("a2");
        actors[2] = makeAddr("a3");
        actors[3] = makeAddr("a4");

        handler = new Handler(billing, usdc, actors);
        targetContract(address(handler));
    }

    /// Every customer could withdraw everything owed to them and the merchant could
    /// take all earned revenue, simultaneously, and the contract would not run dry.
    function invariant_solvent() public view {
        uint256 owed =
            billing.totalCustomerBalance() + billing.totalEscrowed() + billing.withdrawableRevenue();
        assertGe(usdc.balanceOf(address(billing)), owed, "contract cannot cover its obligations");
    }

    /// Money in == money out + money still held. Nothing is created or destroyed.
    function invariant_conservationOfFunds() public view {
        uint256 held = usdc.balanceOf(address(billing));
        assertEq(
            handler.ghostDeposited(),
            handler.ghostWithdrawn() + handler.ghostRevenuePaid() + held,
            "funds leaked"
        );
    }

    /// A subscribed account always has a live escrowed period; an unsubscribed one
    /// never holds escrow.
    function invariant_escrowMatchesSubscriptions() public view {
        uint256 sumEscrow;
        for (uint256 i = 0; i < handler.actorCount(); ++i) {
            SubscriptionBilling.Account memory a = billing.accountOf(handler.actors(i));
            if (a.planId == 0) {
                assertEq(a.periodPrice, 0, "unsubscribed account still holds escrow");
            } else {
                assertGt(a.periodPrice, 0, "subscribed account with no escrow");
                sumEscrow += a.periodPrice;
            }
        }
        assertEq(sumEscrow, billing.totalEscrowed(), "escrow accounting drifted");
    }

    /// Customer-owned funds are never counted as merchant revenue.
    function invariant_customerBalancesSumCorrectly() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); ++i) {
            sum += billing.accountOf(handler.actors(i)).balance;
        }
        assertEq(sum, billing.totalCustomerBalance(), "customer balance accounting drifted");
    }
}
