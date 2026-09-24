// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface Vm {
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function expectRevert(bytes4 revertData) external;
    function warp(uint256 newTimestamp) external;
}

contract ToolshedEscrowTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockUSDC internal usdc;
    ToolshedEscrow internal escrow;

    address internal steward = address(0xA11CE);
    address internal borrower = address(0xB0B);
    address internal owner = address(0xCAFE);
    bytes32 internal toolId = keccak256("cordless-drill");

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new ToolshedEscrow(address(usdc), steward);

        vm.prank(steward);
        escrow.setMember(borrower, true);

        usdc.mint(borrower, 1_000e6);
    }

    function test_RequestLoanEscrowsDepositAndRecordsStats() public {
        vm.startPrank(borrower);
        usdc.approve(address(escrow), 100e6);
        uint256 loanId = escrow.requestLoan(toolId, owner, uint64(block.timestamp + 3 days), 100e6, 10e6);
        vm.stopPrank();

        assertEq(loanId, 1, "loan id");
        assertEq(usdc.balanceOf(address(escrow)), 100e6, "escrowed deposit");

        (uint64 loans,,,,) = escrow.stats(borrower);
        assertEq(uint256(loans), 1, "borrower loan count");
    }

    function test_ReturnOnTimeRefundsBorrower() public {
        uint256 loanId = requestDefaultLoan();
        uint256 borrowerBefore = usdc.balanceOf(borrower);

        vm.prank(owner);
        escrow.returnTool(loanId);

        assertEq(usdc.balanceOf(borrower), borrowerBefore + 100e6, "full refund");
        assertEq(usdc.balanceOf(owner), 0, "owner fee");

        (, uint64 onTimeReturns,,,) = escrow.stats(borrower);
        assertEq(uint256(onTimeReturns), 1, "on-time return count");
    }

    function test_ReturnLatePaysOwnerAndCapsAtDeposit() public {
        uint256 loanId = requestDefaultLoan();
        vm.warp(block.timestamp + 6 days + 1);

        vm.prank(owner);
        escrow.returnTool(loanId);

        assertEq(usdc.balanceOf(owner), 40e6, "four late days");
        assertEq(usdc.balanceOf(borrower), 960e6, "partial refund plus remaining balance");

        (,, uint64 lateReturns, uint256 lateFeesPaid,) = escrow.stats(borrower);
        assertEq(uint256(lateReturns), 1, "late return count");
        assertEq(lateFeesPaid, 40e6, "late fees paid");
    }

    function test_RevertWhenNonMemberRequestsLoan() public {
        address outsider = address(0xBAD);
        usdc.mint(outsider, 100e6);

        vm.startPrank(outsider);
        usdc.approve(address(escrow), 100e6);
        vm.expectRevert(ToolshedEscrow.NotMember.selector);
        escrow.requestLoan(toolId, owner, uint64(block.timestamp + 3 days), 100e6, 10e6);
        vm.stopPrank();
    }

    function test_RevertWhenNonOwnerConfirmsReturn() public {
        uint256 loanId = requestDefaultLoan();

        vm.prank(borrower);
        vm.expectRevert(ToolshedEscrow.OnlyToolOwner.selector);
        escrow.returnTool(loanId);
    }

    function requestDefaultLoan() internal returns (uint256 loanId) {
        vm.startPrank(borrower);
        usdc.approve(address(escrow), 100e6);
        loanId = escrow.requestLoan(toolId, owner, uint64(block.timestamp + 3 days), 100e6, 10e6);
        vm.stopPrank();
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        require(actual == expected, message);
    }
}
