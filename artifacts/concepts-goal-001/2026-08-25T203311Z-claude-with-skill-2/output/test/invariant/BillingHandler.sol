// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {SubscriptionBilling} from "../../src/SubscriptionBilling.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @dev Drives the contract through random but always-valid sequences, and keeps ghost totals of
///      every token that has crossed the boundary so the invariant suite can check conservation.
contract BillingHandler is CommonBase, StdCheats, StdUtils {
    // forge-lint: disable-start(screaming-snake-case-immutable)
    SubscriptionBilling public immutable billing;
    MockUSDC public immutable usdc;
    address public immutable owner;
    // forge-lint: disable-end(screaming-snake-case-immutable)

    address[] public actors;
    uint256[] public planIds;

    uint256 public ghostDeposited;
    uint256 public ghostRefunded;
    uint256 public ghostWithdrawn;

    mapping(bytes32 => uint256) public calls;

    constructor(SubscriptionBilling _billing, MockUSDC _usdc, address _owner, uint256[] memory _planIds) {
        billing = _billing;
        usdc = _usdc;
        owner = _owner;
        planIds = _planIds;
        for (uint256 i = 0; i < 5; ++i) {
            address actor = address(uint160(uint256(keccak256(abi.encode("actor", i)))));
            actors.push(actor);
            vm.prank(actor);
            usdc.approve(address(billing), type(uint256).max);
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function subscribe(uint256 actorSeed, uint256 planSeed, uint256 amount) external {
        calls["subscribe"]++;
        address actor = _actor(actorSeed);
        uint256 planId = planIds[planSeed % planIds.length];
        uint256 price = billing.minimumDeposit(planId);
        amount = bound(amount, price, 10_000e6);

        usdc.mint(actor, amount);
        vm.prank(actor);
        billing.subscribe(planId, amount);
        ghostDeposited += amount;
    }

    function topUp(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        (uint256 planId,,,,,) = billing.accountOf(actor);
        if (planId == 0) return;
        calls["topUp"]++;

        amount = bound(amount, 1, 10_000e6);
        usdc.mint(actor, amount);
        vm.prank(actor);
        billing.topUp(amount);
        ghostDeposited += amount;
    }

    function cancel(uint256 actorSeed) external {
        address actor = _actor(actorSeed);
        (uint256 planId,,,,,) = billing.accountOf(actor);
        if (planId == 0) return;
        calls["cancel"]++;

        uint256 before = usdc.balanceOf(actor);
        vm.prank(actor);
        billing.cancel();
        ghostRefunded += usdc.balanceOf(actor) - before;
    }

    function settle(uint256 actorSeed) external {
        calls["settle"]++;
        billing.settle(_actor(actorSeed));
    }

    function withdrawEarnings(uint256 amount) external {
        uint256 accrued = billing.operatorAccrued();
        if (accrued == 0) return;
        calls["withdraw"]++;

        amount = bound(amount, 1, accrued);
        vm.prank(owner);
        billing.withdrawEarnings(owner, amount);
        ghostWithdrawn += amount;
    }

    /// @dev Time passing is itself a state transition here — the only one nobody has to send.
    function letTimePass(uint256 secondsElapsed) external {
        calls["warp"]++;
        vm.warp(block.timestamp + bound(secondsElapsed, 1, 60 days));
    }
}
