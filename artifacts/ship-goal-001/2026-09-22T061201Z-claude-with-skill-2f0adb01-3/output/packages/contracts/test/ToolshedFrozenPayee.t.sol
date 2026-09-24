// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {BlockableUSDC} from "./mocks/BlockableUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Real USDC can freeze an address. If a payout to one party reverted, a naive escrow would
 * revert the whole settlement — pinning the *other* party's money and the tool with it. These
 * tests pin down the credit fallback that prevents that.
 */
contract ToolshedFrozenPayeeTest is Test {
    Toolshed shed;
    BlockableUSDC usdc;

    address steward = makeAddr("steward");
    address ana = makeAddr("ana");
    address ben = makeAddr("ben");

    uint96 constant DEPOSIT = 40e6;
    uint96 constant LATE_FEE = 3e6;
    string constant URI = "ipfs://bafyTool";

    function setUp() public {
        usdc = new BlockableUSDC();
        shed = new Toolshed(IERC20(address(usdc)), steward, 2_000e6);

        address[] memory roster = new address[](2);
        roster[0] = ana;
        roster[1] = ben;
        vm.prank(steward);
        shed.admitMembers(roster);

        for (uint256 i; i < roster.length; ++i) {
            usdc.mint(roster[i], 1_000e6);
            vm.prank(roster[i]);
            usdc.approve(address(shed), type(uint256).max);
        }
        vm.warp(1_760_000_000);
    }

    function _activeLoan() internal returns (uint64 loanId) {
        vm.prank(ana);
        uint64 toolId = shed.listTool(URI, DEPOSIT, LATE_FEE, 7);
        vm.prank(ben);
        loanId = shed.requestLoan(toolId, 3);
        vm.prank(ana);
        shed.approveRequest(loanId);
    }

    function test_frozenBorrowerDoesNotBlockTheOwnersFee() public {
        uint64 loanId = _activeLoan();
        uint256 anaBefore = usdc.balanceOf(ana);

        usdc.setFrozen(ben, true);
        vm.warp(shed.getLoan(loanId).dueAt + 2 days);

        vm.prank(ana);
        shed.confirmReturn(loanId); // must not revert

        uint96 fee = 2 * LATE_FEE;
        assertEq(usdc.balanceOf(ana), anaBefore + fee, "the owner is paid as normal");
        assertEq(shed.credits(ben), DEPOSIT - fee, "the borrower's refund is credited, not lost");
        assertEq(shed.totalCredited(), DEPOSIT - fee);
        assertEq(shed.totalEscrowed(), 0);
        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Settled));
        assertEq(shed.getTool(shed.getLoan(loanId).toolId).activeLoanId, 0, "the tool is lendable again");

        // Once they are unfrozen, they pull their refund themselves.
        usdc.setFrozen(ben, false);
        uint256 benBefore = usdc.balanceOf(ben);
        vm.prank(ben);
        shed.withdrawCredits();
        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT - fee);
        assertEq(shed.credits(ben), 0);
        assertEq(shed.totalCredited(), 0);
    }

    function test_frozenOwnerDoesNotBlockTheBorrowersRefund() public {
        uint64 loanId = _activeLoan();
        uint256 benBefore = usdc.balanceOf(ben);

        usdc.setFrozen(ana, true);
        vm.warp(shed.getLoan(loanId).dueAt + 1 days);

        vm.prank(ben);
        shed.reportReturn(loanId);
        vm.warp(block.timestamp + shed.CONFIRM_WINDOW());
        vm.prank(ben);
        shed.settleUnconfirmed(loanId);

        assertEq(usdc.balanceOf(ben), benBefore + DEPOSIT - LATE_FEE, "refund lands");
        assertEq(shed.credits(ana), LATE_FEE, "the owner's fee waits for them");
    }

    function test_frozenBorrowerCanStillHaveARequestRefunded() public {
        vm.prank(ana);
        uint64 toolId = shed.listTool(URI, DEPOSIT, LATE_FEE, 7);
        vm.prank(ben);
        uint64 loanId = shed.requestLoan(toolId, 3);

        usdc.setFrozen(ben, true);

        vm.prank(ana);
        shed.declineRequest(loanId); // must not revert

        assertEq(uint8(shed.getLoan(loanId).status), uint8(Toolshed.LoanStatus.Declined));
        assertEq(shed.credits(ben), DEPOSIT);
        assertEq(shed.totalEscrowed(), 0);
    }

    function test_creditsAreNotSweepableAsStrayTokens() public {
        uint64 loanId = _activeLoan();
        usdc.setFrozen(ben, true);
        vm.prank(ana);
        shed.confirmReturn(loanId);

        vm.prank(steward);
        vm.expectRevert(Toolshed.NothingToSweep.selector);
        shed.sweepStrayTokens(steward);
    }

    function test_withdrawCreditsRevertsWhenThereIsNothing() public {
        vm.prank(ben);
        vm.expectRevert(Toolshed.NothingToWithdraw.selector);
        shed.withdrawCredits();
    }
}
