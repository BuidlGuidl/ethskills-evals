// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract WeatherBillingTest is Test {
    uint256 constant MONTH = 30 days;
    uint256 constant HOBBY = 5e6; // $5
    uint256 constant PRO = 20e6; // $20

    MockUSDC usdc;
    WeatherBilling billing;
    address alice = makeAddr("alice");
    address owner = makeAddr("owner");

    function setUp() public {
        usdc = new MockUSDC();
        string[] memory names = new string[](2);
        names[0] = "hobby";
        names[1] = "pro";
        uint256[] memory prices = new uint256[](2);
        prices[0] = HOBBY;
        prices[1] = PRO;
        billing = new WeatherBilling(IERC20(address(usdc)), owner, names, prices);
        usdc.mint(alice, 1000e6);
    }

    function _fundAndSubscribe(address user, uint256 amount, uint8 planId) internal {
        vm.startPrank(user);
        usdc.approve(address(billing), amount);
        billing.depositAndSubscribe(amount, planId);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- flows

    function test_DepositAndSubscribe() public {
        vm.startPrank(alice);
        usdc.approve(address(billing), HOBBY);
        billing.depositAndSubscribe(HOBBY, 1);
        vm.stopPrank();

        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.credits(alice), HOBBY);
        assertEq(billing.planOf(alice), 1);
        assertEq(billing.secondsRemaining(alice), MONTH);
        assertEq(usdc.balanceOf(address(billing)), HOBBY);
    }

    function test_DepositWithoutApprovalReverts() public {
        vm.prank(alice);
        vm.expectRevert();
        billing.deposit(1e6);
    }

    function test_SubscribeWithoutCreditReverts() public {
        vm.prank(alice);
        vm.expectRevert(WeatherBilling.NoCredit.selector);
        billing.subscribe(1);
    }

    function test_InvalidPlanReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WeatherBilling.InvalidPlan.selector, 3));
        billing.depositAndSubscribe(1e6, 3);
    }

    // ------------------------------------------------------- time & expiry

    function test_PassiveExpiry_NoKeeperNeeded() public {
        _fundAndSubscribe(alice, HOBBY, 1);

        // halfway through the month: still subscribed, no tx in between
        vm.warp(block.timestamp + 15 days);
        assertTrue(billing.isSubscribed(alice));
        assertEq(billing.secondsRemaining(alice), 15 days);

        // past the point the deposit covers: expired with NO transaction at all
        vm.warp(block.timestamp + 15 days + 1 seconds);
        assertFalse(billing.isSubscribed(alice));
        assertEq(billing.secondsRemaining(alice), 0);
    }

    function test_SettleSurfacesLapse() public {
        _fundAndSubscribe(alice, HOBBY, 1);
        vm.warp(block.timestamp + 100 days);

        vm.expectEmit(true, true, true, true, address(billing));
        emit WeatherBilling.Lapsed(alice, 1, HOBBY, uint64(block.timestamp - 70 days));
        billing.settle(alice); // anyone may call it

        assertEq(billing.planOf(alice), 0);
        assertEq(billing.credits(alice), 0);
        assertEq(billing.totalRevenue(), HOBBY); // charged $5, not $16 for 100 days
        assertFalse(billing.isSubscribed(alice));
    }

    function test_NoFreeTimeBetweenLapseAndRecharge() public {
        _fundAndSubscribe(alice, HOBBY, 1);
        vm.warp(block.timestamp + 40 days); // lapses at day 30

        _fundAndSubscribe(alice, HOBBY, 1); // re-up at day 40
        assertEq(billing.totalRevenue(), HOBBY); // only the first 30 days were billed

        vm.warp(block.timestamp + MONTH);
        billing.settle(alice);
        assertEq(billing.totalRevenue(), 2 * HOBBY); // days 40-70 billed, 30-40 free of charge
        assertEq(billing.credits(alice), 0);
    }

    function test_SecondsRemainingCapsAtZero() public {
        _fundAndSubscribe(alice, HOBBY, 1);
        vm.warp(block.timestamp + 60 days);
        assertEq(billing.secondsRemaining(alice), 0);
    }

    // --------------------------------------------------------------- cancel

    function test_CancelRefundsExactlyUnused() public {
        _fundAndSubscribe(alice, HOBBY, 1);
        vm.warp(block.timestamp + 10 days);

        uint256 expectedRefund = HOBBY - HOBBY * 10 days / MONTH;
        vm.prank(alice);
        vm.expectEmit(true, true, true, true, address(billing));
        emit WeatherBilling.Cancelled(alice, 1, expectedRefund);
        billing.cancel();

        assertEq(usdc.balanceOf(alice), 1000e6 - HOBBY + expectedRefund);
        assertEq(billing.credits(alice), 0);
        assertEq(billing.planOf(alice), 0);
        assertFalse(billing.isSubscribed(alice));
    }

    function test_CancelWithNoPlanRefundsCredit() public {
        vm.startPrank(alice);
        usdc.approve(address(billing), 10e6);
        billing.deposit(10e6);
        vm.stopPrank();

        vm.prank(alice);
        billing.cancel();
        assertEq(usdc.balanceOf(alice), 1000e6);
        assertEq(usdc.balanceOf(address(billing)), 0);
    }

    // ---------------------------------------------------------- plan change

    function test_PlanSwitchSettlesOldRate() public {
        _fundAndSubscribe(alice, 3 * HOBBY, 1); // $15 covers 3 hobby months
        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        billing.subscribe(2); // switch to pro

        assertEq(billing.totalRevenue(), HOBBY * 10 days / MONTH); // 10 hobby days settled
        assertEq(billing.planOf(alice), 2);
        assertEq(billing.secondsRemaining(alice), (3 * HOBBY - HOBBY * 10 days / MONTH) * MONTH / PRO);
    }

    // --------------------------------------------------------------- owner

    function test_OnlyOwnerClaimsRevenue() public {
        _fundAndSubscribe(alice, HOBBY, 1);
        vm.warp(block.timestamp + MONTH);
        billing.settle(alice);
        assertEq(billing.totalRevenue(), HOBBY);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), alice));
        billing.claimRevenue();

        vm.prank(owner);
        billing.claimRevenue();
        assertEq(usdc.balanceOf(owner), HOBBY);
        assertEq(billing.totalRevenue(), 0);
    }

    // ---------------------------------------------------------------- fuzz

    /// Invariant: money is conserved. Whatever the customer deposits ends up
    /// split between refund and revenue — nothing is created or destroyed.
    function testFuzz_RefundPlusRevenueEqualsDeposit(uint96 depositAmount, uint40 elapsed) public {
        depositAmount = uint96(bound(depositAmount, 5e6, 500e6));
        elapsed = uint40(bound(elapsed, 0 seconds, 365 days));

        _fundAndSubscribe(alice, depositAmount, 1);
        vm.warp(block.timestamp + elapsed);

        uint256 balanceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        billing.cancel();
        uint256 refunded = usdc.balanceOf(alice) - balanceBefore;

        if (billing.totalRevenue() > 0) {
            vm.prank(owner);
            billing.claimRevenue();
        }

        assertEq(refunded + usdc.balanceOf(owner), depositAmount);
    }

    /// Invariant: an active subscriber with a full month's credit stays
    /// subscribed for at least that month, and not a second longer.
    function testFuzz_FullMonthNeverLapsesEarly(uint40 warp) public {
        warp = uint40(bound(warp, 0, MONTH - 1));
        _fundAndSubscribe(alice, HOBBY, 1);
        vm.warp(block.timestamp + warp);
        assertTrue(billing.isSubscribed(alice));

        vm.warp(block.timestamp + (MONTH - warp));
        assertFalse(billing.isSubscribed(alice));
    }
}