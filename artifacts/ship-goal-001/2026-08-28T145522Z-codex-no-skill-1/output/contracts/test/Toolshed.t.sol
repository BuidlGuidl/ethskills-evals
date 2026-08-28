// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/Toolshed.sol";
import "../src/MockUSDC.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract ToolshedTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant OWNER = address(0xA11CE);
    address private constant BORROWER = address(0xB0B);
    MockUSDC private usdc;
    Toolshed private shed;

    function setUp() public {
        usdc = new MockUSDC();
        shed = new Toolshed(address(usdc));
        usdc.mint(BORROWER, 1_000e6);
        vm.prank(BORROWER);
        usdc.approve(address(shed), type(uint256).max);
    }

    function listAndBorrow() private returns (uint256 loanId) {
        vm.prank(OWNER);
        uint256 toolId = shed.listTool("Drill", "18V cordless", "ipfs://photo", "Good", 50e6, 5e6);
        vm.prank(BORROWER);
        loanId = shed.borrow(toolId, 3);
    }

    function testOnTimeReturnRefundsFullDeposit() public {
        uint256 loanId = listAndBorrow();
        vm.prank(OWNER);
        shed.confirmReturn(loanId);
        require(usdc.balanceOf(BORROWER) == 1_000e6, "full refund expected");
        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
        require(completed == 1 && late == 0, "wrong reputation");
    }

    function testLateFeeRoundsUpAndPaysOwner() public {
        uint256 loanId = listAndBorrow();
        (,,,, uint64 dueAt,,,,) = shed.loans(loanId);
        vm.warp(uint256(dueAt) + 1 days + 1);
        vm.prank(OWNER);
        shed.confirmReturn(loanId);
        require(usdc.balanceOf(OWNER) == 10e6, "two late days expected");
        require(usdc.balanceOf(BORROWER) == 990e6, "wrong refund");
        (uint32 completed, uint32 late) = shed.reputation(BORROWER);
        require(completed == 1 && late == 1, "wrong reputation");
    }

    function testFeeIsCappedAtDeposit() public {
        uint256 loanId = listAndBorrow();
        (,,,, uint64 dueAt,,,,) = shed.loans(loanId);
        vm.warp(uint256(dueAt) + 100 days);
        vm.prank(OWNER);
        shed.confirmReturn(loanId);
        require(usdc.balanceOf(OWNER) == 50e6, "fee must cap");
    }

    function testCannotBorrowOwnTool() public {
        vm.prank(OWNER);
        uint256 id = shed.listTool("Saw", "", "", "Good", 20e6, 1e6);
        vm.expectRevert(Toolshed.Unavailable.selector);
        vm.prank(OWNER);
        shed.borrow(id, 1);
    }
}
