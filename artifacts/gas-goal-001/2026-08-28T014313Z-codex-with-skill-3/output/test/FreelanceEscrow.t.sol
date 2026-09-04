// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
import {FreelanceEscrowFactory} from "../src/FreelanceEscrowFactory.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface Vm {
    function prank(address) external;
    function expectRevert() external;
}

contract FreelanceEscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CLIENT = address(0xC11E17);
    address private constant FREELANCER = address(0xF1EE1A);
    address private constant ARBITRATOR = address(0xA8B17);
    uint256 private constant AMOUNT = 10_000e6;
    MockUSDC private token;
    FreelanceEscrow private escrow;

    function setUp() public {
        token = new MockUSDC();
        escrow = new FreelanceEscrow(token, CLIENT, FREELANCER, ARBITRATOR, AMOUNT, keccak256("job-1"));
        token.mint(CLIENT, AMOUNT);
        vm.prank(CLIENT);
        token.approve(address(escrow), AMOUNT);
    }

    function testReleaseAfterSubmission() public {
        vm.prank(CLIENT);
        escrow.fund();
        vm.prank(FREELANCER);
        escrow.submitWork(keccak256("delivery"));
        vm.prank(CLIENT);
        escrow.release();
        require(token.balanceOf(FREELANCER) == AMOUNT, "freelancer unpaid");
        require(uint256(escrow.status()) == uint256(FreelanceEscrow.Status.Released), "wrong status");
    }

    function testArbitratorCanSplitDispute() public {
        vm.prank(CLIENT);
        escrow.fund();
        vm.prank(FREELANCER);
        escrow.submitWork(keccak256("delivery"));
        vm.prank(CLIENT);
        escrow.raiseDispute();
        vm.prank(ARBITRATOR);
        escrow.resolveDispute(6_000e6);
        require(token.balanceOf(FREELANCER) == 6_000e6, "incorrect freelancer split");
        require(token.balanceOf(CLIENT) == 4_000e6, "incorrect client split");
    }

    function testFactoryRejectsOutOfRangeJobs() public {
        FreelanceEscrowFactory factory = new FreelanceEscrowFactory(token, ARBITRATOR, 2_000e6, 50_000e6);
        vm.expectRevert();
        factory.createEscrow(FREELANCER, 1_999e6, bytes32(0));
        vm.expectRevert();
        factory.createEscrow(FREELANCER, 50_001e6, bytes32(0));
    }
}
