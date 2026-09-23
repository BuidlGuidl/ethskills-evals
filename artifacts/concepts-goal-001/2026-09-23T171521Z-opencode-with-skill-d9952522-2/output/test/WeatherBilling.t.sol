// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {WeatherBilling} from "../src/WeatherBilling.sol";

/// @notice Minimal ERC20 standing in for USDC (6 decimals at deploy time).
contract MockUSDC {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor() {
        balanceOf[msg.sender] = 1_000_000e6;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "insufficient allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @notice Token that tries to reenter the billing contract from inside
///         transferFrom, swallowing the inner revert. Proves the
///         reentrancy guard blocks double-execution even when the token
///         controls the callback.
contract ReenteringToken {
    address public victim;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor() {
        balanceOf[msg.sender] = 1_000_000e6;
    }

    function setVictim(address v) external {
        victim = v;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "insufficient allowance");
        allowance[from][msg.sender] = a - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        // reenter: try to top up again from inside the token callback
        (bool ok,) = victim.call(abi.encodeWithSignature("topUp(uint256)", 1));
        ok; // result irrelevant; the guard must block the inner call
        return true;
    }
}

contract WeatherBillingTest is Test {
    MockUSDC usdc;
    WeatherBilling billing;

    address constant CUSTOMER = address(0xC0);
    address constant OTHER = address(0x0C);
    address constant OWNER = address(0xBEE);

    uint256 constant HOBBY = 5e6; // $5
    uint256 constant PRO = 20e6; // $20

    function setUp() public {
        usdc = new MockUSDC();
        uint256[] memory prices = new uint256[](2);
        prices[0] = HOBBY;
        prices[1] = PRO;
        billing = new WeatherBilling(address(usdc), OWNER, prices);

        usdc.transfer(CUSTOMER, 1_000e6);
        vm.prank(CUSTOMER);
        usdc.approve(address(billing), type(uint256).max);
    }

    function _topUp(address who, uint256 amount) internal {
        vm.prank(who);
        billing.topUp(amount);
    }

    function _subscribe(address who, uint8 planId) internal {
        vm.prank(who);
        billing.subscribe(planId);
    }

    /// The accounting identity that must hold at every step: the contract's
    /// actual USDC is exactly customer credits + period escrow + owner
    /// revenue. One pot can never silently become another.
    function _assertSolvent(address a, address b) internal view {
        assertEq(
            usdc.balanceOf(address(billing)),
            billing.credits(a)
                + billing.credits(b)
                + billing.credits(OWNER)
                + billing.held(a)
                + billing.held(b)
                + billing.revenue()
        );
    }

    // ------------------------------------------------------------- top up

    function test_TopUp_CreditsAndMovesFunds() public {
        _topUp(CUSTOMER, 100e6);
        assertEq(billing.credits(CUSTOMER), 100e6);
        assertEq(usdc.balanceOf(address(billing)), 100e6);
        _assertSolvent(CUSTOMER, OTHER);
    }

    function test_TopUp_Zero_Reverts() public {
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.ZeroAmount.selector);
        billing.topUp(0);
    }

    // ------------------------------------------------------------ subscribe

    function test_Subscribe_ChargesFirstPeriodIntoEscrow() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 0);

        (bool subbed, uint8 planId) = billing.isSubscribed(CUSTOMER);
        assertTrue(subbed);
        assertEq(planId, 0);
        assertEq(billing.credits(CUSTOMER), 45e6); // 50 - 5
        assertEq(billing.held(CUSTOMER), HOBBY); // escrowed, not revenue yet
        assertEq(billing.revenue(), 0); // nothing earned until time passes
        (, uint8 pid, uint64 paidUntil,) = billing.subscriptionOf(CUSTOMER);
        assertEq(pid, 0);
        assertEq(paidUntil, block.timestamp + 30 days);
    }

    function test_Subscribe_Pro_Plan() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 1);
        assertEq(billing.credits(CUSTOMER), 30e6); // 50 - 20
        assertEq(billing.held(CUSTOMER), PRO);
    }

    function test_Subscribe_NotEnoughCredit_Reverts() public {
        _topUp(CUSTOMER, 4e6);
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.InsufficientCredit.selector);
        billing.subscribe(0);
    }

    function test_Subscribe_AlreadyActive_Reverts() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 0);
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.AlreadyActive.selector);
        billing.subscribe(0);
    }

    function test_Subscribe_BadPlan_Reverts() public {
        _topUp(CUSTOMER, 50e6);
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.BadPlan.selector);
        billing.subscribe(2);
    }

    // -------------------------------------------------------------- renewal

    function test_Renewal_NotDue_Reverts() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 0);
        vm.prank(OTHER);
        vm.expectRevert(WeatherBilling.NotDueYet.selector);
        billing.renewFor(CUSTOMER);
    }

    function test_Renewal_IsPermissionless_SettlesAndRecharges() public {
        _topUp(CUSTOMER, 15e6);
        _subscribe(CUSTOMER, 0);
        uint64 paidUntil0 = _paidUntil(CUSTOMER);

        // subscription expires: no grace period, service stops immediately
        vm.warp(paidUntil0);
        (bool subbed,) = billing.isSubscribed(CUSTOMER);
        assertFalse(subbed);
        assertTrue(billing.needsRenewal(CUSTOMER));

        // a stranger can renew on the customer's pre-deposited credit
        vm.prank(OTHER);
        billing.renewFor(CUSTOMER);

        assertEq(billing.credits(CUSTOMER), 5e6); // 15 - 5 - 5
        assertEq(billing.revenue(), HOBBY); // first period fully earned
        assertEq(billing.held(CUSTOMER), HOBBY); // second period escrowed
        assertEq(_paidUntil(CUSTOMER), paidUntil0 + 30 days);
        (bool subbed2, uint8 planId2) = billing.isSubscribed(CUSTOMER);
        assertTrue(subbed2);
        assertEq(planId2, 0);
        _assertSolvent(CUSTOMER, OTHER);
    }

    function test_Renewal_LateBuysThirtyFreshDays() public {
        _topUp(CUSTOMER, 15e6);
        _subscribe(CUSTOMER, 0);
        uint64 paidUntil0 = _paidUntil(CUSTOMER);

        // backend renews 5 days late: the lapse served nobody, so the new
        // period runs 30 days from the renewal, and the old period is
        // earned in full
        vm.warp(paidUntil0 + 5 days);
        uint256 renewalTime = block.timestamp;
        vm.prank(OTHER);
        billing.renewFor(CUSTOMER);
        assertEq(_paidUntil(CUSTOMER), renewalTime + 30 days);
        assertEq(billing.revenue(), HOBBY);
    }

    function test_Renewal_InsufficientCredit_Reverts_AndSettlesNothing() public {
        _topUp(CUSTOMER, 5e6);
        _subscribe(CUSTOMER, 0); // credit now 0
        vm.warp(_paidUntil(CUSTOMER));
        vm.prank(OTHER);
        vm.expectRevert(WeatherBilling.InsufficientCredit.selector);
        billing.renewFor(CUSTOMER);
        // the whole tx rolled back, including the settlement
        assertEq(billing.revenue(), 0);
        assertEq(billing.held(CUSTOMER), HOBBY);
    }

    function test_Renewal_PriceChangeAppliesOnlyToFuturePeriods() public {
        _topUp(CUSTOMER, 100e6);
        _subscribe(CUSTOMER, 0);
        uint64 paidUntil0 = _paidUntil(CUSTOMER);

        // owner raises price mid-period
        vm.prank(OWNER);
        billing.setPrice(0, 7e6);

        // already-paid period is honoured at the old price
        (bool subbed,) = billing.isSubscribed(CUSTOMER);
        assertTrue(subbed);
        assertEq(_paidUntil(CUSTOMER), paidUntil0);

        // the next renewal pays the new price
        vm.warp(paidUntil0);
        vm.prank(OTHER);
        billing.renewFor(CUSTOMER);
        assertEq(billing.revenue(), 5e6); // old period at old price
        assertEq(billing.held(CUSTOMER), 7e6); // new period at new price
    }

    // --------------------------------------------------------------- settle

    function test_Settle_Permissionless_AfterLapse() public {
        _topUp(CUSTOMER, 5e6);
        _subscribe(CUSTOMER, 0); // credit 0, escrow 5
        vm.warp(_paidUntil(CUSTOMER));

        vm.prank(OTHER);
        billing.settle(CUSTOMER);
        assertEq(billing.revenue(), HOBBY);
        assertEq(billing.held(CUSTOMER), 0);

        // owner collects the earned period
        vm.prank(OWNER);
        billing.collectRevenue(OWNER);
        assertEq(usdc.balanceOf(OWNER), HOBBY);
        _assertSolvent(CUSTOMER, OTHER);
    }

    function test_Settle_Early_Reverts() public {
        _topUp(CUSTOMER, 5e6);
        _subscribe(CUSTOMER, 0);
        vm.prank(OTHER);
        vm.expectRevert(WeatherBilling.NotDueYet.selector);
        billing.settle(CUSTOMER);
    }

    function test_Settle_Twice_Reverts() public {
        _topUp(CUSTOMER, 5e6);
        _subscribe(CUSTOMER, 0);
        vm.warp(_paidUntil(CUSTOMER));
        vm.prank(OTHER);
        billing.settle(CUSTOMER);
        vm.prank(OTHER);
        vm.expectRevert(WeatherBilling.NothingToSettle.selector);
        billing.settle(CUSTOMER);
    }

    // --------------------------------------------------------------- cancel

    function test_Cancel_ProRataRefund_AndServiceStopsImmediately() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 0); // paid until +30d, escrow 5, credit 45

        // cancel halfway through the paid period
        vm.warp(block.timestamp + 15 days);
        vm.prank(CUSTOMER);
        billing.cancel();

        (bool subbed,) = billing.isSubscribed(CUSTOMER);
        assertFalse(subbed);

        // half the period unused: 2.50 back, plus the 45 unspent credit
        assertEq(billing.credits(CUSTOMER), 45e6 + 2.5e6);
        assertEq(billing.held(CUSTOMER), 0);
        // owner has earned the used half
        assertEq(billing.revenue(), 2.5e6);
        _assertSolvent(CUSTOMER, OTHER);
    }

    function test_Cancel_Immediately_FullRefundOfPeriod() public {
        _topUp(CUSTOMER, 5e6);
        _subscribe(CUSTOMER, 0); // escrow 5, credit 0
        vm.prank(CUSTOMER);
        billing.cancel();
        assertEq(billing.credits(CUSTOMER), 5e6);
        assertEq(billing.revenue(), 0);
    }

    function test_Cancel_AfterLapse_NoRefund_NoRevert() public {
        _topUp(CUSTOMER, 5e6);
        _subscribe(CUSTOMER, 0);
        vm.warp(_paidUntil(CUSTOMER) + 10 days); // lapsed but never cancelled
        vm.prank(CUSTOMER);
        billing.cancel();
        assertEq(billing.credits(CUSTOMER), 0);
        assertEq(billing.revenue(), HOBBY); // the whole period was used
    }

    function test_Cancel_RefundBoundedByEscrow_DespitePriceRaise() public {
        // regression: refund must be pro-rata of what was actually paid for
        // the period, so an owner raising prices cannot inflate refunds
        _topUp(CUSTOMER, 5e6);
        _subscribe(CUSTOMER, 0); // paid $5 for this period
        vm.prank(OWNER);
        billing.setPrice(0, 100e6); // price now $100
        vm.warp(block.timestamp + 15 days);
        vm.prank(CUSTOMER);
        billing.cancel();
        assertEq(billing.credits(CUSTOMER), 2.5e6); // half of $5, not $50
        assertEq(billing.revenue(), 2.5e6);
    }

    function test_Cancel_NotActive_Reverts() public {
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.NotActive.selector);
        billing.cancel();
    }

    function test_Resubscribe_AfterCancel_Works() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 0);
        vm.prank(CUSTOMER);
        billing.cancel();
        _subscribe(CUSTOMER, 1); // upgrade to pro on restart
        (bool subbed, uint8 planId) = billing.isSubscribed(CUSTOMER);
        assertTrue(subbed);
        assertEq(planId, 1);
    }

    // -------------------------------------------------------------- withdraw

    function test_Withdraw_ReturnsCreditsPlusRefund() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 0);
        vm.warp(block.timestamp + 15 days);
        vm.prank(CUSTOMER);
        billing.cancel(); // credit 47.50

        uint256 before = usdc.balanceOf(CUSTOMER);
        vm.prank(CUSTOMER);
        billing.withdraw();

        assertEq(usdc.balanceOf(CUSTOMER), before + 47.5e6);
        assertEq(billing.credits(CUSTOMER), 0);
        _assertSolvent(CUSTOMER, OTHER);
    }

    function test_Withdraw_NothingLeft_Reverts() public {
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.NothingToWithdraw.selector);
        billing.withdraw();
    }

    // ----------------------------------------------------------- change plan

    function test_ChangePlan_CreditsRemainder_ChargesNewPrice() public {
        _topUp(CUSTOMER, 100e6);
        _subscribe(CUSTOMER, 0); // hobby, paid until +30d, credit 95

        uint256 t0 = vm.getBlockTimestamp();
        vm.warp(t0 + 10 days); // 2/3 of the period unused
        vm.prank(CUSTOMER);
        billing.changePlan(1);

        uint256 expectedRefund = HOBBY * 20 days / 30 days; // 3.33
        assertEq(billing.credits(CUSTOMER), 95e6 + expectedRefund - PRO);
        assertEq(billing.revenue(), HOBBY - expectedRefund); // used 1/3 of $5
        assertEq(billing.held(CUSTOMER), PRO); // new period escrowed
        assertEq(_paidUntil(CUSTOMER), block.timestamp + 30 days);
        (, uint8 planId,,) = billing.subscriptionOf(CUSTOMER);
        assertEq(planId, 1);
        _assertSolvent(CUSTOMER, OTHER);
    }

    function test_ChangePlan_SamePlan_Reverts() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 0);
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.SamePlan.selector);
        billing.changePlan(0);
    }

    function test_ChangePlan_CannotAfford_Reverts() public {
        _topUp(CUSTOMER, 5e6);
        _subscribe(CUSTOMER, 0); // credit 0
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.InsufficientCredit.selector);
        billing.changePlan(1);
    }

    // ---------------------------------------------------------------- owner

    function test_SetPrice_OnlyOwner() public {
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.setPrice(0, 6e6);
    }

    function test_CollectRevenue_PaysOwner_LeavesCreditsAlone() public {
        _topUp(CUSTOMER, 50e6);
        _subscribe(CUSTOMER, 0); // escrow 5, credit 45, revenue 0
        vm.warp(_paidUntil(CUSTOMER));

        // nothing collectable until the period is settled
        vm.prank(OWNER);
        vm.expectRevert(WeatherBilling.NothingToWithdraw.selector);
        billing.collectRevenue(OWNER);

        vm.prank(OTHER);
        billing.settle(CUSTOMER);

        vm.prank(OWNER);
        billing.collectRevenue(OWNER);

        assertEq(usdc.balanceOf(OWNER), HOBBY);
        assertEq(billing.revenue(), 0);
        assertEq(billing.credits(CUSTOMER), 45e6); // untouched
        _assertSolvent(CUSTOMER, OTHER);

        // customer can still withdraw everything they are owed
        vm.prank(CUSTOMER);
        billing.withdraw();
        assertEq(usdc.balanceOf(CUSTOMER), 995e6); // 1000 - 50 + 45
    }

    function test_CollectRevenue_OnlyOwner() public {
        vm.prank(CUSTOMER);
        vm.expectRevert(WeatherBilling.NotOwner.selector);
        billing.collectRevenue(CUSTOMER);
    }

    // ----------------------------------------------------------- guard rails

    function test_Reentrancy_GuardBlocksDoubleExecution() public {
        ReenteringToken evil = new ReenteringToken();
        evil.setVictim(address(billing));
        uint256[] memory prices = new uint256[](1);
        prices[0] = HOBBY;
        WeatherBilling guarded = new WeatherBilling(address(evil), OWNER, prices);

        evil.transfer(CUSTOMER, 100e6);
        vm.startPrank(CUSTOMER);
        evil.approve(address(guarded), type(uint256).max);
        // the token swallows the inner revert, so the outer call can still
        // succeed — but the inner topUp must not have double-credited
        guarded.topUp(10e6);
        vm.stopPrank();

        assertEq(guarded.credits(CUSTOMER), 10e6); // not 10e6 + 1
        assertEq(evil.balanceOf(address(guarded)), 10e6);
    }

    function test_Views_NeverSubscribed() public view {
        (bool subbed, uint8 planId) = billing.isSubscribed(OTHER);
        assertFalse(subbed);
        assertEq(planId, 0);
        (WeatherBilling.Status st,,,) = billing.subscriptionOf(OTHER);
        assertEq(uint8(st), uint8(WeatherBilling.Status.None));
        assertFalse(billing.needsRenewal(OTHER));
    }

    // -------------------------------------------------------------- helpers

    function _paidUntil(address who) internal view returns (uint64) {
        (,, uint64 paidUntil,) = billing.subscriptionOf(who);
        return paidUntil;
    }
}