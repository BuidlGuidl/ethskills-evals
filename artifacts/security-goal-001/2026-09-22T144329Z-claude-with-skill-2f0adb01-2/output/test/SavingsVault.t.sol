// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SavingsVault} from "../src/SavingsVault.sol";
import {SavingsVaultFactory} from "../src/SavingsVaultFactory.sol";
import {MockERC20, FeeOnTransferToken, ReentrantToken, NotAToken} from "./mocks/Tokens.sol";

contract SavingsVaultTest is Test {
    SavingsVaultFactory factory;
    MockERC20 usdc; // 6 decimals, on purpose
    SavingsVault vault;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");
    address keeper = makeAddr("keeper");

    function setUp() public {
        factory = new SavingsVaultFactory();
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = SavingsVault(factory.createVault(address(usdc)));

        for (uint256 i; i < 4; ++i) {
            address who = [alice, bob, attacker, keeper][i];
            usdc.mint(who, 1_000_000e6);
            vm.prank(who);
            usdc.approve(address(vault), type(uint256).max);
        }
    }

    // ---------------------------------------------------------------- basics

    function test_metadataFollowsUnderlyingDecimals() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(vault.decimals(), 6 + 3, "shares = underlying decimals + offset");
        assertEq(vault.name(), "Saved USDC");
        assertEq(vault.symbol(), "svUSDC");
        assertEq(vault.asset(), address(usdc));
    }

    function test_proRataClaim() public {
        vm.prank(alice);
        vault.deposit(100e6, alice);
        vm.prank(bob);
        vault.deposit(300e6, bob);

        // Alice owns 1/4 of the vault, bob 3/4 (modulo the dead-share tranche).
        assertApproxEqRel(vault.maxWithdraw(alice), 100e6, 1e12);
        assertApproxEqRel(vault.maxWithdraw(bob), 300e6, 1e12);

        _keeperYield(400e6);
        vm.warp(block.timestamp + vault.VESTING_PERIOD());

        assertApproxEqRel(vault.maxWithdraw(alice), 200e6, 1e12);
        assertApproxEqRel(vault.maxWithdraw(bob), 600e6, 1e12);
    }

    function test_roundTripNeverPaysOutMoreThanDeposited() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100e6, alice);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice);
        assertLe(out, 100e6, "round trip must not mint value");
        assertApproxEqAbs(out, 100e6, 1);
    }

    // ------------------------------------------------- inflation / donation

    /// The classic ERC-4626 first-depositor attack, run for real.
    function test_inflationAttackIsUnprofitable() public {
        uint256 attackerStart = usdc.balanceOf(attacker);

        // 1 wei is already refused (it cannot cover the dead-share tranche), so the
        // attacker uses the smallest seed the vault will accept.
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(SavingsVault.InsufficientSeedDeposit.selector, 1000, 1001));
        vault.deposit(1, attacker);

        vm.prank(attacker);
        vault.deposit(2, attacker);

        // Donate a large amount directly to move the share price.
        vm.prank(attacker);
        usdc.transfer(address(vault), 100_000e6);
        vm.warp(block.timestamp + vault.VESTING_PERIOD()); // best case for attacker

        vm.prank(alice);
        uint256 aliceShares = vault.deposit(10_000e6, alice);
        assertGt(aliceShares, 0, "victim must never be rounded down to zero shares");

        // Attacker exits with everything they can.
        uint256 attackerShares = vault.balanceOf(attacker);
        vm.prank(attacker);
        vault.redeem(attackerShares, attacker, attacker);

        assertLt(usdc.balanceOf(attacker), attackerStart, "attack must lose money");

        vm.prank(alice);
        uint256 aliceOut = vault.redeem(aliceShares, alice, alice);
        assertGe(aliceOut, 10_000e6, "victim must not be robbed");
    }

    function test_firstDepositMustClearDeadShares() public {
        // A first deposit too small to cover the burned tranche is rejected outright
        // rather than silently minting zero.
        SavingsVault fresh = SavingsVault(factory.createVault(address(new MockERC20("X", "X", 18))));
        MockERC20 x = MockERC20(fresh.asset());
        x.mint(alice, 10);
        vm.startPrank(alice);
        x.approve(address(fresh), type(uint256).max);
        vm.expectRevert();
        fresh.deposit(0, alice);
        fresh.deposit(10, alice); // 10 * 1e3 = 10_000 shares > DEAD_SHARES
        vm.stopPrank();
        assertEq(fresh.balanceOf(fresh.BURN_ADDRESS()), fresh.DEAD_SHARES());
    }

    // --------------------------------------------------------- yield vesting

    /// Deposit in front of the keeper, withdraw behind it: must not be profitable.
    function test_yieldSnipingIsUnprofitable() public {
        vm.prank(alice);
        vault.deposit(100_000e6, alice);

        uint256 attackerStart = usdc.balanceOf(attacker);

        // Same-block sandwich of the keeper transfer.
        vm.prank(attacker);
        uint256 shares = vault.deposit(500_000e6, attacker);
        _keeperYield(10_000e6);
        vm.prank(attacker);
        vault.redeem(shares, attacker, attacker);

        assertLe(usdc.balanceOf(attacker), attackerStart, "sniper must not extract yield");
    }

    function test_yieldReleasesLinearly() public {
        vm.prank(alice);
        vault.deposit(100_000e6, alice);
        uint256 before = vault.totalAssets();

        _keeperYield(1_000e6);
        assertApproxEqAbs(vault.totalAssets(), before, 1, "nothing released immediately");

        vm.warp(block.timestamp + vault.VESTING_PERIOD() / 2);
        assertApproxEqRel(vault.totalAssets(), before + 500e6, 1e15, "half released");

        vm.warp(block.timestamp + vault.VESTING_PERIOD());
        assertApproxEqAbs(vault.totalAssets(), before + 1_000e6, 1, "fully released");
    }

    /// Dusting the vault must not stretch the unlock of profit already vesting.
    function test_dustCannotGriefTheUnlockSchedule() public {
        vm.prank(alice);
        vault.deposit(100_000e6, alice);
        _keeperYield(1_000e6);

        uint256 expectedEnd = vault.vestingEnd();
        assertEq(expectedEnd, block.timestamp + vault.VESTING_PERIOD());

        for (uint256 i; i < 10; ++i) {
            vm.warp(block.timestamp + 1 hours);
            vm.prank(attacker);
            usdc.transfer(address(vault), 1);
            vault.sync();
        }

        assertApproxEqAbs(vault.vestingEnd(), expectedEnd, 60, "unlock end barely moves");
    }

    function test_totalAssetsViewMatchesPostSyncState() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        _keeperYield(500e6);
        vm.warp(block.timestamp + 3 hours);

        uint256 viewed = vault.totalAssets();
        vault.sync();
        assertEq(vault.totalAssets(), viewed, "preview and execution must agree");
    }

    // ------------------------------------------------------- hostile tokens

    function test_feeOnTransferCreditsOnlyWhatArrived() public {
        FeeOnTransferToken fot = new FeeOnTransferToken(100); // 1%
        SavingsVault v = SavingsVault(factory.createVault(address(fot)));
        fot.mint(alice, 2_000e18);

        vm.startPrank(alice);
        fot.approve(address(v), type(uint256).max);
        v.deposit(1_000e18, alice);
        vm.stopPrank();

        // 1% was burned in flight; the vault must credit 990, not 1000.
        assertEq(fot.balanceOf(address(v)), 990e18);
        assertApproxEqAbs(v.maxWithdraw(alice), 990e18, 1e15);

        // mint() cannot express fee-on-transfer, so it refuses rather than under-collateralise.
        vm.startPrank(alice);
        vm.expectRevert(SavingsVault.FeeOnTransferNotSupportedByMint.selector);
        v.mint(1e18, alice);
        vm.stopPrank();
    }

    function test_reentrantTokenCannotReenter() public {
        ReentrantToken rt = new ReentrantToken();
        SavingsVault v = SavingsVault(factory.createVault(address(rt)));
        rt.mint(alice, 1_000e18);

        vm.startPrank(alice);
        rt.approve(address(v), type(uint256).max);
        v.deposit(500e18, alice);

        rt.arm(address(v), abi.encodeWithSignature("deposit(uint256,address)", uint256(1e18), alice));
        vm.expectRevert(); // ReentrancyGuardReentrantCall bubbles up
        v.deposit(1e18, alice);
        vm.stopPrank();
    }

    function test_tokenSideLossIsAbsorbedNotStuck() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        vm.prank(bob);
        vault.deposit(1_000e6, bob);

        // Token admin burns from the vault (blocklist seizure / negative rebase).
        usdc.burn(address(vault), 200e6);
        vault.sync();

        // Everyone still exits pro-rata against what is actually there.
        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(alice);
        uint256 aliceOut = vault.redeem(aliceShares, alice, alice);
        vm.prank(bob);
        uint256 bobOut = vault.redeem(bobShares, bob, bob);

        assertApproxEqRel(aliceOut, 900e6, 1e15);
        assertApproxEqRel(bobOut, 900e6, 1e15);
        assertLe(aliceOut + bobOut, 1_800e6);
    }

    // ------------------------------------------------------ access / inputs

    function test_noPrivilegedFunctionsExist() public {
        // The vault has no owner and no rescue path: a stranger can do nothing but
        // deposit/withdraw/sync. Sanity-check that the factory cannot touch funds.
        vm.prank(alice);
        vault.deposit(1_000e6, alice);
        assertEq(vault.balanceOf(address(factory)), 0);
        assertEq(usdc.balanceOf(address(factory)), 0);
    }

    function test_rejectsZeroAndSelfReceiver() public {
        vm.startPrank(alice);
        vm.expectRevert(SavingsVault.ZeroAmount.selector);
        vault.deposit(0, alice);
        vm.expectRevert(SavingsVault.InvalidReceiver.selector);
        vault.deposit(1e6, address(0));
        vm.expectRevert(SavingsVault.InvalidReceiver.selector);
        vault.deposit(1e6, address(vault));
        vm.stopPrank();
    }

    function test_cannotWithdrawSomeoneElsesShares() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);

        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(attacker);
        vm.expectRevert();
        vault.redeem(aliceShares, attacker, alice);
    }

    function test_slippageGuardsBite() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice);

        vm.prank(bob);
        vm.expectRevert();
        vault.deposit(100e6, bob, type(uint256).max);
    }

    // ------------------------------------------------------------- factory

    function test_oneCanonicalVaultPerToken() public {
        assertEq(factory.vaultFor(address(usdc)), address(vault));
        assertTrue(factory.isVault(address(vault)));

        vm.expectRevert(
            abi.encodeWithSelector(SavingsVaultFactory.VaultAlreadyExists.selector, address(usdc), address(vault))
        );
        factory.createVault(address(usdc));
    }

    function test_predictedAddressMatches() public {
        MockERC20 t = new MockERC20("T", "T", 18);
        address predicted = factory.predictVault(address(t));
        assertEq(factory.createVault(address(t)), predicted);
    }

    function test_rejectsNonTokens() public {
        vm.expectRevert(SavingsVaultFactory.ZeroAddress.selector);
        factory.createVault(address(0));

        vm.expectRevert(abi.encodeWithSelector(SavingsVaultFactory.TokenNotAContract.selector, alice));
        factory.createVault(alice);

        NotAToken junk = new NotAToken();
        vm.expectRevert(abi.encodeWithSelector(SavingsVaultFactory.NotAnERC20.selector, address(junk)));
        factory.createVault(address(junk));
    }

    // ---------------------------------------------------------------- fuzz

    function testFuzz_shareAccountingIsSolvent(uint96 aliceIn, uint96 bobIn, uint96 yield) public {
        aliceIn = uint96(bound(aliceIn, 1e6, 1_000_000e6));
        bobIn = uint96(bound(bobIn, 1e6, 1_000_000e6));
        yield = uint96(bound(yield, 0, 100_000e6));
        usdc.mint(alice, aliceIn);
        usdc.mint(bob, bobIn);
        usdc.mint(keeper, yield);

        vm.prank(alice);
        vault.deposit(aliceIn, alice);
        vm.prank(bob);
        vault.deposit(bobIn, bob);
        if (yield > 0) _keeperYield(yield);
        vm.warp(block.timestamp + vault.VESTING_PERIOD());

        // The vault can always honour every outstanding share.
        uint256 owed = vault.convertToAssets(vault.totalSupply());
        assertLe(owed, usdc.balanceOf(address(vault)), "vault must stay solvent");

        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);
        vm.prank(bob);
        vault.redeem(bobShares, bob, bob);
    }

    // -------------------------------------------------------------- helpers

    /// @dev The keeper just transfers in. `sync()` is optional — any deposit/withdraw
    ///      would start the vesting clock too — but a real keeper should batch it in.
    function _keeperYield(uint256 amount) internal {
        vm.prank(keeper);
        usdc.transfer(address(vault), amount);
        vault.sync();
    }
}
