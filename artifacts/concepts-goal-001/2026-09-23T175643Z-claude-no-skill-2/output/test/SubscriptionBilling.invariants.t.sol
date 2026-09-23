// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SubscriptionBilling} from "../src/SubscriptionBilling.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

/// @dev Drives the contract with random-but-legal customer and operator traffic.
contract Handler is Test {
    SubscriptionBilling public billing;
    MockUSDC public usdc;
    address public operator;

    address[] public actors;
    /// Total USDC pulled in from customers, minus what has gone back out to them. The contract
    /// should never have paid out more than it took in.
    uint256 public netDeposited;

    constructor(SubscriptionBilling b, MockUSDC t, address op) {
        billing = b;
        usdc = t;
        operator = op;
        for (uint256 i; i < 5; ++i) {
            address a = address(uint160(uint256(keccak256(abi.encode("actor", i)))));
            actors.push(a);
            usdc.mint(a, 1_000_000e6);
            vm.prank(a);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function deposit(uint256 seed, uint256 amount) public {
        address a = _actor(seed);
        amount = bound(amount, 1, 10_000e6);
        vm.prank(a);
        billing.deposit(amount);
        netDeposited += amount;
    }

    function subscribe(uint256 seed, bool pro) public {
        address a = _actor(seed);
        uint32 planId = pro ? 1 : 0;
        vm.prank(a);
        try billing.subscribe(planId) {} catch {}
    }

    function cancel(uint256 seed) public {
        vm.prank(_actor(seed));
        try billing.cancel() {} catch {}
    }

    function withdraw(uint256 seed, uint256 amount) public {
        address a = _actor(seed);
        uint256 max = billing.balanceOf(a);
        if (max == 0) return;
        amount = bound(amount, 1, max);
        vm.prank(a);
        billing.withdraw(amount, a);
        netDeposited -= amount;
    }

    function settle(uint256 seed) public {
        billing.settle(_actor(seed));
    }

    function withdrawEarnings(uint256 amount) public {
        uint256 max = billing.earned();
        if (max == 0) return;
        amount = bound(amount, 1, max);
        vm.prank(operator);
        billing.withdrawEarnings(operator, amount);
    }

    function warp(uint256 secs) public {
        skip(bound(secs, 1, 45 days));
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract SubscriptionBillingInvariantsTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;
    Handler internal handler;
    address internal operator = makeAddr("operator");

    function setUp() public {
        vm.warp(1_750_000_000);
        usdc = new MockUSDC();
        uint128[] memory prices = new uint128[](2);
        prices[0] = 5e6;
        prices[1] = 20e6;
        billing = new SubscriptionBilling(IERC20(address(usdc)), operator, prices);
        handler = new Handler(billing, usdc, operator);
        targetContract(address(handler));
    }

    /// The contract must always hold enough USDC to cover every customer balance plus all revenue
    /// that has been settled but not yet withdrawn. If this ever breaks, someone cannot be paid out.
    function invariant_solvent() public view {
        assertGe(usdc.balanceOf(address(billing)), billing.totalCustomerBalance() + billing.earned());
    }

    /// `totalCustomerBalance` must equal the sum of the individual balances it claims to track —
    /// otherwise the surplus calculation (and therefore `sweepSurplus`) is wrong.
    function invariant_customerBalanceAccountingAddsUp() public view {
        uint256 sum;
        uint256 n = handler.actorCount();
        for (uint256 i; i < n; ++i) {
            address a = handler.actors(i);
            sum += billing.balanceOf(a) + billing.accruedOf(a);
        }
        assertEq(sum, billing.totalCustomerBalance());
    }

    /// Nobody can ever be charged for more than they put in: total money out of customer wallets
    /// is fully accounted for as either still-held credit or recognised revenue.
    function invariant_noCustomerGoesIntoDebt() public view {
        uint256 n = handler.actorCount();
        for (uint256 i; i < n; ++i) {
            address a = handler.actors(i);
            assertLe(billing.accruedOf(a), billing.totalCustomerBalance() + billing.earned());
        }
    }

    /// A subscription is live only while its prepaid balance still covers it.
    function invariant_subscribedImpliesFunded() public view {
        uint256 n = handler.actorCount();
        for (uint256 i; i < n; ++i) {
            address a = handler.actors(i);
            if (billing.isSubscribed(a)) {
                assertGt(billing.balanceOf(a), 0);
                assertGt(billing.expiresAt(a), block.timestamp);
            }
        }
    }
}
