// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { Toolshed } from "../contracts/Toolshed.sol";

/**
 * @notice Runs the whole loan lifecycle against the real USDC contract on a Base fork, so we
 *         know the escrow works with Circle's actual token and not just a friendly mock.
 *
 * Skips itself if there's no reachable Base RPC (offline CI). Override with BASE_RPC_URL.
 */
contract ToolshedForkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    Toolshed internal shed;
    IERC20 internal usdc = IERC20(USDC);

    address internal steward = makeAddr("steward");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org"));
        try vm.createSelectFork(rpc) returns (uint256) { }
        catch {
            vm.skip(true);
            return;
        }

        shed = new Toolshed(usdc, steward);
        address[] memory roster = new address[](2);
        roster[0] = alice;
        roster[1] = bob;
        vm.prank(steward);
        shed.admitMembers(roster);

        deal(USDC, bob, 500e6);
    }

    function test_RealUSDCHasSixDecimals() public view {
        assertEq(IERC20Metadata(USDC).decimals(), 6);
        assertEq(IERC20Metadata(USDC).symbol(), "USDC");
    }

    function test_LateLoanSettlesWithRealUSDC() public {
        vm.prank(alice);
        uint256 toolId = shed.listTool("ipfs://bafyMiterSaw", 80e6, 5e6, 7);

        vm.startPrank(bob);
        usdc.approve(address(shed), 80e6);
        uint256 loanId = shed.requestLoan(toolId, 3);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(shed)), 80e6);

        vm.prank(alice);
        shed.approveRequest(loanId);

        vm.warp(block.timestamp + 5 days); // 2 days late
        vm.prank(bob);
        shed.declareReturn(loanId);
        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), 10e6, "2 days x 5 USDC");
        assertEq(usdc.balanceOf(bob), 500e6 - 10e6);
        assertEq(usdc.balanceOf(address(shed)), 0);
    }
}
