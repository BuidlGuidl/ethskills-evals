// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Toolshed} from "../src/Toolshed.sol";

/// @notice Runs the full loan lifecycle against the real Circle USDC contract on Base,
///         rather than a mock. USDC is an upgradeable proxy with a blocklist and hooks of
///         its own, so the escrow's `transferFrom`/`transfer` path is worth exercising for real.
///
/// Set BASE_RPC_URL to run these; without it they skip so that `forge test` stays green offline.
contract ToolshedForkTest is Test {
    /// @dev Circle's native USDC on Base mainnet (chain 8453). Verified onchain:
    ///      `cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)"` -> "USDC".
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    IERC20 internal usdc = IERC20(BASE_USDC);
    Toolshed internal shed;

    uint256 internal ownerKey = 0xA11CE;
    address internal toolOwner;
    address internal borrower = address(0xB0B);
    address internal steward = address(0x51EA);

    bool internal live;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        live = true;

        toolOwner = vm.addr(ownerKey);
        address[] memory roster = new address[](2);
        roster[0] = toolOwner;
        roster[1] = borrower;
        shed = new Toolshed(usdc, steward, roster);

        deal(BASE_USDC, borrower, 500e6);
        vm.prank(borrower);
        usdc.approve(address(shed), type(uint256).max);
    }

    function test_fork_realUsdcLoanRoundTripWithLateFee() public {
        if (!live) {
            emit log("BASE_RPC_URL unset - skipping fork test");
            return;
        }

        assertEq(usdc.balanceOf(borrower), 500e6, "deal() funded the borrower");

        Toolshed.LoanOffer memory offer = Toolshed.LoanOffer({
            toolId: keccak256("listing:tile-saw"),
            owner: toolOwner,
            borrower: borrower,
            deposit: 80e6,
            lateFeePerDay: 4e6,
            dueAt: uint64(block.timestamp + 3 days),
            maxLateDays: 20,
            offerExpiry: uint64(block.timestamp + 1 days),
            nonce: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, shed.hashOffer(offer));
        vm.prank(borrower);
        uint256 loanId = shed.startLoan(offer, abi.encodePacked(r, s, v));

        assertEq(usdc.balanceOf(address(shed)), 80e6, "real USDC escrowed");

        vm.warp(uint256(offer.dueAt) + 2 days + 1); // two full days plus a bit -> three billable days
        vm.prank(toolOwner);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(toolOwner), 12e6, "owner paid three late days");
        assertEq(usdc.balanceOf(borrower), 500e6 - 12e6, "borrower refunded the rest");
        assertEq(usdc.balanceOf(address(shed)), 0, "escrow empty");
    }
}
