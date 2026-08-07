// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TipJar} from "../contracts/TipJar.sol";

// Minimal 6-decimal token that mimics USDC for local tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TipJarTest is Test {
    MockUSDC usdc;
    TipJar jar;

    address owner = address(0xABCD);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(address(usdc), owner);

        usdc.mint(alice, 1_000 * ONE_USDC);
        usdc.mint(bob, 1_000 * ONE_USDC);
    }

    function _tip(address from, uint256 amount, string memory message) internal {
        vm.startPrank(from);
        usdc.approve(address(jar), amount);
        jar.tip(amount, message);
        vm.stopPrank();
    }

    function test_ConstructorSetsOwnerAndToken() public view {
        assertEq(jar.owner(), owner);
        assertEq(address(jar.usdc()), address(usdc));
    }

    function test_Tip_RecordsAndTransfers() public {
        _tip(alice, 5 * ONE_USDC, "gm!");

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        (address tipper, uint256 amount, string memory message,) = jar.tips(0);
        assertEq(tipper, alice);
        assertEq(amount, 5 * ONE_USDC);
        assertEq(message, "gm!");
    }

    function test_Tip_EmitsEvent() public {
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectEmit(true, true, false, true);
        emit TipJar.NewTip(alice, ONE_USDC, "thanks", block.timestamp, 0);
        jar.tip(ONE_USDC, "thanks");
        vm.stopPrank();
    }

    function test_Tip_RevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nope");
    }

    function test_Tip_RevertsOnLongMessage() public {
        string memory long = new string(281);
        vm.startPrank(alice);
        usdc.approve(address(jar), ONE_USDC);
        vm.expectRevert(TipJar.MessageTooLong.selector);
        jar.tip(ONE_USDC, long);
        vm.stopPrank();
    }

    function test_Tip_RevertsWithoutApproval() public {
        vm.prank(alice);
        vm.expectRevert(); // SafeERC20 bubbles the transferFrom failure
        jar.tip(ONE_USDC, "no approval");
    }

    function test_GetRecentTips_NewestFirst() public {
        _tip(alice, 1 * ONE_USDC, "first");
        _tip(bob, 2 * ONE_USDC, "second");
        _tip(alice, 3 * ONE_USDC, "third");

        TipJar.Tip[] memory recent = jar.getRecentTips(2);
        assertEq(recent.length, 2);
        assertEq(recent[0].message, "third");
        assertEq(recent[1].message, "second");
    }

    function test_GetRecentTips_ClampsToCount() public {
        _tip(alice, ONE_USDC, "only");
        TipJar.Tip[] memory recent = jar.getRecentTips(50);
        assertEq(recent.length, 1);
    }

    function test_Withdraw_OwnerGetsBalance() public {
        _tip(alice, 10 * ONE_USDC, "big tip");

        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), 10 * ONE_USDC);
        assertEq(usdc.balanceOf(address(jar)), 0);
        // Running total is unaffected by withdrawals.
        assertEq(jar.totalTipped(), 10 * ONE_USDC);
    }

    function test_Withdraw_RevertsForNonOwner() public {
        _tip(alice, ONE_USDC, "hi");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        jar.withdraw();
    }

    function test_Withdraw_RevertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw();
    }

    function testFuzz_Tip(uint256 amount) public {
        amount = bound(amount, 1, 1_000 * ONE_USDC);
        _tip(alice, amount, "fuzz");
        assertEq(jar.totalTipped(), amount);
        assertEq(usdc.balanceOf(address(jar)), amount);
    }
}
