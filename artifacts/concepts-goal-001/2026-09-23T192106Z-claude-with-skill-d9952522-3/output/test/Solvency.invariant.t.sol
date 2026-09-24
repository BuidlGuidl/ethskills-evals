// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Subscriptions} from "../src/Subscriptions.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @dev Drives the contract through random subscriber and operator behaviour, including
///      time passing, so the invariant below is tested against sequences nobody wrote by hand.
contract Handler is Test {
    Subscriptions public sub;
    MockUSDC public usdc;
    address public owner;
    address[] public actors;

    uint256 public constant MINT_PER_ACTOR = 10_000_000e6;

    constructor(Subscriptions sub_, MockUSDC usdc_, address owner_) {
        sub = sub_;
        usdc = usdc_;
        owner = owner_;
        for (uint256 i = 0; i < 5; ++i) {
            address actor = address(uint160(uint256(keccak256(abi.encode("actor", i)))));
            actors.push(actor);
            usdc.mint(actor, MINT_PER_ACTOR);
            vm.prank(actor);
            usdc.approve(address(sub), type(uint256).max);
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function subscribe(uint256 seed, uint256 amount, bool useProPlan) public {
        amount = bound(amount, 1e6, 100_000e6);
        vm.prank(_actor(seed));
        sub.subscribe(useProPlan ? 2 : 1, amount);
    }

    function topUp(uint256 seed, uint256 payerSeed, uint256 amount) public {
        amount = bound(amount, 1, 100_000e6);
        vm.prank(_actor(payerSeed));
        sub.topUp(_actor(seed), amount);
    }

    function withdraw(uint256 seed, uint256 amount) public {
        address actor = _actor(seed);
        (,,, uint256 balance, uint256 owed) = sub.statusOf(actor);
        uint256 free = balance - owed;
        if (free == 0) return;
        amount = bound(amount, 1, free);
        vm.prank(actor);
        sub.withdraw(amount, actor);
    }

    function cancel(uint256 seed) public {
        address actor = _actor(seed);
        (, uint32 planId,,,) = sub.statusOf(actor);
        if (planId == 0) return;
        vm.prank(actor);
        sub.cancel(actor);
    }

    function collect(uint256 seed) public {
        address[] memory list = new address[](1);
        list[0] = _actor(seed);
        sub.collect(list);
    }

    function withdrawRevenue(uint256 amount) public {
        amount = bound(amount, 0, sub.earned());
        if (amount == 0) return;
        vm.prank(owner);
        sub.withdrawRevenue(owner, amount);
    }

    function warp(uint256 secondsAhead) public {
        vm.warp(block.timestamp + bound(secondsAhead, 1, 45 days));
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract SolvencyInvariantTest is Test {
    Subscriptions sub;
    MockUSDC usdc;
    Handler handler;
    address owner = makeAddr("owner");

    function setUp() public {
        usdc = new MockUSDC();
        sub = new Subscriptions(IERC20(address(usdc)), owner);
        vm.startPrank(owner);
        sub.addPlan(5e6, 30 days);
        sub.addPlan(20e6, 30 days);
        vm.stopPrank();

        handler = new Handler(sub, usdc, owner);
        targetContract(address(handler));
    }

    /// @notice The contract can always pay every refund it owes and every dollar of
    ///         revenue it has recognised. If this ever fails, someone's money is gone.
    function invariant_holdsEverythingItOwes() public view {
        assertGe(usdc.balanceOf(address(sub)), sub.totalDeposits() + sub.earned());
    }

    /// @notice Per-account balances add up to the pooled figure the operator's
    ///         withdrawal limit is derived from.
    function invariant_depositsMatchTheSumOfAccounts() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); ++i) {
            (,,, uint256 balance,) = sub.statusOf(handler.actors(i));
            sum += balance;
        }
        assertEq(sum, sub.totalDeposits());
    }

    /// @notice Every USDC that ever entered the system is in exactly one of three places:
    ///         a customer's wallet, the contract, or the operator's wallet. None is
    ///         created, and none is stranded somewhere nobody can reach.
    function invariant_conservationOfFunds() public view {
        uint256 total = usdc.balanceOf(address(sub)) + usdc.balanceOf(owner);
        for (uint256 i = 0; i < handler.actorCount(); ++i) {
            total += usdc.balanceOf(handler.actors(i));
        }
        assertEq(total, handler.actorCount() * handler.MINT_PER_ACTOR());
    }
}
