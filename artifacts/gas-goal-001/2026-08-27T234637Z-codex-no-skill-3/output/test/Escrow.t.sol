// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EscrowFactory} from "../src/EscrowFactory.sol";
import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";
import {MockUSDC} from "./MockUSDC.sol";

interface Vm {
    function prank(address caller) external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
}

contract EscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant FREELANCER = address(0xBEEF);
    address private constant ARBITRATOR = address(0xA11CE);
    address private constant CLIENT = address(0xCAFE);
    uint256 private constant AMOUNT = 10_000e6;

    MockUSDC private usdc;
    EscrowFactory private factory;

    function setUp() public {
        usdc = new MockUSDC();
        factory = new EscrowFactory();
        usdc.mint(address(this), 100_000e6);
        usdc.approve(address(factory), type(uint256).max);
    }

    function testCreatesAndFundsEscrow() public {
        FreelanceEscrow escrow = factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, bytes32("job-1"));
        _assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Funded));
        _assertEq(factory.escrowForJob(bytes32("job-1")), address(escrow));
    }

    function testClientReleasesOnlyAfterDelivery() public {
        FreelanceEscrow escrow = _create();
        vm.expectRevert(
            abi.encodeWithSelector(
                FreelanceEscrow.InvalidState.selector, FreelanceEscrow.Status.Delivered, FreelanceEscrow.Status.Funded
            )
        );
        escrow.releaseToFreelancer();

        vm.prank(FREELANCER);
        escrow.markDelivered("ipfs://deliverable");
        escrow.releaseToFreelancer();
        _assertEq(usdc.balanceOf(FREELANCER), AMOUNT);
        _assertEq(uint256(escrow.status()), uint256(FreelanceEscrow.Status.Resolved));
    }

    function testClientCanRefundBeforeDeliveryButNotAfter() public {
        FreelanceEscrow escrow = _create();
        uint256 balanceBefore = usdc.balanceOf(address(this));
        escrow.refundClient();
        _assertEq(usdc.balanceOf(address(this)), balanceBefore + AMOUNT);

        escrow = _createWithId(bytes32("job-2"));
        vm.prank(FREELANCER);
        escrow.markDelivered("ipfs://deliverable");
        vm.expectRevert(
            abi.encodeWithSelector(
                FreelanceEscrow.InvalidState.selector, FreelanceEscrow.Status.Funded, FreelanceEscrow.Status.Delivered
            )
        );
        escrow.refundClient();
    }

    function testArbitratorCanSplitDisputedEscrow() public {
        FreelanceEscrow escrow = _create();
        vm.prank(FREELANCER);
        escrow.openDispute("ipfs://evidence");

        vm.prank(ARBITRATOR);
        escrow.resolveDispute(4_000e6, 6_000e6, "ipfs://decision");
        _assertEq(usdc.balanceOf(address(this)), 94_000e6);
        _assertEq(usdc.balanceOf(FREELANCER), 6_000e6);
        _assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testOutOfRangeEscrowCannotBeCreated() public {
        vm.expectRevert(FreelanceEscrow.InvalidAmount.selector);
        factory.createEscrow(usdc, FREELANCER, ARBITRATOR, 1_999e6, bytes32("too-small"));
    }

    function testNonClientCannotRelease() public {
        FreelanceEscrow escrow = _create();
        vm.prank(FREELANCER);
        escrow.markDelivered("ipfs://deliverable");
        vm.prank(FREELANCER);
        vm.expectRevert(FreelanceEscrow.Unauthorized.selector);
        escrow.releaseToFreelancer();
    }

    function _create() private returns (FreelanceEscrow) {
        return _createWithId(bytes32("job-1"));
    }

    function _createWithId(bytes32 jobId) private returns (FreelanceEscrow) {
        return factory.createEscrow(usdc, FREELANCER, ARBITRATOR, AMOUNT, jobId);
    }

    function _assertEq(uint256 a, uint256 b) private pure {
        require(a == b, "assertion failed");
    }

    function _assertEq(address a, address b) private pure {
        require(a == b, "assertion failed");
    }
}
