// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ToolshedEscrow} from "../contracts/ToolshedEscrow.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert() external;
}

contract ToolshedEscrowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    MockUSDC token;
    ToolshedEscrow escrow;
    address borrower = address(0xB0B);
    address lender = address(0xA11CE);
    uint64 due;

    function setUp() public {
        token = new MockUSDC();
        escrow = new ToolshedEscrow(address(token), address(this));
        escrow.setMember(borrower, true);
        escrow.setMember(lender, true);
        token.mint(borrower, 100e6);
        vm.prank(borrower);
        token.approve(address(escrow), type(uint256).max);
        due = uint64(block.timestamp + 3 days);
    }

    function testOnTimeReturnRefundsFullDeposit() public {
        uint256 id = _request(30e6, 2e6);
        vm.prank(lender); escrow.acceptLoan(id);
        vm.warp(due - 1);
        vm.prank(borrower); escrow.markReturned(id);
        vm.prank(lender); escrow.confirmReturn(id);
        _eq(token.balanceOf(borrower), 100e6);
        _eq(escrow.completedLoans(borrower), 1);
        _eq(escrow.lateReturns(borrower), 0);
    }

    function testLateFeeRoundsUpAndPaysOwner() public {
        uint256 id = _request(30e6, 2e6);
        vm.prank(lender); escrow.acceptLoan(id);
        vm.warp(due + 1 days + 1);
        vm.prank(borrower); escrow.markReturned(id);
        vm.prank(lender); escrow.confirmReturn(id);
        _eq(token.balanceOf(lender), 4e6);
        _eq(token.balanceOf(borrower), 96e6);
        _eq(escrow.lateReturns(borrower), 1);
    }

    function testLateFeeIsCappedAtDeposit() public {
        uint256 id = _request(5e6, 2e6);
        vm.prank(lender); escrow.acceptLoan(id);
        vm.warp(due + 20 days);
        vm.prank(borrower); escrow.markReturned(id);
        vm.prank(lender); escrow.confirmReturn(id);
        _eq(token.balanceOf(lender), 5e6);
        _eq(token.balanceOf(borrower), 95e6);
    }

    function testCancellationReturnsEscrow() public {
        uint256 id = _request(30e6, 2e6);
        vm.prank(borrower); escrow.cancelRequest(id);
        _eq(token.balanceOf(borrower), 100e6);
    }

    function testNonMemberCannotRequest() public {
        vm.prank(address(123)); vm.expectRevert();
        escrow.requestLoan(bytes32(uint256(1)), lender, due, 10e6, 1e6);
    }

    function testStewardCanResolveStalledReturn() public {
        uint256 id = _request(30e6, 2e6);
        vm.prank(lender); escrow.acceptLoan(id);
        vm.warp(due + 3 days);
        escrow.stewardSettle(id, due + 1 days);
        _eq(token.balanceOf(lender), 2e6);
    }

    function _request(uint128 deposit, uint128 fee) internal returns (uint256) {
        vm.prank(borrower);
        return escrow.requestLoan(bytes32(uint256(1)), lender, due, deposit, fee);
    }

    function _eq(uint256 actual, uint256 expected) internal pure { require(actual == expected, "not equal"); }
}
