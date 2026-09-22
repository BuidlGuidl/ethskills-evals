// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ToolshedEscrow} from "../src/ToolshedEscrow.sol";
import {MockUSDC} from "../test/mocks/MockUSDC.sol";

/// @notice Local-only. Stands up a chain a developer can point the app and the indexer at, and
///         drives one real late loan through it so the browse ranking has something to rank.
///
/// Never run these against a live network: `deploy()` ships a fake USDC that anybody can mint.
/// See "Running it locally" in the README for the full sequence.
contract LocalDemo is Script {
    // Anvil's first three accounts.
    uint256 internal constant OWNER_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 internal constant BORROWER_KEY =
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 internal constant ARBITER_KEY =
        0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    /// @dev Anvil (31337) and Base Sepolia (84532). An explicit allowlist rather than a
    ///      "not mainnet" check, so a new chain id has to be added deliberately.
    modifier nonProduction() {
        require(block.chainid == 31337 || block.chainid == 84532, "LocalDemo: non-production only");
        _;
    }

    /// @notice Deploys a fake USDC and the escrow, and funds the borrower.
    function deploy() external nonProduction {
        vm.startBroadcast(OWNER_KEY);
        MockUSDC usdc = new MockUSDC();
        ToolshedEscrow escrow = new ToolshedEscrow(IERC20(address(usdc)), vm.addr(ARBITER_KEY));
        usdc.mint(vm.addr(BORROWER_KEY), 5_000e6);
        vm.stopBroadcast();

        console2.log("NEXT_PUBLIC_USDC_ADDRESS  =", address(usdc));
        console2.log("NEXT_PUBLIC_ESCROW_ADDRESS=", address(escrow));
    }

    /// @notice Opens a loan due at `dueAt`. Set it a few seconds out so a short wait makes the
    ///         loan genuinely late and the settlement has late fees to split.
    /// @dev Every field is caller-supplied, deliberately. `forge script` runs the body twice —
    ///      once to simulate, once to broadcast — and `block.timestamp` differs between the two.
    ///      Deriving any part of the terms from it would mean the loan id printed by the
    ///      simulation is not the loan id the broadcast actually creates.
    function openLoan(
        address escrowAddress,
        address usdcAddress,
        bytes32 listingId,
        uint64 dueAt,
        uint256 salt
    ) external nonProduction {
        ToolshedEscrow escrow = ToolshedEscrow(escrowAddress);

        ToolshedEscrow.Terms memory terms = ToolshedEscrow.Terms({
            owner: vm.addr(OWNER_KEY),
            borrower: vm.addr(BORROWER_KEY),
            listingId: listingId,
            deposit: 60e6,
            dailyLateFee: 3e6,
            dueAt: dueAt,
            offerExpiry: dueAt + 1 hours,
            salt: salt
        });

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_KEY, escrow.hashTerms(terms));

        vm.startBroadcast(BORROWER_KEY);
        IERC20(usdcAddress).approve(escrowAddress, terms.deposit);
        bytes32 loanId = escrow.openLoan(terms, abi.encodePacked(r, s, v));
        vm.stopBroadcast();

        console2.log("loan opened");
        console2.logBytes32(loanId);
    }

    /// @notice Owner confirms the return, settling any late fees out of the deposit.
    function confirmReturn(address escrowAddress, bytes32 loanId) external nonProduction {
        vm.startBroadcast(OWNER_KEY);
        ToolshedEscrow(escrowAddress).confirmReturn(loanId);
        vm.stopBroadcast();
        console2.log("loan settled");
    }
}
