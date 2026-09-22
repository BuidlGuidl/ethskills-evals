// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ToolshedEscrow} from "../src/ToolshedEscrow.sol";

/// @notice Runs the full loan lifecycle against the real USDC contract on Base mainnet.
///
/// The mock in `ToolshedEscrow.t.sol` proves the fee arithmetic; this proves the integration —
/// real USDC returns a bool from `transfer`, is behind a proxy, and has a blocklist hook on every
/// transfer. Requires `BASE_RPC_URL`; skipped when it is not set so `forge test` still works
/// offline.
///
///     forge test --match-contract ToolshedEscrowForkTest
contract ToolshedEscrowForkTest is Test {
    /// @dev Native USDC on Base, from Circle's official address list:
    ///      https://developers.circle.com/stablecoins/usdc-contract-addresses
    IERC20 internal constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    ToolshedEscrow internal escrow;
    uint256 internal ownerKey = 0xA11CE;
    address internal owner;
    address internal borrower = address(0xB0B);
    address internal arbiter = address(0xA2B);

    uint128 internal constant DEPOSIT = 100e6;
    uint128 internal constant DAILY_FEE = 10e6;

    bool internal enabled;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        enabled = true;

        owner = vm.addr(ownerKey);
        escrow = new ToolshedEscrow(USDC, arbiter);

        deal(address(USDC), borrower, 500e6);
        vm.prank(borrower);
        USDC.approve(address(escrow), type(uint256).max);
    }

    modifier onFork() {
        if (!enabled) {
            emit log("BASE_RPC_URL not set - skipping fork test");
            return;
        }
        _;
    }

    function test_fork_usdcIsTheExpectedToken() public onFork {
        assertEq(USDC.totalSupply() > 0, true, "USDC has supply on this fork");
        assertEq(address(escrow.token()), address(USDC));
    }

    function test_fork_lateLoanSettlesInRealUSDC() public onFork {
        ToolshedEscrow.Terms memory terms = ToolshedEscrow.Terms({
            owner: owner,
            borrower: borrower,
            listingId: keccak256("listing:pressure-washer"),
            deposit: DEPOSIT,
            dailyLateFee: DAILY_FEE,
            dueAt: uint64(block.timestamp) + 3 days,
            offerExpiry: uint64(block.timestamp) + 1 days,
            salt: 1
        });

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, escrow.hashTerms(terms));
        vm.prank(borrower);
        bytes32 loanId = escrow.openLoan(terms, abi.encodePacked(r, s, v));
        assertEq(USDC.balanceOf(address(escrow)), DEPOSIT, "real USDC escrowed");

        vm.warp(terms.dueAt + 2 days);
        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(USDC.balanceOf(owner), 2 * DAILY_FEE, "owner paid two late days in USDC");
        assertEq(USDC.balanceOf(borrower), 500e6 - 2 * DAILY_FEE, "borrower refunded the rest");
        assertEq(USDC.balanceOf(address(escrow)), 0, "escrow emptied");
    }

    function test_fork_onTimeReturnRefundsInFull() public onFork {
        ToolshedEscrow.Terms memory terms = ToolshedEscrow.Terms({
            owner: owner,
            borrower: borrower,
            listingId: keccak256("listing:ladder"),
            deposit: DEPOSIT,
            dailyLateFee: DAILY_FEE,
            dueAt: uint64(block.timestamp) + 5 days,
            offerExpiry: uint64(block.timestamp) + 1 days,
            salt: 2
        });

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, escrow.hashTerms(terms));
        vm.prank(borrower);
        bytes32 loanId = escrow.openLoan(terms, abi.encodePacked(r, s, v));

        skip(4 days);
        vm.prank(owner);
        escrow.confirmReturn(loanId);

        assertEq(USDC.balanceOf(borrower), 500e6, "borrower made whole");
        assertEq(USDC.balanceOf(owner), 0);
    }
}
