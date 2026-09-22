// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Toolshed} from "../src/Toolshed.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/// @notice Runs the full loan lifecycle against the real Circle USDC contract
///         on Base, so we are testing the actual token we ship against
///         (6 decimals, proxied implementation, non-standard approve quirks)
///         and not only our mock.
///
/// Skipped automatically when BASE_RPC_URL is unset, so `forge test` stays
/// green offline. Run it with:
///   BASE_RPC_URL=https://mainnet.base.org forge test --match-contract Fork -vv
contract ToolshedForkTest is Test {
    /// Circle-issued native USDC on Base. Source: Circle's official
    /// "USDC contract addresses" docs. Verify before use:
    ///   cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url $BASE_RPC_URL
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    Toolshed internal shed;
    IERC20 internal usdc;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        forked = true;

        usdc = IERC20(BASE_USDC);
        shed = new Toolshed(usdc);

        deal(BASE_USDC, bob, 500e6);
        vm.prank(bob);
        usdc.approve(address(shed), type(uint256).max);
    }

    modifier onlyForked() {
        if (!forked) {
            emit log("BASE_RPC_URL unset - skipping fork test");
            return;
        }
        _;
    }

    function test_fork_sanityCheckToken() public onlyForked {
        assertEq(usdc.totalSupply() > 0, true, "real USDC has supply");
        assertEq(usdc.balanceOf(bob), 500e6);
    }

    function test_fork_lateLoanSettlesAgainstRealUsdc() public onlyForked {
        uint96 deposit = 60e6;
        uint96 dailyFee = 2e6;

        vm.prank(bob);
        uint256 loanId = shed.request(alice, keccak256("listing:1"), deposit, dailyFee, 4);
        assertEq(usdc.balanceOf(address(shed)), deposit);

        vm.prank(alice);
        shed.approve(loanId);

        skip(4 days + 2 days); // two days late

        vm.prank(alice);
        shed.confirmReturn(loanId);

        assertEq(usdc.balanceOf(alice), 2 * dailyFee, "owner receives late fee");
        assertEq(usdc.balanceOf(bob), 500e6 - 2 * dailyFee, "borrower refunded remainder");
        assertEq(usdc.balanceOf(address(shed)), 0, "escrow drained");
    }
}
