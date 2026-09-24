// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SaveVault} from "../src/SaveVault.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";
import {
    MockERC20,
    FeeOnTransferToken,
    ReenteringToken,
    Bytes32MetadataToken,
    HostileMetadataToken
} from "./mocks/Tokens.sol";

contract SaveVaultTest is Test {
    SaveVaultFactory factory;
    MockERC20 token;
    SaveVault vault;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address keeper = makeAddr("keeper");
    address attacker = makeAddr("attacker");

    function setUp() public {
        factory = new SaveVaultFactory();
        token = new MockERC20(18);
        vault = SaveVault(factory.createVault(address(token)));

        for (uint256 i; i < 4; ++i) {
            address who = [alice, bob, keeper, attacker][i];
            token.mint(who, 1_000_000e18);
            vm.prank(who);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function _deposit(address who, uint256 amount) internal returns (uint256) {
        vm.prank(who);
        return vault.deposit(amount, who);
    }

    /* ------------------------------ basics ------------------------------ */

    function test_metadata() public view {
        assertEq(vault.name(), "Save Mock Token");
        assertEq(vault.symbol(), "svMOCK");
        assertEq(vault.decimals(), 21); // underlying 18 + virtual-share offset 3
        assertEq(address(vault.asset()), address(token));
    }

    function test_depositRedeemRoundTrip() public {
        uint256 shares = _deposit(alice, 100e18);
        assertEq(vault.totalAssets(), 100e18);
        assertEq(vault.maxWithdraw(alice), 100e18);

        vm.prank(alice);
        uint256 assets = vault.redeem(shares, alice, alice);
        assertEq(assets, 100e18);
        assertEq(vault.totalAssets(), 0);
        assertEq(token.balanceOf(alice), 1_000_000e18);
    }

    function test_proRataSplit() public {
        _deposit(alice, 100e18);
        _deposit(bob, 300e18);

        // Keeper pays out 40, dripped in full after the window.
        vm.prank(keeper);
        token.transfer(address(vault), 40e18);
        vault.sync();
        vm.warp(block.timestamp + vault.DRIP_PERIOD());

        assertApproxEqAbs(vault.maxWithdraw(alice), 110e18, 1);
        assertApproxEqAbs(vault.maxWithdraw(bob), 330e18, 1);
    }

    function test_receiptIsTransferable() public {
        uint256 shares = _deposit(alice, 100e18);
        vm.prank(alice);
        vault.transfer(bob, shares);
        assertEq(vault.maxWithdraw(alice), 0);
        assertApproxEqAbs(vault.maxWithdraw(bob), 100e18, 1);
    }

    /* --------------------- yield is dripped, not instant ------------------ */

    function test_keeperTransferDoesNotMovePriceInstantly() public {
        _deposit(alice, 100e18);
        uint256 priceBefore = vault.convertToAssets(1e21);

        vm.prank(keeper);
        token.transfer(address(vault), 50e18);

        assertEq(vault.convertToAssets(1e21), priceBefore, "price jumped on a bare transfer");
        vault.sync();
        assertEq(vault.convertToAssets(1e21), priceBefore, "price jumped on sync");
        assertEq(vault.lockedYield(), 50e18);

        vm.warp(block.timestamp + vault.DRIP_PERIOD() / 2);
        assertApproxEqRel(vault.totalAssets(), 125e18, 1e12);

        vm.warp(block.timestamp + vault.DRIP_PERIOD());
        assertEq(vault.totalAssets(), 150e18);
        assertEq(vault.lockedYield(), 0);
    }

    /// The reason the drip exists: without it, this attacker walks off with most of the payout.
    function test_yieldSandwichIsUnprofitable() public {
        _deposit(alice, 100e18);

        uint256 before = token.balanceOf(attacker);
        uint256 shares = _deposit(attacker, 100e18); // front-run the keeper
        vm.prank(keeper);
        token.transfer(address(vault), 50e18); // the payout
        vm.prank(attacker);
        vault.redeem(shares, attacker, attacker); // back-run, same block

        uint256 profit = token.balanceOf(attacker) - before;
        assertEq(profit, 0, "atomic sandwich extracted yield");

        // And the yield still lands with the depositor who actually held through the window.
        vm.warp(block.timestamp + vault.DRIP_PERIOD());
        assertApproxEqAbs(vault.maxWithdraw(alice), 150e18, 1e6);
    }

    /* ----------------------- inflation / donation attack ------------------ */

    function test_firstDepositorInflationAttackFails() public {
        // Classic setup: mint 1 wei of shares, then donate a huge amount to blow up the price so the
        // next depositor's shares round to zero and their assets are captured.
        vm.prank(attacker);
        uint256 attackerShares = vault.deposit(1, attacker);

        vm.prank(attacker);
        token.transfer(address(vault), 10_000e18);

        uint256 victimBefore = token.balanceOf(bob);
        uint256 victimShares = _deposit(bob, 100e18);
        assertGt(victimShares, 0, "victim's shares rounded to zero");

        // Attacker exits with everything they can.
        vm.warp(block.timestamp + vault.DRIP_PERIOD());
        vm.prank(attacker);
        vault.redeem(attackerShares, attacker, attacker);

        vm.prank(bob);
        vault.redeem(victimShares, bob, bob);
        uint256 victimAfter = token.balanceOf(bob);

        // Bob ends up ahead: he got his principal back plus a slice of the donation.
        assertGe(victimAfter, victimBefore, "victim lost principal to the donation attack");
    }

    function test_donationCannotBeSelfRecovered() public {
        _deposit(alice, 1_000e18);
        uint256 before = token.balanceOf(attacker);

        uint256 shares = _deposit(attacker, 1_000e18);
        vm.prank(attacker);
        token.transfer(address(vault), 1_000e18); // donate
        vm.prank(attacker);
        vault.redeem(shares, attacker, attacker);

        assertLt(token.balanceOf(attacker), before, "attacker recovered their own donation");
    }

    /* ------------------------------ rounding ----------------------------- */

    function testFuzz_redeemNeverReturnsMoreThanDeposited(uint96 a, uint96 b, uint96 yield) public {
        a = uint96(bound(a, 1e6, 1e24));
        b = uint96(bound(b, 1e6, 1e24));
        yield = uint96(bound(yield, 0, 1e24));

        uint256 sharesA = _deposit(alice, a);
        uint256 sharesB = _deposit(bob, b);

        token.mint(address(vault), yield);
        vault.sync();
        vm.warp(block.timestamp + vault.DRIP_PERIOD());

        vm.prank(alice);
        uint256 outA = vault.redeem(sharesA, alice, alice);
        vm.prank(bob);
        uint256 outB = vault.redeem(sharesB, bob, bob);

        // Nobody can withdraw more than the vault was ever given, and rounding favours the vault.
        assertLe(outA + outB, uint256(a) + b + yield);
        assertLe(vault.totalAssets(), token.balanceOf(address(vault)));
    }

    function test_withdrawRoundsSharesUp() public {
        _deposit(alice, 1e18);
        token.mint(address(vault), 1);
        vault.sync();
        vm.warp(block.timestamp + vault.DRIP_PERIOD());

        uint256 sharesBefore = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 burned = vault.withdraw(1e18, alice, alice);
        assertGe(sharesBefore - vault.balanceOf(alice), burned);
        assertLe(vault.totalAssets(), token.balanceOf(address(vault)));
    }

    function test_dustDepositRevertsInsteadOfMintingZero() public {
        _deposit(alice, 1_000e18);
        token.mint(address(vault), 1_000_000e18);
        vault.sync();
        vm.warp(block.timestamp + vault.DRIP_PERIOD());

        vm.prank(bob);
        vm.expectRevert(SaveVault.ZeroShares.selector);
        vault.deposit(1, bob);
    }

    /* -------------------------- hostile underlyings ----------------------- */

    function test_feeOnTransferCreditsWhatArrived() public {
        FeeOnTransferToken fee = new FeeOnTransferToken();
        SaveVault v = SaveVault(factory.createVault(address(fee)));
        fee.mint(alice, 1_000e18);
        vm.startPrank(alice);
        fee.approve(address(v), type(uint256).max);
        uint256 shares = v.deposit(100e18, alice);
        vm.stopPrank();

        assertEq(v.totalAssets(), 99e18, "credited the requested amount, not the received amount");
        assertApproxEqAbs(v.convertToAssets(shares), 99e18, 1);
        assertLe(v.totalAssets(), fee.balanceOf(address(v)));

        // `mint` cannot honour exact-share semantics under a transfer fee, so it refuses.
        vm.prank(alice);
        vm.expectRevert();
        v.mint(1e21, alice);
    }

    function test_reentrantTokenCannotReenter() public {
        ReenteringToken hook = new ReenteringToken();
        SaveVault v = SaveVault(factory.createVault(address(hook)));
        hook.setVault(v);
        hook.mint(alice, 1_000e18);

        vm.startPrank(alice);
        hook.approve(address(v), type(uint256).max);
        hook.arm();
        vm.expectRevert(); // ReentrancyGuard
        v.deposit(100e18, alice);
        vm.stopPrank();
    }

    function test_balanceShortfallIsSharedNotFirstComeFirstServed() public {
        _deposit(alice, 100e18);
        _deposit(bob, 100e18);

        // The token's admin burns half the vault's balance (blacklist / rebase down / rug).
        token.burn(address(vault), 100e18);

        uint256 sharesA = vault.balanceOf(alice);
        uint256 sharesB = vault.balanceOf(bob);
        vm.prank(alice);
        uint256 outA = vault.redeem(sharesA, alice, alice);
        vm.prank(bob);
        uint256 outB = vault.redeem(sharesB, bob, bob);

        assertApproxEqRel(outA, 50e18, 1e12, "first out was made whole at the expense of the rest");
        assertApproxEqRel(outB, 50e18, 1e12, "last out was left with nothing");
    }

    function test_weirdMetadataTokensAreListable() public {
        Bytes32MetadataToken mkr = new Bytes32MetadataToken();
        SaveVault v1 = SaveVault(factory.createVault(address(mkr)));
        assertEq(v1.name(), "Save Maker");
        assertEq(v1.symbol(), "svMKR");

        HostileMetadataToken junk = new HostileMetadataToken();
        SaveVault v2 = SaveVault(factory.createVault(address(junk)));
        assertEq(v2.name(), "Save Unknown Token");
        assertEq(v2.symbol(), "svTKN");
        assertEq(v2.decimals(), 21); // fell back to 18 + offset
    }

    /* -------------------------------- factory ----------------------------- */

    function test_factoryOneVaultPerToken() public {
        assertEq(factory.vaultFor(address(token)), address(vault));
        vm.expectRevert(
            abi.encodeWithSelector(SaveVaultFactory.AlreadyListed.selector, address(token), address(vault))
        );
        factory.createVault(address(token));
    }

    function test_factoryRejectsNonContract() public {
        vm.expectRevert(abi.encodeWithSelector(SaveVaultFactory.NotAContract.selector, alice));
        factory.createVault(alice);
        vm.expectRevert(SaveVaultFactory.ZeroAddress.selector);
        factory.createVault(address(0));
    }

    function test_factoryPredictsAddress() public {
        MockERC20 t = new MockERC20(6);
        address predicted = factory.predictVault(address(t));
        assertEq(factory.createVault(address(t)), predicted);
    }

    function test_noAdminSurface() public {
        // Nothing on the vault can move user funds; there is no owner to compromise.
        vm.prank(attacker);
        vm.expectRevert();
        (bool ok,) = address(vault).call(abi.encodeWithSignature("transferOwnership(address)", attacker));
        ok;
    }
}
