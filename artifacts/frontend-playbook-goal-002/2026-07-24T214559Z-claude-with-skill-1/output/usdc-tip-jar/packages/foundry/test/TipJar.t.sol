// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/TipJar.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal 6-decimal token that mimics USDC for unit tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TipJarTest is Test {
    MockUSDC internal usdc;
    TipJar internal jar;

    address internal owner = address(0xABCD);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);

        usdc.mint(alice, 100 * ONE_USDC);
        usdc.mint(bob, 100 * ONE_USDC);
    }

    function _tip(address who, uint256 amount, string memory message) internal {
        vm.startPrank(who);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function testConfig() public view {
        assertEq(address(jar.usdc()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.tipCount(), 0);
    }

    function testTipMovesUsdcAndRecordsFeed() public {
        _tip(alice, 5 * ONE_USDC, "gm");

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 95 * ONE_USDC);
        assertEq(jar.jarBalance(), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        TipJar.Tip[] memory tips = jar.getTips();
        assertEq(tips.length, 1);
        assertEq(tips[0].from, alice);
        assertEq(tips[0].amount, 5 * ONE_USDC);
        assertEq(tips[0].message, "gm");
    }

    function testEmitsNewTip() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectEmit(true, false, false, true);
        emit TipJar.NewTip(alice, ONE_USDC, "thanks", block.timestamp);
        jar.tip(ONE_USDC, "thanks");
        vm.stopPrank();
    }

    function testMultipleTipsAndRecentOrder() public {
        _tip(alice, ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        assertEq(jar.tipCount(), 3);
        assertEq(jar.totalTipped(), 6 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 4 * ONE_USDC);

        // getRecentTips returns newest first
        TipJar.Tip[] memory recent = jar.getRecentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "third");
        assertEq(recent[1].message, "second");

        // asking for more than exists clamps to total
        TipJar.Tip[] memory all = jar.getRecentTips(50);
        assertEq(all.length, 3);
    }

    function testRevertOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function testRevertOnLongMessage() public {
        string memory long = new string(281);
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        jar.tip(ONE_USDC, long);
        vm.stopPrank();
    }

    function testRevertWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert(); // SafeERC20 reverts when allowance is insufficient
        jar.tip(ONE_USDC, "no approve");
    }

    function testWithdrawOnlyOwner() public {
        _tip(alice, 10 * ONE_USDC, "for you");

        vm.prank(bob);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw();

        uint256 ownerBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), ownerBefore + 10 * ONE_USDC);
        assertEq(jar.jarBalance(), 0);
        // totalTipped is a lifetime counter and does not decrease
        assertEq(jar.totalTipped(), 10 * ONE_USDC);
    }

    function testWithdrawRevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function testFuzzTip(uint256 amount, address tipper) public {
        vm.assume(tipper != address(0) && tipper != address(jar));
        amount = bound(amount, 1, 1_000_000 * ONE_USDC);

        usdc.mint(tipper, amount);
        vm.startPrank(tipper);
        usdc.approve(address(jar), amount);
        jar.tip(amount, "fuzz");
        vm.stopPrank();

        assertEq(jar.jarBalance(), amount);
        assertEq(jar.tippedBy(tipper), amount);
    }
}
