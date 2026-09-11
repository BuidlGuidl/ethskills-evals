// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TipJar } from "../contracts/TipJar.sol";

/// @dev Stand-in for USDC in unit tests: same 6 decimals, no fork required.
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
    MockUSDC usdc;
    TipJar jar;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE_USDC = 1e6;

    event TipReceived(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);

    function setUp() public {
        usdc = new MockUSDC();
        jar = new TipJar(IERC20(address(usdc)), owner);

        usdc.mint(alice, 1000 * ONE_USDC);
        usdc.mint(bob, 1000 * ONE_USDC);
        vm.prank(alice);
        usdc.approve(address(jar), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(jar), type(uint256).max);
    }

    function test_Deployment() public view {
        assertEq(address(jar.token()), address(usdc));
        assertEq(jar.owner(), owner);
        assertEq(jar.tipCount(), 0);
        assertEq(jar.tokenDecimals(), 6);
    }

    function test_TipMovesTokensAndRecordsFeedEntry() public {
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, false, true, address(jar));
        emit TipReceived(0, alice, 5 * ONE_USDC, "coffee money", 1_700_000_000);

        vm.prank(alice);
        jar.tip(5 * ONE_USDC, "coffee money");

        assertEq(usdc.balanceOf(address(jar)), 5 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 995 * ONE_USDC);
        assertEq(jar.jarBalance(), 5 * ONE_USDC);
        assertEq(jar.totalTipped(), 5 * ONE_USDC);
        assertEq(jar.tippedBy(alice), 5 * ONE_USDC);
        assertEq(jar.tipCount(), 1);

        TipJar.Tip memory t = jar.tipAt(0);
        assertEq(t.sender, alice);
        assertEq(uint256(t.amount), 5 * ONE_USDC);
        assertEq(uint256(t.timestamp), 1_700_000_000);
        assertEq(t.message, "coffee money");
    }

    function test_LatestTipsReturnsNewestFirstAndClampsLimit() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "one");
        vm.prank(bob);
        jar.tip(2 * ONE_USDC, "two");
        vm.prank(alice);
        jar.tip(3 * ONE_USDC, "three");

        TipJar.Tip[] memory page = jar.latestTips(2);
        assertEq(page.length, 2);
        assertEq(page[0].message, "three");
        assertEq(page[1].message, "two");

        // A limit larger than the feed returns everything, no revert.
        assertEq(jar.latestTips(50).length, 3);
        assertEq(jar.tippedBy(alice), 4 * ONE_USDC);
        assertEq(jar.totalTipped(), 6 * ONE_USDC);
    }

    function test_EmptyMessageIsAllowed() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "");
        assertEq(jar.tipAt(0).message, "");
    }

    function test_RevertWhen_AmountIsZero() public {
        vm.prank(alice);
        vm.expectRevert(TipJar.ZeroAmount.selector);
        jar.tip(0, "nothing");
    }

    function test_RevertWhen_MessageTooLong() public {
        string memory long = new string(201);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TipJar.MessageTooLong.selector, 201, 200));
        jar.tip(ONE_USDC, long);
    }

    function test_RevertWhen_AllowanceMissing() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, ONE_USDC);
        vm.prank(carol);
        vm.expectRevert();
        jar.tip(ONE_USDC, "no approval");
    }

    function test_OwnerWithdrawsWholeBalance() public {
        vm.prank(alice);
        jar.tip(7 * ONE_USDC, "thanks");

        vm.prank(owner);
        jar.withdraw(owner);

        assertEq(usdc.balanceOf(owner), 7 * ONE_USDC);
        assertEq(jar.jarBalance(), 0);
        // The feed survives a withdrawal.
        assertEq(jar.tipCount(), 1);
        assertEq(jar.totalTipped(), 7 * ONE_USDC);
    }

    function test_RevertWhen_NonOwnerWithdraws() public {
        vm.prank(alice);
        jar.tip(ONE_USDC, "hi");
        vm.prank(alice);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw(alice);
    }

    function test_RevertWhen_WithdrawingEmptyJar() public {
        vm.prank(owner);
        vm.expectRevert(TipJar.NothingToWithdraw.selector);
        jar.withdraw(owner);
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        jar.transferOwnership(alice);
        assertEq(jar.owner(), alice);

        vm.prank(owner);
        vm.expectRevert(TipJar.NotOwner.selector);
        jar.withdraw(owner);
    }

    function testFuzz_TipAccumulates(uint96 a, uint96 b) public {
        vm.assume(a > 0 && b > 0);
        usdc.mint(alice, uint256(a) + uint256(b));
        vm.startPrank(alice);
        jar.tip(a, "a");
        jar.tip(b, "b");
        vm.stopPrank();
        assertEq(jar.totalTipped(), uint256(a) + uint256(b));
        assertEq(jar.jarBalance(), uint256(a) + uint256(b));
    }
}
