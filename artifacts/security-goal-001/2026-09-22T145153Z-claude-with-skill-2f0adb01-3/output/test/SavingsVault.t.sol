// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {SavingsVaultFactory} from "../src/SavingsVaultFactory.sol";
import {MockERC20, FeeOnTransferERC20, WeirdMetadataToken} from "./mocks/MockTokens.sol";

contract SavingsVaultTest is Test {
    SavingsVaultFactory factory;
    MockERC20 usdc;
    SavingsVault vault;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address keeper = makeAddr("keeper");

    uint256 constant CYCLE = 1 days;

    function setUp() public {
        factory = new SavingsVaultFactory();
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = SavingsVault(factory.createVault(address(usdc), CYCLE));

        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob, 1_000_000e6);
        usdc.mint(keeper, 1_000_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _yield(uint256 amount) internal {
        vm.prank(keeper);
        usdc.transfer(address(vault), amount);
        vault.syncRewards();
    }

    function test_metadataAndDecimals() public view {
        assertEq(vault.name(), "Savings USD Coin");
        assertEq(vault.symbol(), "svUSDC");
        assertEq(vault.decimals(), 12); // 6 underlying + 6 offset
        assertEq(vault.asset(), address(usdc));
    }

    function test_depositAndWithdrawRoundTrip() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e6, alice);
        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalAssets(), 1_000e6);

        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);
        assertLe(assets, 1_000e6);
        assertGe(assets, 1_000e6 - 1);
    }

    function test_yieldVestsLinearlyAndLiftsEveryHolder() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        vm.prank(bob);
        vault.deposit(3_000e6, bob);

        _yield(400e6);
        assertEq(vault.totalAssets(), 4_000e6, "not recognised instantly");

        vm.warp(block.timestamp + CYCLE / 2);
        assertApproxEqAbs(vault.totalAssets(), 4_200e6, 1);

        vm.warp(block.timestamp + CYCLE);
        assertEq(vault.totalAssets(), 4_400e6);

        // pro-rata: alice had 25% of supply
        assertApproxEqRel(vault.previewRedeem(vault.balanceOf(alice)), 1_100e6, 1e12);
        assertApproxEqRel(vault.previewRedeem(vault.balanceOf(bob)), 3_300e6, 1e12);
    }

    /// The keeper transfer must not be front-runnable for risk-free yield.
    function test_jitDepositCannotStealYield() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);

        // Attacker sees the keeper transfer in the mempool and sandwiches it.
        vm.prank(keeper);
        usdc.transfer(address(vault), 1_000e6);

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        uint256 shares = vault.deposit(500_000e6, bob);
        vault.syncRewards();
        vm.prank(bob);
        vault.redeem(shares, bob, bob);

        assertLe(usdc.balanceOf(bob), bobBefore, "JIT deposit extracted value");
    }

    /// Classic ERC-4626 first-depositor donation attack.
    function test_inflationAttackIsUneconomical() public {
        // Attacker seeds the vault with the smallest allowed position.
        vm.startPrank(bob);
        uint256 attackerShares = vault.deposit(1_000, bob);
        usdc.transfer(address(vault), 100_000e6); // direct donation
        vm.stopPrank();

        uint256 victimDeposit = 10_000e6;
        vm.prank(alice);
        uint256 victimShares = vault.deposit(victimDeposit, alice);
        assertGt(victimShares, 0, "victim minted zero shares");

        vm.prank(bob);
        uint256 attackerOut = vault.redeem(attackerShares, bob, bob);
        vm.prank(alice);
        uint256 victimOut = vault.redeem(victimShares, alice, alice);

        // Victim gets essentially all of their money back...
        assertApproxEqRel(victimOut, victimDeposit, 1e12);
        // ...and the attacker cannot recover the donation.
        assertLt(attackerOut, 100_000e6);
    }

    function test_firstDepositMustBeMeaningful() public {
        vm.prank(alice);
        vm.expectRevert(SavingsVault.FirstDepositTooSmall.selector);
        vault.deposit(999, alice); // < 1e9 shares at the 1e6 offset
    }

    function test_feeOnTransferCreditsOnlyWhatArrived() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20();
        SavingsVault v = SavingsVault(factory.createVault(address(fot), CYCLE));
        fot.mint(alice, 1_000e18);
        vm.startPrank(alice);
        fot.approve(address(v), type(uint256).max);
        uint256 shares = v.deposit(1_000e18, alice);
        vm.stopPrank();

        assertEq(v.totalAssets(), 990e18, "credited the un-arrived fee");
        assertLe(v.previewRedeem(shares), fot.balanceOf(address(v)));
    }

    function test_syncCannotBeSpammedToStallYield() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        _yield(100e6);

        vm.warp(block.timestamp + CYCLE / 2);
        vm.expectRevert(SavingsVault.CycleNotEnded.selector);
        vault.syncRewards();
    }

    function test_untrustedMetadataFallsBack() public {
        WeirdMetadataToken weird = new WeirdMetadataToken();
        SavingsVault v = SavingsVault(factory.createVault(address(weird), CYCLE));
        assertEq(v.name(), "Savings Unknown Token");
        assertEq(v.symbol(), "svTKN");
    }

    function test_factoryIsOneVaultPerToken() public {
        vm.expectRevert(
            abi.encodeWithSelector(SavingsVaultFactory.VaultAlreadyExists.selector, address(vault))
        );
        factory.createVault(address(usdc), CYCLE);

        vm.expectRevert(SavingsVaultFactory.NotAContract.selector);
        factory.createVault(makeAddr("eoa"), CYCLE);

        address other = address(new MockERC20("a", "A", 18));
        vm.expectRevert(SavingsVaultFactory.InvalidCycleLength.selector);
        factory.createVault(other, 1);
    }

    function test_noOneCanWithdrawMoreThanTheirShare(uint96 aliceIn, uint96 bobIn, uint96 yieldIn) public {
        aliceIn = uint96(bound(aliceIn, 1e6, 1_000_000e6));
        bobIn = uint96(bound(bobIn, 1e6, 1_000_000e6));
        yieldIn = uint96(bound(yieldIn, 0, 1_000_000e6));

        vm.prank(alice);
        vault.deposit(aliceIn, alice);
        vm.prank(bob);
        vault.deposit(bobIn, bob);
        if (yieldIn > 0) _yield(yieldIn);
        vm.warp(block.timestamp + CYCLE + 1);

        uint256 aliceOut = vault.previewRedeem(vault.balanceOf(alice));
        uint256 bobOut = vault.previewRedeem(vault.balanceOf(bob));
        assertLe(aliceOut + bobOut, usdc.balanceOf(address(vault)), "vault is insolvent");

        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);
        vm.prank(bob);
        vault.redeem(bobShares, bob, bob);
    }
}
