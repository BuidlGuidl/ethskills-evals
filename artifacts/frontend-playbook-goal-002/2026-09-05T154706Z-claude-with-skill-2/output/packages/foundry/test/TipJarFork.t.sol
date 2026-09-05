// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { TipJar } from "../contracts/TipJar.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Integration tests against the REAL USDC contract on Base.
 * @dev These only run when a Base RPC is reachable; `setUp` skips the suite otherwise
 *      so `forge test` stays green offline. Run explicitly with:
 *
 *      forge test --match-contract TipJarForkTest --fork-url base -vv
 */
contract TipJarForkTest is Test {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    /// @dev Morpho Blue on Base - holds hundreds of millions of USDC.
    address internal constant USDC_WHALE = 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb;

    uint256 internal constant ONE_USDC = 1e6;

    TipJar internal jar;
    IERC20 internal usdc = IERC20(BASE_USDC);

    address internal owner = makeAddr("owner");
    address internal tipper = makeAddr("tipper");

    bool internal onFork;

    function setUp() public {
        // Only meaningful on a Base fork; skip cleanly on a bare `forge test`.
        onFork = BASE_USDC.code.length > 0;
        if (!onFork) return;

        jar = new TipJar(owner, BASE_USDC);

        // Fork power: take real USDC from a real holder instead of deploying a mock.
        vm.prank(USDC_WHALE);
        assertTrue(usdc.transfer(tipper, 1000 * ONE_USDC));
    }

    function test_Fork_TipWithRealUSDC() public {
        vm.skip(!onFork);

        assertEq(usdc.balanceOf(tipper), 1000 * ONE_USDC);

        vm.startPrank(tipper);
        usdc.approve(address(jar), 25 * ONE_USDC);
        jar.tip(25 * ONE_USDC, "real USDC on a Base fork");
        vm.stopPrank();

        assertEq(jar.balance(), 25 * ONE_USDC);
        assertEq(jar.totalTipped(), 25 * ONE_USDC);
        assertEq(usdc.balanceOf(tipper), 975 * ONE_USDC);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.sender, tipper);
        assertEq(t.amount, 25 * ONE_USDC);
        assertEq(t.message, "real USDC on a Base fork");
    }

    function test_Fork_WithdrawRealUSDC() public {
        vm.skip(!onFork);

        vm.startPrank(tipper);
        usdc.approve(address(jar), 40 * ONE_USDC);
        jar.tip(40 * ONE_USDC, "thanks");
        vm.stopPrank();

        vm.prank(owner);
        jar.withdraw();

        assertEq(usdc.balanceOf(owner), 40 * ONE_USDC);
        assertEq(jar.balance(), 0);
    }

    function test_Fork_UsdcMetadataIsWhatWeExpect() public {
        vm.skip(!onFork);

        // Guards the 6-decimal assumption the UI formats against.
        (bool ok, bytes memory data) = BASE_USDC.staticcall(abi.encodeWithSignature("decimals()"));
        assertTrue(ok);
        assertEq(abi.decode(data, (uint8)), 6);
    }
}
