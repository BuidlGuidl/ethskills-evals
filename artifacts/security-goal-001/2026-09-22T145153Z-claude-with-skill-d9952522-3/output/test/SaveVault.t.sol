// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {SaveVault} from "../src/SaveVault.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";
import {FeeOnTransferERC20, HostileMetadataERC20, MockERC20, ReentrantERC20} from "./mocks/MockTokens.sol";

contract SaveVaultTest is Test {
    SaveVaultFactory factory;
    MockERC20 token;
    SaveVault vault;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address keeper = address(0xCEE9E7);

    function setUp() public {
        factory = new SaveVaultFactory();
        token = new MockERC20("Token", "TKN", 18);
        vault = factory.createVault(address(token));

        token.mint(alice, 1_000e18);
        token.mint(bob, 1_000e18);
        token.mint(keeper, 1_000e18);
    }

    function _deposit(address who, uint256 amount) internal returns (uint256 shares) {
        vm.startPrank(who);
        token.approve(address(vault), amount);
        shares = vault.deposit(amount, who);
        vm.stopPrank();
    }

    // --- listing -----------------------------------------------------------

    function test_factory_isDeterministicAndUnique() public {
        assertEq(factory.vaultFor(address(token)), address(vault));
        assertEq(factory.predictVaultAddress(address(token)), address(vault));
        vm.expectRevert();
        factory.createVault(address(token));
    }

    function test_factory_rejectsEOA() public {
        vm.expectRevert();
        factory.createVault(address(0xdead));
    }

    function test_metadata() public view {
        assertEq(vault.symbol(), "svTKN");
        assertEq(vault.name(), "Save TKN");
        assertEq(vault.decimals(), 21); // 18 + virtual-share offset
    }

    function test_hostileMetadataStillListable() public {
        HostileMetadataERC20 hostile = new HostileMetadataERC20();
        SaveVault v = factory.createVault(address(hostile));
        assertEq(v.decimals(), 21); // fell back to 18 + offset
        assertGt(bytes(v.symbol()).length, 0); // address-derived fallback
    }

    // --- pro-rata claim ----------------------------------------------------

    function test_claimIsProRata() public {
        _deposit(alice, 100e18);
        _deposit(bob, 300e18);

        assertEq(vault.convertToAssets(vault.balanceOf(alice)), 100e18);
        assertEq(vault.convertToAssets(vault.balanceOf(bob)), 300e18);

        _accrue(40e18);

        // Alice holds 25% of supply, so she gets 25% of the yield.
        assertApproxEqRel(vault.convertToAssets(vault.balanceOf(alice)), 110e18, 1e12);
        assertApproxEqRel(vault.convertToAssets(vault.balanceOf(bob)), 330e18, 1e12);
    }

    function test_roundTripNeverCreatesValue(uint96 a, uint96 b) public {
        a = uint96(bound(a, 1e6, 1_000e18));
        b = uint96(bound(b, 1e6, 1_000e18));
        _deposit(alice, a);
        _deposit(bob, b);

        uint256 before = token.balanceOf(alice);
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);
        assertLe(token.balanceOf(alice) - before, a);
    }

    // --- yield delivery ----------------------------------------------------

    /// @dev Keeper flow: transfer in, then start the stream.
    function _accrue(uint256 amount) internal {
        vm.prank(keeper);
        token.transfer(address(vault), amount);
        vault.syncRewards();
        vm.warp(block.timestamp + vault.REWARDS_CYCLE_LENGTH());
    }

    function test_rawTransferDoesNotMovePriceImmediately() public {
        _deposit(alice, 100e18);
        uint256 priceBefore = vault.convertToAssets(1e21);

        vm.prank(keeper);
        token.transfer(address(vault), 500e18);

        assertEq(vault.convertToAssets(1e21), priceBefore, "donation must not be instant");
        assertEq(vault.pendingRewards(), 500e18);

        vault.syncRewards();
        assertEq(vault.convertToAssets(1e21), priceBefore, "stream must start at zero");

        vm.warp(block.timestamp + 12 hours);
        assertApproxEqRel(vault.totalAssets(), 350e18, 1e12, "half of the batch vested");
    }

    function test_jitDepositCapturesAlmostNothing() public {
        _deposit(alice, 100e18);

        vm.prank(keeper);
        token.transfer(address(vault), 100e18);
        vault.syncRewards();

        // Bob front-runs the sync and exits one block later.
        _deposit(bob, 100e18);
        vm.warp(block.timestamp + 12);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(bob);
        uint256 out = vault.redeem(bobShares, bob, bob);
        assertLe(out, 100e18 + 0.01e18, "JIT capture must be negligible");
    }

    function test_syncCannotBeSpammedToDelayRewards() public {
        _deposit(alice, 100e18);
        vm.prank(keeper);
        token.transfer(address(vault), 100e18);
        vault.syncRewards();

        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert();
        vault.syncRewards();
    }

    function test_lossIsRecognizedProRata() public {
        _deposit(alice, 100e18);
        _deposit(bob, 100e18);

        // Simulate the token confiscating half the vault balance.
        vm.prank(address(vault));
        token.transfer(address(0xdead), 100e18);
        vault.syncRewards();

        assertEq(vault.totalAssets(), 100e18);
        assertApproxEqRel(vault.convertToAssets(vault.balanceOf(alice)), 50e18, 1e12);
    }

    // --- hostile tokens and depositors -------------------------------------

    function test_inflationAttackIsNotProfitable() public {
        // Attacker seeds one wei and donates a large amount before the victim deposits.
        token.mint(address(this), 10_000e18);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(1, address(this));
        token.transfer(address(vault), 1_000e18);

        // The donation is untracked, so the victim's shares are unaffected.
        uint256 victimShares = _deposit(alice, 100e18);
        assertGt(victimShares, 0);
        assertApproxEqRel(vault.convertToAssets(victimShares), 100e18, 1e12);

        // Even after the donation is streamed in, the attacker's 1-wei stake cannot capture it.
        vault.syncRewards();
        vm.warp(block.timestamp + vault.REWARDS_CYCLE_LENGTH());
        uint256 attackerClaim = vault.convertToAssets(vault.balanceOf(address(this)));
        assertLt(attackerClaim, 1_000e18);
        assertGt(vault.convertToAssets(victimShares), 1_000e18 * 99 / 100);
    }

    function test_feeOnTransferCreditsOnlyWhatArrived() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20(100); // 1%
        SaveVault v = factory.createVault(address(fot));
        fot.mint(alice, 100e18);

        vm.startPrank(alice);
        fot.approve(address(v), 100e18);
        uint256 shares = v.deposit(100e18, alice);
        vm.stopPrank();

        assertEq(v.totalAssets(), 99e18, "only what arrived is credited");
        assertApproxEqRel(v.convertToAssets(shares), 99e18, 1e12);

        // The exact-share entry point refuses rather than minting an unbacked claim.
        vm.startPrank(alice);
        fot.approve(address(v), type(uint256).max);
        vm.expectRevert();
        v.mint(1e21, alice);
        vm.stopPrank();
    }

    function test_reentrantTokenIsBlocked() public {
        ReentrantERC20 re = new ReentrantERC20();
        SaveVault v = factory.createVault(address(re));
        re.mint(alice, 100e18);

        vm.prank(alice);
        re.approve(address(v), type(uint256).max);

        re.arm(address(v), abi.encodeCall(SaveVault.syncRewards, ()));
        vm.prank(alice);
        vm.expectRevert();
        v.deposit(10e18, alice);
    }

    function test_zeroValueEntryPointsRevert() public {
        vm.startPrank(alice);
        vm.expectRevert();
        vault.deposit(0, alice);
        vm.expectRevert();
        vault.mint(0, alice);
        vm.expectRevert();
        vault.withdraw(0, alice, alice);
        vm.expectRevert();
        vault.redeem(0, alice, alice);
        vm.stopPrank();
    }

    function test_withdrawNeedsAllowance() public {
        _deposit(alice, 100e18);
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(aliceShares, bob, alice);
    }
}
