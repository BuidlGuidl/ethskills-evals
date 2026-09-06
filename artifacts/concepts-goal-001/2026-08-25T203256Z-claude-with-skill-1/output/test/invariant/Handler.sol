// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {SubscriptionBilling} from "../../src/SubscriptionBilling.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @notice Drives the contract through random sequences of everything a real user or the
///         operator can do, including letting time pass between calls.
contract Handler is CommonBase, StdCheats, StdUtils {
    SubscriptionBilling public billing;
    MockUSDC public usdc;
    address public owner;

    address[] public actors;
    uint256 public ghost_deposited;
    uint256 public ghost_withdrawn;
    uint256 public ghost_collected;

    constructor(SubscriptionBilling _billing, MockUSDC _usdc, address _owner) {
        billing = _billing;
        usdc = _usdc;
        owner = _owner;
        for (uint256 i; i < 5; ++i) {
            address a = address(uint160(uint256(keccak256(abi.encode("actor", i)))));
            actors.push(a);
            usdc.mint(a, 1_000_000e6);
            vm.prank(a);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    modifier advanceTime(uint256 secs) {
        vm.warp(block.timestamp + bound(secs, 0, 45 days));
        _;
    }

    function deposit(uint256 who, uint256 amount, uint256 secs) external advanceTime(secs) {
        address a = _actor(who);
        amount = bound(amount, 1, 10_000e6);
        vm.prank(a);
        billing.deposit(amount);
        ghost_deposited += amount;
    }

    function subscribe(uint256 who, uint256 plan, uint256 secs) external advanceTime(secs) {
        address a = _actor(who);
        uint8 planId = uint8(bound(plan, 1, 2));
        vm.prank(a);
        billing.subscribe(planId);
    }

    function cancel(uint256 who, uint256 secs) external advanceTime(secs) {
        address a = _actor(who);
        (, uint128 rate,,) = billing.accounts(a);
        if (rate == 0) return;
        vm.prank(a);
        billing.cancel();
    }

    function withdraw(uint256 who, uint256 amount, uint256 secs) external advanceTime(secs) {
        address a = _actor(who);
        uint256 max = billing.withdrawable(a);
        if (max == 0) return;
        amount = bound(amount, 1, max);
        vm.prank(a);
        billing.withdraw(amount, a);
        ghost_withdrawn += amount;
    }

    function closeAccount(uint256 who, uint256 secs) external advanceTime(secs) {
        address a = _actor(who);
        vm.prank(a);
        ghost_withdrawn += billing.closeAccount(a);
    }

    function settleAll(uint256 secs) external advanceTime(secs) {
        billing.settle(actors);
    }

    function collectRevenue(uint256 amount, uint256 secs) external advanceTime(secs) {
        uint256 rev = billing.revenue();
        if (rev == 0) return;
        amount = bound(amount, 1, rev);
        vm.prank(owner);
        ghost_collected += billing.collectRevenue(owner, amount);
    }

    function reprice(uint256 plan, uint256 price, uint256 secs) external advanceTime(secs) {
        uint8 planId = uint8(bound(plan, 1, 2));
        vm.prank(owner);
        billing.setPlan(planId, uint128(bound(price, 1, 1_000e6)), true);
    }

    function strayTransfer(uint256 who, uint256 amount, uint256 secs) external advanceTime(secs) {
        address a = _actor(who);
        amount = bound(amount, 1, 100e6);
        vm.prank(a);
        usdc.transfer(address(billing), amount);
    }
}
