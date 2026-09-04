// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionBilling} from "../../src/SubscriptionBilling.sol";
import {IERC20} from "../../src/IERC20.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {Handler} from "./Handler.sol";

/// @notice Properties that must hold after ANY sequence of user and operator actions,
///         with arbitrary amounts of time passing in between.
contract BillingInvariants is Test {
    SubscriptionBilling billing;
    MockUSDC usdc;
    Handler handler;
    address owner = makeAddr("owner");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        uint8[] memory ids = new uint8[](2);
        uint128[] memory prices = new uint128[](2);
        (ids[0], prices[0]) = (1, 5e6);
        (ids[1], prices[1]) = (2, 20e6);
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner, ids, prices);

        handler = new Handler(billing, usdc, owner);
        targetContract(address(handler));
    }

    /// @notice The one that matters: the contract can always pay everyone it owes.
    function invariant_solvent() public view {
        assertGe(
            usdc.balanceOf(address(billing)),
            uint256(billing.totalEscrowed()) + billing.revenue(),
            "contract holds less than it owes"
        );
    }

    /// @notice Escrow accounting matches the sum of the parts — no drift, no orphaned balance.
    function invariant_escrowEqualsSumOfAccounts() public view {
        uint256 sum;
        uint256 n = handler.actorCount();
        for (uint256 i; i < n; ++i) {
            (uint128 bal,,,) = billing.accounts(handler.actors(i));
            sum += bal;
        }
        assertEq(sum, billing.totalEscrowed(), "totalEscrowed drifted from reality");
    }

    /// @notice Every dollar that ever entered is still accounted for somewhere.
    function invariant_noValueCreatedOrDestroyed() public view {
        uint256 inflow = handler.ghost_deposited();
        uint256 outflow = handler.ghost_withdrawn() + handler.ghost_collected();
        uint256 stillHeld = uint256(billing.totalEscrowed()) + billing.revenue();
        assertEq(inflow, outflow + stillHeld, "value leaked");
    }

    /// @notice A customer can always take back what the contract says they can take back.
    function invariant_withdrawableIsAlwaysHonoured() public {
        uint256 n = handler.actorCount();
        for (uint256 i; i < n; ++i) {
            address a = handler.actors(i);
            uint256 w = billing.withdrawable(a);
            if (w == 0) continue;
            uint256 snap = vm.snapshotState();
            vm.prank(a);
            billing.withdraw(w, a);
            vm.revertToState(snap);
        }
    }

    /// @notice Accrued charges never exceed what the customer prepaid. Nobody goes into debt.
    function invariant_noCustomerOwesMoreThanTheyDeposited() public view {
        uint256 n = handler.actorCount();
        for (uint256 i; i < n; ++i) {
            address a = handler.actors(i);
            (uint128 bal,,,) = billing.accounts(a);
            assertLe(billing.accrued(a), bal, "accrued more than the balance");
        }
    }
}
