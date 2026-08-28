// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../contracts/Toolshed.sol";
import "../contracts/MockUSDC.sol";

interface VmTest { function prank(address) external; function warp(uint256) external; }

contract ToolshedTest {
    VmTest constant vm = VmTest(address(uint160(uint256(keccak256("hevm cheat code")))));
    Toolshed shed; MockUSDC coin;
    address owner = address(0xA11CE); address borrower = address(0xB0B);
    function setUp() public {
        coin = new MockUSDC(); shed = new Toolshed(address(coin), address(this));
        shed.setMember(owner, true); shed.setMember(borrower, true); coin.mint(borrower, 100e6);
        vm.prank(owner); shed.listTool("Drill", "18V drill", "ipfs://photo", "Used", 50e6, 5e6);
        vm.prank(borrower); coin.approve(address(shed), type(uint256).max);
    }
    function testOnTimeReturnRefundsDeposit() public {
        vm.prank(borrower); uint256 id=shed.requestLoan(1,3);
        vm.prank(owner); shed.acceptLoan(id);
        vm.prank(borrower); shed.markReturned(id);
        vm.prank(owner); shed.confirmReturn(id);
        assert(coin.balanceOf(borrower)==100e6);
        (uint32 completed,uint32 late)=shed.reputation(borrower); assert(completed==1&&late==0);
    }
    function testLateFeeRoundsUpAndCapsAtDeposit() public {
        vm.prank(borrower); uint256 id=shed.requestLoan(1,2);
        vm.prank(owner); shed.acceptLoan(id);
        vm.warp(block.timestamp+4 days+1);
        vm.prank(borrower); shed.markReturned(id);
        vm.prank(owner); shed.confirmReturn(id);
        assert(coin.balanceOf(owner)==15e6); assert(coin.balanceOf(borrower)==85e6);
        (,uint32 late)=shed.reputation(borrower); assert(late==1);
    }
    function testRejectedRequestRefundsDeposit() public {
        vm.prank(borrower); uint256 id=shed.requestLoan(1,2);
        vm.prank(owner); shed.rejectLoan(id);
        assert(coin.balanceOf(borrower)==100e6);
    }
}

