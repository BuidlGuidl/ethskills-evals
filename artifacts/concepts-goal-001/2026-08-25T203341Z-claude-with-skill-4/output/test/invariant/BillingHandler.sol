// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {SubscriptionBilling} from "../../src/SubscriptionBilling.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/// @dev Drives the contract through random sequences of every user- and operator-facing action,
/// with random amounts of time passing in between. The point is to find an ordering that breaks
/// solvency or lets someone withdraw money they already spent.
contract BillingHandler is CommonBase, StdCheats, StdUtils {
    SubscriptionBilling public immutable billing;
    MockERC20 public immutable usdc;

    address[] public actors;
    uint256 public totalDepositedIn;
    uint256 public totalPaidOut;

    constructor(SubscriptionBilling _billing, MockERC20 _usdc, address[] memory _actors) {
        billing = _billing;
        usdc = _usdc;
        actors = _actors;
    }

    modifier asActor(uint256 seed) {
        address actor = actors[bound(seed, 0, actors.length - 1)];
        vm.startPrank(actor);
        _;
        vm.stopPrank();
    }

    function _warp(uint256 seed) internal {
        vm.warp(block.timestamp + bound(seed, 0, 45 days));
    }

    function subscribe(uint256 actorSeed, uint256 planSeed, uint256 amount, uint256 timeSeed)
        external
        asActor(actorSeed)
    {
        _warp(timeSeed);
        uint8 planId = uint8(bound(planSeed, 1, 2));
        amount = bound(amount, 1, 500e6);
        try billing.subscribe(planId, amount) {
            totalDepositedIn += amount;
        } catch {}
    }

    function topUp(uint256 actorSeed, uint256 amount, uint256 timeSeed) external asActor(actorSeed) {
        _warp(timeSeed);
        amount = bound(amount, 1, 500e6);
        try billing.topUp(amount) {
            totalDepositedIn += amount;
        } catch {}
    }

    function changePlan(uint256 actorSeed, uint256 planSeed, uint256 timeSeed) external asActor(actorSeed) {
        _warp(timeSeed);
        try billing.changePlan(uint8(bound(planSeed, 1, 2))) {} catch {}
    }

    function withdraw(uint256 actorSeed, uint256 amount, uint256 timeSeed) external asActor(actorSeed) {
        _warp(timeSeed);
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        amount = bound(amount, 1, 500e6);
        try billing.withdraw(amount, actor) {
            totalPaidOut += amount;
        } catch {}
    }

    function cancel(uint256 actorSeed, uint256 timeSeed) external asActor(actorSeed) {
        _warp(timeSeed);
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        try billing.cancel(actor) returns (uint256 refund) {
            totalPaidOut += refund;
        } catch {}
    }

    /// @dev Deliberately callable by anyone, at any cadence, including absurdly often.
    function settle(uint256 actorSeed, uint256 timeSeed) external {
        _warp(timeSeed);
        address[] memory batch = new address[](actors.length);
        for (uint256 i; i < actors.length; ++i) {
            batch[i] = actors[(i + actorSeed) % actors.length];
        }
        billing.settle(batch);
    }

    function collect(uint256 timeSeed) external {
        _warp(timeSeed);
        try billing.collect() returns (uint256 amount) {
            totalPaidOut += amount;
        } catch {}
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}
