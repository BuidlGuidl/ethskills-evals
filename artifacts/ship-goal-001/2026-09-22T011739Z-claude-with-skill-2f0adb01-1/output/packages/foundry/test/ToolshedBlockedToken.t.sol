// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Toolshed } from "../contracts/Toolshed.sol";
import { BlockingUSDC } from "./MockUSDC.sol";

/**
 * @notice USDC can blacklist an address. A push refund to a blacklisted borrower must not be
 *         able to revert a settlement — that would freeze the owner's fee, the borrower's
 *         deposit and the tool itself. The payout is credited instead, and pulled later.
 */
contract ToolshedBlockedTokenTest is Test {
    Toolshed internal shed;
    BlockingUSDC internal usdc;

    address internal steward = makeAddr("steward");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint96 internal constant DEPOSIT = 60e6;
    uint96 internal constant FEE_PER_DAY = 2e6;

    function setUp() public {
        usdc = new BlockingUSDC();
        shed = new Toolshed(IERC20(address(usdc)), steward);

        address[] memory roster = new address[](2);
        roster[0] = alice;
        roster[1] = bob;
        vm.prank(steward);
        shed.admitMembers(roster);

        usdc.mint(bob, 1000e6);
    }

    function _request(uint16 durationDays) internal returns (uint256 loanId) {
        vm.prank(alice);
        uint256 toolId = shed.listTool("ipfs://tool", DEPOSIT, FEE_PER_DAY, 14);
        vm.startPrank(bob);
        usdc.approve(address(shed), DEPOSIT);
        loanId = shed.requestLoan(toolId, durationDays);
        vm.stopPrank();
    }

    function test_BlockedBorrowerDoesNotStallACancelledRequest() public {
        uint256 loanId = _request(3);
        usdc.setBlocked(bob, true);

        vm.prank(alice);
        shed.declineRequest(loanId); // must not revert

        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Declined));
        assertEq(shed.credits(bob), DEPOSIT, "refund is waiting to be pulled");
        assertEq(shed.getMember(bob).openBorrows, 0, "the slot is freed either way");

        vm.prank(bob);
        vm.expectRevert(); // still blocked
        shed.withdrawCredit();

        usdc.setBlocked(bob, false);
        vm.prank(bob);
        shed.withdrawCredit();
        assertEq(usdc.balanceOf(bob), 1000e6);
        assertEq(shed.credits(bob), 0);
    }

    function test_BlockedBorrowerCannotHoldTheOwnersFeeHostage() public {
        uint256 loanId = _request(2);
        vm.prank(alice);
        shed.approveRequest(loanId);

        usdc.setBlocked(bob, true);
        vm.warp(block.timestamp + 5 days); // 3 days late

        vm.prank(alice);
        shed.confirmReturn(loanId);

        uint256 fee = 3 * uint256(FEE_PER_DAY);
        assertEq(usdc.balanceOf(alice), fee, "owner is paid straight away");
        assertEq(shed.credits(bob), DEPOSIT - fee, "only the borrower's leg waits");
        assertEq(shed.credits(alice), 0);
    }

    function test_WithdrawRevertsWithNothingWaiting() public {
        vm.prank(bob);
        vm.expectRevert(Toolshed.NothingToWithdraw.selector);
        shed.withdrawCredit();
    }
}
