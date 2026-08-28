// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/Toolshed.sol";
import "../contracts/MockUSDC.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
}

contract ToolshedTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    Toolshed shed;
    MockUSDC usdc;
    address owner = address(0xA11CE);
    address borrower = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        shed = new Toolshed(address(usdc));
        shed.setMember(owner, true);
        shed.setMember(borrower, true);
        usdc.mint(borrower, 500e6);
        vm.prank(owner);
        shed.listTool("Drill", "ipfs://photo", "Good", 100e6, 5e6);
        vm.prank(borrower);
        usdc.approve(address(shed), 500e6);
    }

    function testOnTimeLoanReturnsFullDepositAndBuildsReputation() public {
        vm.prank(borrower);
        uint256 loan = shed.requestLoan(1, 3);
        vm.prank(owner);
        shed.acceptLoan(loan);
        vm.warp(block.timestamp + 2 days);
        vm.prank(borrower);
        shed.markReturned(loan);
        vm.prank(owner);
        shed.confirmReturned(loan);
        require(usdc.balanceOf(borrower) == 500e6, "full refund");
        (uint32 completed, uint32 late) = shed.reputation(borrower);
        require(completed == 1 && late == 0, "reputation");
        (,,,,,,, bool available,) = shed.tools(1);
        require(available, "available again");
    }

    function testLateFeeRoundsUpAndPaysOwner() public {
        vm.prank(borrower);
        uint256 loan = shed.requestLoan(1, 2);
        vm.prank(owner);
        shed.acceptLoan(loan);
        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(borrower);
        shed.markReturned(loan);
        vm.prank(owner);
        shed.confirmReturned(loan);
        require(usdc.balanceOf(owner) == 10e6, "two late days paid");
        require(usdc.balanceOf(borrower) == 490e6, "fee deducted");
        (uint32 completed, uint32 late) = shed.reputation(borrower);
        require(completed == 1 && late == 1, "late recorded");
    }

    function testRejectedRequestRefundsDeposit() public {
        vm.prank(borrower);
        uint256 loan = shed.requestLoan(1, 2);
        vm.prank(owner);
        shed.rejectLoan(loan);
        require(usdc.balanceOf(borrower) == 500e6, "refunded");
    }

    function testBorrowerCanFinalizeAfterOwnerTimeout() public {
        vm.prank(borrower);
        uint256 loan = shed.requestLoan(1, 1);
        vm.prank(owner);
        shed.acceptLoan(loan);
        vm.prank(borrower);
        shed.markReturned(loan);
        vm.warp(block.timestamp + 3 days);
        vm.prank(borrower);
        shed.finalizeUnconfirmedReturn(loan);
        require(usdc.balanceOf(borrower) == 500e6, "not held hostage");
    }

    function testLateFeeCannotExceedDeposit() public {
        vm.prank(borrower);
        uint256 loan = shed.requestLoan(1, 1);
        vm.prank(owner);
        shed.acceptLoan(loan);
        vm.warp(block.timestamp + 40 days);
        vm.prank(borrower);
        shed.markReturned(loan);
        vm.prank(owner);
        shed.confirmReturned(loan);
        require(usdc.balanceOf(owner) == 100e6, "fee capped at deposit");
        require(usdc.balanceOf(borrower) == 400e6, "no overcharge");
    }
}
