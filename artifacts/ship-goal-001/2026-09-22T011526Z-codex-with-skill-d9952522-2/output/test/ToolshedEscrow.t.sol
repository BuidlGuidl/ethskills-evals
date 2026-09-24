// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/ToolshedEscrow.sol";
import "../contracts/mocks/MockUSDC.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract ToolshedEscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC private usdc;
    ToolshedEscrow private escrow;

    address private admin = address(0xA11CE);
    address private owner = address(0x0A0A);
    address private borrower = address(0x0B0B);
    bytes32 private toolId = keccak256("tool:ladder-24ft");
    bytes32 private listingHash = keccak256("ipfs://toolshed/listings/ladder-24ft");

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new ToolshedEscrow(address(usdc), admin);

        vm.startPrank(admin);
        escrow.setMember(owner, true);
        escrow.setMember(borrower, true);
        vm.stopPrank();

        usdc.mint(borrower, 200e6);
        vm.prank(borrower);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function testRequestApproveAndOnTimeReturnRefundsDeposit() public {
        uint256 loanId = _requestAndApprove(block.timestamp + 3 days, 100e6, 10e6);

        vm.warp(block.timestamp + 2 days);
        vm.prank(owner);
        escrow.markReturned(loanId);

        assertEq(usdc.balanceOf(borrower), 200e6);
        assertEq(usdc.balanceOf(owner), 0);

        (uint64 completed, uint64 late,,) = escrow.memberStats(borrower);
        assertEq64(completed, 1);
        assertEq64(late, 0);
    }

    function testLateReturnPaysCeiledDailyFeeToOwner() public {
        uint256 loanId = _requestAndApprove(block.timestamp + 3 days, 100e6, 10e6);

        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(owner);
        escrow.markReturned(loanId);

        assertEq(usdc.balanceOf(borrower), 190e6);
        assertEq(usdc.balanceOf(owner), 10e6);

        (uint64 completed, uint64 late, uint256 paid,) = escrow.memberStats(borrower);
        assertEq64(completed, 1);
        assertEq64(late, 1);
        assertEq(paid, 10e6);
    }

    function testLateFeesAreCappedAtDeposit() public {
        uint256 loanId = _requestAndApprove(block.timestamp + 1 days, 25e6, 10e6);

        vm.warp(block.timestamp + 5 days);
        vm.prank(owner);
        escrow.markReturned(loanId);

        assertEq(usdc.balanceOf(borrower), 175e6);
        assertEq(usdc.balanceOf(owner), 25e6);
    }

    function testOwnerCanClaimExpiredDepositAfterFeeConsumesDeposit() public {
        uint256 loanId = _requestAndApprove(block.timestamp + 1 days, 25e6, 10e6);

        vm.warp(block.timestamp + 4 days);
        vm.prank(owner);
        escrow.claimExpiredDeposit(loanId);

        assertEq(usdc.balanceOf(borrower), 175e6);
        assertEq(usdc.balanceOf(owner), 25e6);
    }

    function testCannotClaimExpiredDepositWhileRefundRemains() public {
        uint256 loanId = _requestAndApprove(block.timestamp + 1 days, 25e6, 10e6);

        vm.warp(block.timestamp + 2 days);
        vm.prank(owner);
        vm.expectRevert(ToolshedEscrow.DepositStillRefundable.selector);
        escrow.claimExpiredDeposit(loanId);
    }

    function testBorrowerCanCancelBeforeApproval() public {
        uint256 dueAt = block.timestamp + 3 days;
        vm.prank(borrower);
        uint256 loanId = escrow.requestLoan(toolId, listingHash, owner, uint64(dueAt), 100e6, 10e6);

        vm.prank(borrower);
        escrow.cancelRequest(loanId);

        assertEq(usdc.balanceOf(borrower), 200e6);
        assertTrue(escrow.loanStatus(loanId) == ToolshedEscrow.LoanStatus.Cancelled);
    }

    function testOnlyMembersCanRequest() public {
        address stranger = address(0xBAD);
        usdc.mint(stranger, 100e6);
        vm.startPrank(stranger);
        usdc.approve(address(escrow), type(uint256).max);
        vm.expectRevert(ToolshedEscrow.NotMember.selector);
        escrow.requestLoan(toolId, listingHash, owner, uint64(block.timestamp + 3 days), 100e6, 10e6);
        vm.stopPrank();
    }

    function _requestAndApprove(uint256 dueAt, uint256 deposit, uint256 dailyLateFee)
        private
        returns (uint256 loanId)
    {
        vm.prank(borrower);
        loanId = escrow.requestLoan(
            toolId, listingHash, owner, uint64(dueAt), deposit, dailyLateFee
        );

        vm.prank(owner);
        escrow.approveLoan(loanId);
    }

    function assertEq(uint256 left, uint256 right) private pure {
        require(left == right, "uint not equal");
    }

    function assertEq64(uint64 left, uint64 right) private pure {
        require(left == right, "uint64 not equal");
    }

    function assertTrue(bool value) private pure {
        require(value, "not true");
    }
}
