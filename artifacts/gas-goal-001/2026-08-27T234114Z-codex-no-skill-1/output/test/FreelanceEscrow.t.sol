// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract FreelanceEscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CLIENT = address(0xC1E17);
    address private constant FREELANCER = address(0xFEE1);
    address private constant ARBITER = address(0xA8B17E2);
    uint256 private constant AMOUNT = 10_000_000_000;

    MockUSDC private token;
    FreelanceEscrow private escrow;

    function setUp() public {
        token = new MockUSDC();
        escrow = new FreelanceEscrow(
            token, CLIENT, FREELANCER, ARBITER, AMOUNT, block.timestamp + 30 days
        );
        token.mint(CLIENT, AMOUNT);
    }

    function testClientCanFundThenReleaseDeliveredWork() public {
        vm.prank(CLIENT);
        token.approve(address(escrow), AMOUNT);
        vm.prank(CLIENT);
        escrow.fund();
        vm.prank(FREELANCER);
        escrow.markDelivered("ipfs://delivery");
        vm.prank(CLIENT);
        escrow.release();
        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer not paid");
        require(uint8(escrow.status()) == uint8(FreelanceEscrow.Status.Resolved), "not resolved");
    }

    function testArbiterCanSplitFunds() public {
        vm.prank(CLIENT);
        token.approve(address(escrow), AMOUNT);
        vm.prank(CLIENT);
        escrow.fund();
        vm.prank(ARBITER);
        escrow.resolveDispute(4_000_000_000, "case-42");
        require(token.balanceOf(CLIENT) == 4_000_000_000, "wrong client payout");
        require(token.balanceOf(FREELANCER) == 6_000_000_000, "wrong freelancer payout");
    }

    function testClientCanRefundOnlyAfterDeadline() public {
        vm.prank(CLIENT);
        token.approve(address(escrow), AMOUNT);
        vm.prank(CLIENT);
        escrow.fund();
        vm.prank(CLIENT);
        vm.expectRevert(FreelanceEscrow.DeadlineNotReached.selector);
        escrow.refundAfterDeadline();
        vm.warp(block.timestamp + 30 days);
        vm.prank(CLIENT);
        escrow.refundAfterDeadline();
        require(token.balanceOf(CLIENT) == AMOUNT, "client not refunded");
    }

    function testCannotCreateEscrowOutsideAllowedRange() public {
        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
        new FreelanceEscrow(
            token, CLIENT, FREELANCER, ARBITER, 1_999_999_999, block.timestamp + 1 days
        );
    }
}
