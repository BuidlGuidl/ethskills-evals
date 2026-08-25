// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../../src/SubscriptionBilling.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {BillingHandler} from "./BillingHandler.sol";

contract BillingInvariantsTest is Test {
    SubscriptionBilling internal billing;
    MockUSDC internal usdc;
    BillingHandler internal handler;
    address internal owner = makeAddr("owner");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        billing = new SubscriptionBilling(IERC20(address(usdc)), owner);

        uint256[] memory ids = new uint256[](2);
        vm.startPrank(owner);
        ids[0] = billing.createPlan(5e6);
        ids[1] = billing.createPlan(20e6);
        vm.stopPrank();

        handler = new BillingHandler(billing, usdc, owner, ids);

        targetContract(address(handler));
        excludeSender(address(billing));
    }

    /// @notice The contract always holds at least what it owes everyone.
    function invariant_solvent() public view {
        assertGe(usdc.balanceOf(address(billing)), billing.totalUserBalance() + billing.operatorAccrued());
    }

    /// @notice Subscriber float and operator revenue are disjoint pots that account for every
    ///         token in the contract. This is the property that makes "the owner cannot take
    ///         prepaid balances" true rather than merely intended.
    function invariant_everyTokenIsAccountedFor() public view {
        assertEq(usdc.balanceOf(address(billing)), billing.totalUserBalance() + billing.operatorAccrued());
    }

    /// @notice `totalUserBalance` really is the sum of the individual prepaid balances.
    function invariant_userBalancesSumToTotal() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); ++i) {
            (,, uint256 balance,,,) = billing.accountOf(handler.actors(i));
            sum += balance;
        }
        assertEq(sum, billing.totalUserBalance());
    }

    /// @notice Nothing is minted or burned: everything deposited is still held, refunded, or paid out.
    function invariant_tokensAreConserved() public view {
        assertEq(
            handler.ghostDeposited(),
            billing.totalUserBalance() + billing.operatorAccrued() + handler.ghostRefunded()
                + handler.ghostWithdrawn()
        );
    }

    /// @notice `paidThrough` is safe for a backend to cache: if the cached instant has not passed,
    ///         the address is genuinely still subscribed.
    function invariant_paidThroughNeverOverstatesAccess() public view {
        for (uint256 i = 0; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            if (block.timestamp < billing.paidThrough(actor)) {
                assertTrue(billing.isSubscribed(actor), "cached expiry outlived real access");
            }
        }
    }

    /// @notice A subscription can never go into debt, so a lapsed account costs nothing to leave.
    function invariant_noSubscriberOwesMoreThanTheyPrepaid() public view {
        for (uint256 i = 0; i < handler.actorCount(); ++i) {
            address actor = handler.actors(i);
            (,, uint256 balance, uint256 unused,,) = billing.accountOf(actor);
            assertLe(unused, balance);
            assertLe(billing.pendingCharge(actor), balance);
        }
    }

    function invariant_callSummary() public view {
        console.log(
            "subscribe %s | topUp %s | cancel %s",
            handler.calls("subscribe"),
            handler.calls("topUp"),
            handler.calls("cancel")
        );
        console.log(
            "settle %s | withdraw %s | warp %s",
            handler.calls("settle"),
            handler.calls("withdraw"),
            handler.calls("warp")
        );
    }
}
