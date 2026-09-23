// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Drives the contract with random-but-legal user behaviour so the
///         invariants below are checked against long, messy histories.
contract Handler is Test {
    SubscriptionBilling public billing;
    MockUSDC public usdc;
    address[] public users;

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;

    constructor(SubscriptionBilling billing_, MockUSDC usdc_, address[] memory users_) {
        billing = billing_;
        usdc = usdc_;
        users = users_;
    }

    function _user(uint256 seed) internal view returns (address) {
        return users[seed % users.length];
    }

    function deposit(uint256 userSeed, uint96 amount) public {
        address u = _user(userSeed);
        amount = uint96(bound(amount, 1e6, 200e6));
        usdc.mint(u, amount);
        vm.startPrank(u);
        usdc.approve(address(billing), amount);
        billing.deposit(amount);
        vm.stopPrank();
        totalDeposited += amount;
    }

    function subscribe(uint256 userSeed, uint256 planSeed) public {
        address u = _user(userSeed);
        uint32 planId = uint32(bound(planSeed, 1, billing.planCount() - 1));
        vm.prank(u);
        try billing.subscribe(planId) {} catch {}
    }

    function cancel(uint256 userSeed) public {
        address u = _user(userSeed);
        vm.prank(u);
        try billing.cancel() {} catch {}
    }

    function withdraw(uint256 userSeed, uint256 amount) public {
        address u = _user(userSeed);
        uint256 available = billing.availableBalance(u);
        if (available == 0) return;
        amount = bound(amount, 1, available);
        vm.prank(u);
        billing.withdraw(amount, u);
        totalWithdrawn += amount;
    }

    function settle(uint256 userSeed) public {
        billing.settle(_user(userSeed));
    }

    function advanceTime(uint32 seconds_) public {
        vm.warp(block.timestamp + bound(seconds_, 1, 45 days));
    }

    function userCount() external view returns (uint256) {
        return users.length;
    }

    function userAt(uint256 i) external view returns (address) {
        return users[i];
    }
}

contract SubscriptionBillingInvariantTest is Test {
    SubscriptionBilling billing;
    MockUSDC usdc;
    Handler handler;
    address operator = makeAddr("operator");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), operator);

        vm.startPrank(operator);
        billing.addPlan("hobby", 5e6);
        billing.addPlan("pro", 20e6);
        vm.stopPrank();

        address[] memory users = new address[](4);
        for (uint256 i; i < 4; ++i) {
            users[i] = address(uint160(0x1000 + i));
        }
        handler = new Handler(billing, usdc, users);
        targetContract(address(handler));
    }

    /// The contract must always hold enough USDC to pay back every subscriber
    /// in full and still cover the revenue the operator may withdraw.
    function invariant_solvent() public view {
        uint256 owed = billing.totalCustomerBalance() + billing.collectedRevenue();
        assertGe(usdc.balanceOf(address(billing)), owed, "insolvent");
    }

    /// Every unit held in subscriber balances is either still refundable to the
    /// subscriber or already earned by the operator — never both, never neither.
    function invariant_customerBalancesSplitCleanly() public view {
        uint256 refundable;
        uint256 accrued;
        for (uint256 i; i < handler.userCount(); ++i) {
            address u = handler.userAt(i);
            refundable += billing.availableBalance(u);
            accrued += billing.pendingRevenue(u);
        }
        assertEq(refundable + accrued, billing.totalCustomerBalance(), "balance accounting drifted");
    }

    /// The contract is solvent against what it owes *right now*, including
    /// revenue nobody has bothered to settle yet.
    function invariant_solventIncludingUnsettledAccrual() public view {
        uint256 refundable;
        uint256 accrued;
        for (uint256 i; i < handler.userCount(); ++i) {
            refundable += billing.availableBalance(handler.userAt(i));
            accrued += billing.pendingRevenue(handler.userAt(i));
        }
        assertGe(usdc.balanceOf(address(billing)), refundable + accrued + billing.collectedRevenue());
    }

    /// Everything that ever came in is still accounted for somewhere.
    function invariant_noValueCreatedOrDestroyed() public view {
        uint256 accountedFor =
            billing.totalCustomerBalance() + billing.collectedRevenue() + handler.totalWithdrawn();
        assertEq(accountedFor, handler.totalDeposited(), "value leaked");
    }

    /// An account reporting "subscribed" must have balance left to pay with.
    function invariant_subscribedImpliesFunded() public view {
        for (uint256 i; i < handler.userCount(); ++i) {
            address u = handler.userAt(i);
            if (billing.isSubscribed(u)) {
                assertGt(billing.availableBalance(u), 0, "subscribed on an empty account");
            }
        }
    }
}
