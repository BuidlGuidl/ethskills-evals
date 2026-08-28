// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ToolshedEscrow, IERC20} from "../../src/contracts/ToolshedEscrow.sol";

interface Vm { function prank(address) external; function warp(uint256) external; function expectRevert() external; }

contract MockUSDC is IERC20 {
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    function mint(address to,uint256 amount) external { balanceOf[to]+=amount; }
    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
    function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
    function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
}

contract ToolshedEscrowTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockUSDC token; ToolshedEscrow escrow;
    address borrower=address(0xB0); address owner=address(0xA0); address admin=address(0xAD);
    bytes32 id=keccak256("loan-1");

    function setUp() public { token=new MockUSDC(); escrow=new ToolshedEscrow(address(token),admin); token.mint(borrower,100e6); vm.prank(borrower);token.approve(address(escrow),100e6); }
    function fund(uint64 due) internal {vm.prank(borrower);escrow.fundLoan(id,owner,due,50e6,3e6,keccak256("metadata"));vm.prank(owner);escrow.activateLoan(id);}

    function testOnTimeReturnRefundsFullDeposit() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(borrower)==100e6,"full refund");require(token.balanceOf(owner)==0,"no fee");}
    function testPartialDayRoundsUpAndPaysOwner() public {uint64 due=uint64(block.timestamp+3 days);fund(due);vm.warp(due+1);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==3e6,"one day fee");require(token.balanceOf(borrower)==97e6,"remainder");}
    function testLateFeeIsCappedAtDeposit() public {uint64 due=uint64(block.timestamp+1 days);fund(due);vm.warp(due+100 days);vm.prank(owner);escrow.confirmReturn(id);require(token.balanceOf(owner)==50e6,"capped fee");require(token.balanceOf(address(escrow))==0,"no dust");}
    function testBorrowerCanCancelBeforeHandoff() public {vm.prank(borrower);escrow.fundLoan(id,owner,uint64(block.timestamp+3 days),50e6,3e6,bytes32(0));vm.prank(borrower);escrow.cancelLoan(id);require(token.balanceOf(borrower)==100e6,"refund");}
    function testCannotCancelActiveLoan() public {fund(uint64(block.timestamp+3 days));vm.prank(borrower);vm.expectRevert();escrow.cancelLoan(id);}
    function testAdminCanResolveDisputeAtDocumentedTime() public {uint64 due=uint64(block.timestamp+2 days);fund(due);vm.warp(due+5 days);vm.prank(admin);escrow.resolveReturn(id,due+1 days);require(token.balanceOf(owner)==3e6,"documented fee");}
    function testStrangerCannotSettle() public {fund(uint64(block.timestamp+3 days));vm.prank(address(0xBAD));vm.expectRevert();escrow.confirmReturn(id);}
}
