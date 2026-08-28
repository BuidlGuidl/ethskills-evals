// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ToolshedEscrow, IERC20} from "../src/ToolshedEscrow.sol";

interface Vm { function prank(address) external; function warp(uint256) external; }

contract MockUSDC is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
}

contract ToolshedEscrowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant LENDER = address(0xBEEF);
    address constant BORROWER = address(0xCAFE);
    MockUSDC token;
    ToolshedEscrow escrow;

    function setUp() public {
        token = new MockUSDC();
        escrow = new ToolshedEscrow(address(token), address(this));
        escrow.setMember(LENDER, true);
        escrow.setMember(BORROWER, true);
        token.mint(BORROWER, 100e6);
        vm.prank(BORROWER); token.approve(address(escrow), type(uint256).max);
    }

    function _loan(uint64 dueAt) internal returns (uint256) {
        vm.prank(BORROWER);
        return escrow.createLoan(keccak256("drill-1"), LENDER, 100e6, 7e6, dueAt);
    }

    function testOnTimeReturnRefundsFullDeposit() public {
        uint64 due = uint64(block.timestamp + 3 days);
        uint256 id = _loan(due);
        vm.warp(due);
        vm.prank(LENDER); escrow.confirmReturn(id);
        require(token.balanceOf(BORROWER) == 100e6, "refund");
        require(token.balanceOf(LENDER) == 0, "no fee");
    }

    function testLateFeeRoundsUpAndPaysLender() public {
        uint64 due = uint64(block.timestamp + 3 days);
        uint256 id = _loan(due);
        vm.warp(due + 1 days + 1);
        vm.prank(LENDER); escrow.confirmReturn(id);
        require(token.balanceOf(LENDER) == 14e6, "two days fee");
        require(token.balanceOf(BORROWER) == 86e6, "remainder");
    }

    function testLateFeeCannotExceedDeposit() public {
        uint64 due = uint64(block.timestamp + 1 days);
        uint256 id = _loan(due);
        vm.warp(due + 100 days);
        vm.prank(LENDER); escrow.confirmReturn(id);
        require(token.balanceOf(LENDER) == 100e6, "capped");
        require(token.balanceOf(BORROWER) == 0, "no refund");
    }

    function testLenderCanCancelBeforeDueDate() public {
        uint256 id = _loan(uint64(block.timestamp + 3 days));
        vm.prank(LENDER); escrow.cancelLoan(id);
        require(token.balanceOf(BORROWER) == 100e6, "refund");
    }
}

