// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {FreelanceEscrow} from "../src/FreelanceEscrow.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FreelanceEscrowTest is Test {
    uint256 private constant AMOUNT = 10_000e6;
    address private client = makeAddr("client");
    address private freelancer = makeAddr("freelancer");
    address private arbitrator = makeAddr("arbitrator");
    address private guardian = makeAddr("guardian");

    MockUSDC private usdc;
    FreelanceEscrow private escrow;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new FreelanceEscrow(usdc, guardian);
        usdc.mint(client, 100_000e6);
        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function testHappyPathReleasesEntireAmount() public {
        uint256 id = _createAndAccept();
        vm.prank(client);
        escrow.fundEscrow(id);
        vm.prank(client);
        escrow.releaseToFreelancer(id);

        assertEq(usdc.balanceOf(freelancer), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Released));
    }

    function testMutualRefundRequiresBothParties() public {
        uint256 id = _createAcceptAndFund();
        vm.prank(client);
        escrow.proposePayout(id, client);
        vm.expectRevert(FreelanceEscrow.ProposerCannotAccept.selector);
        vm.prank(client);
        escrow.acceptPayout(id);

        vm.prank(freelancer);
        escrow.acceptPayout(id);
        assertEq(usdc.balanceOf(client), 100_000e6);
        assertEq(uint8(escrow.getEscrow(id).status), uint8(FreelanceEscrow.Status.Refunded));
    }

    function testArbitratorCanSplitOnlyAfterDispute() public {
        uint256 id = _createAcceptAndFund();
        vm.prank(freelancer);
        escrow.raiseDispute(id);
        vm.prank(arbitrator);
        escrow.resolveDispute(id, 3_000e6, 7_000e6);

        assertEq(usdc.balanceOf(client), 93_000e6);
        assertEq(usdc.balanceOf(freelancer), 7_000e6);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function testClientCannotUnilaterallyRefundFundedJob() public {
        uint256 id = _createAcceptAndFund();
        vm.expectRevert();
        vm.prank(client);
        escrow.cancelUnfunded(id);
    }

    function testCannotFundBeforeFreelancerAccepts() public {
        uint256 id = _create();
        vm.expectRevert(
            abi.encodeWithSelector(
                FreelanceEscrow.InvalidStatus.selector,
                FreelanceEscrow.Status.AwaitingFunding,
                FreelanceEscrow.Status.Created
            )
        );
        vm.prank(client);
        escrow.fundEscrow(id);
    }

    function testRejectsAmountsOutsideBusinessLimits() public {
        vm.startPrank(client);
        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
        escrow.createEscrow(freelancer, arbitrator, 1_999e6, uint64(block.timestamp + 7 days));
        vm.expectRevert(FreelanceEscrow.AmountOutOfRange.selector);
        escrow.createEscrow(freelancer, arbitrator, 50_001e6, uint64(block.timestamp + 7 days));
        vm.stopPrank();
    }

    function _create() private returns (uint256) {
        vm.prank(client);
        return escrow.createEscrow(freelancer, arbitrator, AMOUNT, uint64(block.timestamp + 7 days));
    }

    function _createAndAccept() private returns (uint256 id) {
        id = _create();
        vm.prank(freelancer);
        escrow.acceptJob(id);
    }

    function _createAcceptAndFund() private returns (uint256 id) {
        id = _createAndAccept();
        vm.prank(client);
        escrow.fundEscrow(id);
    }
}
