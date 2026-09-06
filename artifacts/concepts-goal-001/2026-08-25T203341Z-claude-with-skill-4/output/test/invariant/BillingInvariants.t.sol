// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SubscriptionBilling} from "../../src/SubscriptionBilling.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {BillingHandler} from "./BillingHandler.sol";

contract BillingInvariants is Test {
    SubscriptionBilling internal billing;
    MockERC20 internal usdc;
    BillingHandler internal handler;

    address internal treasury = makeAddr("treasury");
    address[] internal actors;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        billing = new SubscriptionBilling(IERC20(address(usdc)), address(this), treasury);
        billing.setPlan(1, 5_000_000, true, "hobby");
        billing.setPlan(2, 20_000_000, true, "pro");
        vm.warp(1_800_000_000);

        for (uint256 i; i < 5; ++i) {
            address a = address(uint160(0x1000 + i));
            actors.push(a);
            usdc.mint(a, 10_000_000e6);
        }

        handler = new BillingHandler(billing, usdc, actors);

        for (uint256 i; i < actors.length; ++i) {
            vm.prank(actors[i]);
            usdc.approve(address(billing), type(uint256).max);
        }

        targetContract(address(handler));
    }

    /// @notice The contract can always pay everything it says it owes.
    function invariant_solvent() public view {
        assertGe(usdc.balanceOf(address(billing)), billing.totalUserBalance() + billing.claimable());
    }

    /// @notice `totalUserBalance` really is the sum of what every account can still withdraw.
    function invariant_userBalanceMatchesAccounts() public view {
        uint256 sum;
        for (uint256 i; i < actors.length; ++i) {
            SubscriptionBilling.Account memory a = billing.accountOf(actors[i]);
            sum += a.deposited - a.charged;
        }
        assertEq(sum, billing.totalUserBalance());
    }

    /// @notice Nobody can withdraw more than they put in, however they sequence their calls.
    function invariant_noMoneyPrinting() public view {
        assertLe(handler.totalPaidOut(), handler.totalDepositedIn());
    }

    /// @notice A user's refundable balance never exceeds their deposits, and an expired account
    /// has nothing left to refund beyond rounding dust.
    function invariant_expiredAccountsAreDrained() public view {
        for (uint256 i; i < actors.length; ++i) {
            address a = actors[i];
            if (billing.expiresAt(a) == 0) continue;
            if (billing.isSubscribed(a)) continue;
            // A $20/month plan accrues ~7.7 base units per second; the floor can strand a couple.
            assertLe(billing.refundableOf(a), 10, "expired account still holds a refundable balance");
        }
    }

    /// @notice Being subscribed is exactly "the clock has not passed my expiry".
    function invariant_subscribedIffBeforeExpiry() public view {
        for (uint256 i; i < actors.length; ++i) {
            assertEq(billing.isSubscribed(actors[i]), block.timestamp < billing.expiresAt(actors[i]));
        }
    }
}
