// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SaveVault} from "../src/SaveVault.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";
import {MockERC20, FeeOnTransferERC20, Bytes32SymbolERC20, NoSymbolERC20, ReentrantERC20} from "./mocks/Mocks.sol";

contract SaveVaultTest is Test {
    SaveVaultFactory factory;
    MockERC20 token;
    SaveVault vault;

    address lister = makeAddr("lister");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address keeper = makeAddr("keeper");
    address attacker = makeAddr("attacker");

    uint32 constant CYCLE = 7 days;
    uint256 constant SEED = 1e18;

    function setUp() public {
        factory = new SaveVaultFactory();
        token = new MockERC20("Token", "TKN", 18);

        token.mint(lister, SEED);
        vm.startPrank(lister);
        token.approve(address(factory), SEED);
        vault = SaveVault(factory.createVault(address(token), CYCLE, SEED));
        vm.stopPrank();

        token.mint(alice, 1_000e18);
        token.mint(bob, 1_000e18);
        token.mint(keeper, 1_000e18);
        token.mint(attacker, 1_000_000e18);
    }

    function _deposit(address who, uint256 amt) internal returns (uint256) {
        vm.startPrank(who);
        token.approve(address(vault), amt);
        uint256 shares = vault.deposit(amt, who);
        vm.stopPrank();
        return shares;
    }

    /*//////////////////////////////////////////////////////////////
                          CLAIM / PRO-RATA MATHS
    //////////////////////////////////////////////////////////////*/

    function test_deposit_mintsProRataShares() public {
        _deposit(alice, 100e18);
        _deposit(bob, 300e18);

        // Bob put in 3x Alice, so he holds 3x the shares and 3x the claim.
        assertApproxEqRel(vault.balanceOf(bob), vault.balanceOf(alice) * 3, 1e12);
        assertApproxEqAbs(vault.previewRedeem(vault.balanceOf(alice)), 100e18, 1);
        assertApproxEqAbs(vault.previewRedeem(vault.balanceOf(bob)), 300e18, 1);
    }

    function test_receiptTokenIsTransferable() public {
        _deposit(alice, 100e18);
        uint256 shares = vault.balanceOf(alice);

        vm.prank(alice);
        vault.transfer(bob, shares);

        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.balanceOf(bob), shares);

        // The claim travels with the receipt.
        vm.prank(bob);
        uint256 got = vault.redeem(shares, bob, bob);
        assertApproxEqAbs(got, 100e18, 1);
    }

    function test_yieldLiftsEveryHolderProRata() public {
        _deposit(alice, 100e18);
        _deposit(bob, 300e18);

        uint256 aliceBefore = vault.previewRedeem(vault.balanceOf(alice));
        uint256 bobBefore = vault.previewRedeem(vault.balanceOf(bob));

        // Keeper sends yield in, then someone syncs, then it vests fully.
        vm.prank(keeper);
        token.transfer(address(vault), 40e18);
        vault.syncRewards();
        vm.warp(block.timestamp + CYCLE);

        uint256 aliceGain = vault.previewRedeem(vault.balanceOf(alice)) - aliceBefore;
        uint256 bobGain = vault.previewRedeem(vault.balanceOf(bob)) - bobBefore;

        // Bob holds 3x, so he earns ~3x. Seed holds a slice too, hence the tolerance.
        assertApproxEqRel(bobGain, aliceGain * 3, 1e12);
        assertGt(aliceGain, 0);
    }

    /*//////////////////////////////////////////////////////////////
                       DONATION / INFLATION ATTACK
    //////////////////////////////////////////////////////////////*/

    function test_donationDoesNotMoveSharePrice() public {
        _deposit(alice, 100e18);
        uint256 priceBefore = vault.previewRedeem(1e18);

        // Unsolicited transfer straight into the vault.
        vm.prank(attacker);
        token.transfer(address(vault), 500_000e18);

        // Share price is unchanged: totalAssets() ignores unsynced balance.
        assertEq(vault.previewRedeem(1e18), priceBefore);
    }

    function test_firstDepositorInflationAttackFails() public {
        // Fresh vault, attacker tries the classic: tiny deposit + huge donation before the victim.
        MockERC20 t2 = new MockERC20("Two", "TWO", 18);
        t2.mint(lister, 1e18);
        vm.startPrank(lister);
        t2.approve(address(factory), 1e18);
        SaveVault v2 = SaveVault(factory.createVault(address(t2), CYCLE, 1e18));
        vm.stopPrank();

        t2.mint(attacker, 1_000_000e18);
        t2.mint(bob, 100e18);

        vm.startPrank(attacker);
        t2.approve(address(v2), 1);
        v2.deposit(1, attacker);
        t2.transfer(address(v2), 1_000_000e18 - 1); // donation
        vm.stopPrank();

        // Victim deposits.
        vm.startPrank(bob);
        t2.approve(address(v2), 100e18);
        uint256 bobShares = v2.deposit(100e18, bob);
        vm.stopPrank();

        assertGt(bobShares, 0, "victim must receive shares");
        // Victim can still redeem essentially everything they put in.
        assertApproxEqRel(v2.previewRedeem(bobShares), 100e18, 1e12);

        // And the attacker cannot extract the donation.
        uint256 attackerClaim = v2.previewRedeem(v2.balanceOf(attacker));
        assertLt(attackerClaim, 1_000e18, "attacker must not recover the donation");
    }

    /*//////////////////////////////////////////////////////////////
                        KEEPER SANDWICH / VESTING
    //////////////////////////////////////////////////////////////*/

    function test_yieldVestsLinearlyNotInstantly() public {
        _deposit(alice, 100e18);

        vm.prank(keeper);
        token.transfer(address(vault), 100e18);

        uint256 assetsBefore = vault.totalAssets();
        vault.syncRewards();
        // Nothing credited at t=0 of the cycle.
        assertEq(vault.totalAssets(), assetsBefore);

        vm.warp(block.timestamp + CYCLE / 2);
        assertApproxEqRel(vault.totalAssets(), assetsBefore + 50e18, 1e12);

        vm.warp(block.timestamp + CYCLE / 2);
        assertEq(vault.totalAssets(), assetsBefore + 100e18);
    }

    function test_sandwichingTheKeeperIsNotProfitable() public {
        _deposit(alice, 100e18);

        uint256 attackerStart = token.balanceOf(attacker);

        // Attacker front-runs the keeper top-up with a large deposit...
        vm.startPrank(attacker);
        token.approve(address(vault), 500e18);
        uint256 shares = vault.deposit(500e18, attacker);
        vm.stopPrank();

        vm.prank(keeper);
        token.transfer(address(vault), 100e18);
        vault.syncRewards();

        // ...and exits in the same block.
        vm.startPrank(attacker);
        vault.redeem(shares, attacker, attacker);
        vm.stopPrank();

        assertLe(token.balanceOf(attacker), attackerStart, "sandwich must not be profitable");
    }

    function test_syncRewardsRejectedMidCycle() public {
        _deposit(alice, 100e18);
        vm.prank(keeper);
        token.transfer(address(vault), 10e18);
        vault.syncRewards();

        vm.prank(keeper);
        token.transfer(address(vault), 10e18);
        vm.expectRevert(SaveVault.CycleStillActive.selector);
        vault.syncRewards();
    }

    function test_totalAssetsNeverExceedsBalance() public {
        _deposit(alice, 100e18);
        vm.prank(keeper);
        token.transfer(address(vault), 37e18);
        vault.syncRewards();

        for (uint256 i; i < 10; i++) {
            vm.warp(block.timestamp + CYCLE / 10);
            assertLe(vault.totalAssets(), token.balanceOf(address(vault)), "vault must stay solvent");
        }
    }

    /// @dev Everyone redeeming in full must never exceed what the vault actually holds.
    function testFuzz_solventAfterFullExit(uint96 aliceAmt, uint96 bobAmt, uint96 yield) public {
        aliceAmt = uint96(bound(aliceAmt, 1e6, 1_000e18));
        bobAmt = uint96(bound(bobAmt, 1e6, 1_000e18));
        yield = uint96(bound(yield, 0, 1_000e18));

        token.mint(alice, aliceAmt);
        token.mint(bob, bobAmt);
        token.mint(keeper, yield);

        _deposit(alice, aliceAmt);
        _deposit(bob, bobAmt);

        if (yield > 0) {
            vm.prank(keeper);
            token.transfer(address(vault), yield);
            vault.syncRewards();
            vm.warp(block.timestamp + CYCLE);
        }

        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);
        vm.prank(bob);
        vault.redeem(bobShares, bob, bob);

        // Seed shares remain; the vault must still cover them.
        assertLe(vault.totalAssets(), token.balanceOf(address(vault)));
    }

    /// @dev Regression: mid-stream redemption used to underflow `storedTotalAssets`, bricking exits.
    function testFuzz_exitMidVestingCycle(uint96 amt, uint96 yield, uint32 elapsed) public {
        amt = uint96(bound(amt, 1e6, 1_000e18));
        yield = uint96(bound(yield, 1, 1_000e18));
        elapsed = uint32(bound(elapsed, 0, CYCLE));

        token.mint(alice, amt);
        token.mint(keeper, yield);
        _deposit(alice, amt);

        vm.prank(keeper);
        token.transfer(address(vault), yield);
        vault.syncRewards();
        vm.warp(block.timestamp + elapsed);

        // Vesting is lazy, so the vested-but-unfolded remainder lives in `lastRewardAmount`.
        assertLe(vault.totalAssets(), vault.storedTotalAssets() + vault.lastRewardAmount());

        // The regression itself: this used to underflow and revert mid-cycle.
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        // After an entry point runs, the checkpoint has folded everything vested into principal.
        assertGe(vault.storedTotalAssets(), vault.totalAssets(), "principal must cover totalAssets");
        assertLe(vault.totalAssets(), token.balanceOf(address(vault)));
    }

    /// @dev Checkpointing must not change the share price at the instant it runs.
    function test_checkpointIsValuePreserving() public {
        _deposit(alice, 100e18);
        vm.prank(keeper);
        token.transfer(address(vault), 100e18);
        vault.syncRewards();
        vm.warp(block.timestamp + CYCLE / 3);

        uint256 priceBefore = vault.previewRedeem(1e18);
        uint256 assetsBefore = vault.totalAssets();
        _deposit(bob, 1e18); // triggers _checkpointRewards
        assertEq(vault.previewRedeem(1e18), priceBefore);
        assertEq(vault.totalAssets(), assetsBefore + 1e18);
    }

    /*//////////////////////////////////////////////////////////////
                          HOSTILE ERC-20 HANDLING
    //////////////////////////////////////////////////////////////*/

    function test_feeOnTransferTokenIsRejected() public {
        FeeOnTransferERC20 fee = new FeeOnTransferERC20(100); // 1%
        fee.mint(lister, 10e18);

        vm.startPrank(lister);
        fee.approve(address(factory), 10e18);
        vm.expectRevert();
        factory.createVault(address(fee), CYCLE, 10e18);
        vm.stopPrank();
    }

    function test_reentrantTokenCannotReenter() public {
        ReentrantERC20 re = new ReentrantERC20();
        re.mint(lister, 1e18);

        vm.startPrank(lister);
        re.approve(address(factory), 1e18);
        SaveVault v = SaveVault(factory.createVault(address(re), CYCLE, 1e18));
        vm.stopPrank();

        re.setVault(v);
        re.mint(address(this), 10e18);
        re.approve(address(v), 10e18);
        uint256 shares = v.deposit(10e18, address(this));

        re.setAttacking(true);
        vm.expectRevert(); // ReentrancyGuardReentrantCall
        v.redeem(shares, address(this), address(this));
    }

    function test_zeroShareDepositReverts() public {
        _deposit(alice, 100e18);
        vm.startPrank(alice);
        token.approve(address(vault), 1);
        vm.expectRevert(SaveVault.ZeroShares.selector);
        vault.deposit(0, alice);
        vm.stopPrank();
    }

    function test_cannotWithdrawMoreThanClaim() public {
        _deposit(alice, 100e18);
        uint256 max = vault.maxWithdraw(alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(max + 1e18, alice, alice);
    }

    function test_cannotRedeemSomeoneElsesShares() public {
        _deposit(alice, 100e18);
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(aliceShares, bob, alice);
    }

    /*//////////////////////////////////////////////////////////////
                                FACTORY
    //////////////////////////////////////////////////////////////*/

    function test_oneVaultPerToken() public {
        token.mint(lister, SEED);
        vm.startPrank(lister);
        token.approve(address(factory), SEED);
        vm.expectRevert(abi.encodeWithSelector(SaveVaultFactory.VaultAlreadyExists.selector, address(vault)));
        factory.createVault(address(token), CYCLE, SEED);
        vm.stopPrank();
    }

    function test_seedSharesAreLockedForever() public view {
        assertGt(vault.balanceOf(factory.BURN_ADDRESS()), 0);
        assertEq(vault.balanceOf(lister), 0, "lister must not keep the seed");
        assertEq(vault.balanceOf(address(factory)), 0, "factory must not hold shares");
    }

    function test_cannotListNonContract() public {
        vm.expectRevert(SaveVaultFactory.TokenNotAContract.selector);
        factory.createVault(makeAddr("eoa"), CYCLE, 1e18);
    }

    function test_seedIsRequired() public {
        MockERC20 t = new MockERC20("T", "T", 18);
        vm.expectRevert(SaveVaultFactory.SeedRequired.selector);
        factory.createVault(address(t), CYCLE, 0);
    }

    function test_rewardsCycleBoundsEnforced() public {
        MockERC20 t = new MockERC20("T", "T", 18);
        t.mint(lister, 1e18);
        vm.startPrank(lister);
        t.approve(address(factory), 1e18);
        vm.expectRevert(SaveVault.InvalidRewardsCycle.selector);
        factory.createVault(address(t), 1 minutes, 1e18);
        vm.stopPrank();
    }

    function test_listsTokensWithOddSymbols() public {
        Bytes32SymbolERC20 mkr = new Bytes32SymbolERC20();
        mkr.mint(lister, 1e18);
        NoSymbolERC20 nos = new NoSymbolERC20();
        nos.mint(lister, 1e18);

        vm.startPrank(lister);
        mkr.approve(address(factory), 1e18);
        SaveVault v1 = SaveVault(factory.createVault(address(mkr), CYCLE, 1e18));
        nos.approve(address(factory), 1e18);
        SaveVault v2 = SaveVault(factory.createVault(address(nos), CYCLE, 1e18));
        vm.stopPrank();

        assertEq(v1.symbol(), "svMKR");
        assertEq(v2.symbol(), "svTOKEN");
    }

    function test_predictVaultAddressMatches() public {
        MockERC20 t = new MockERC20("Pred", "PRED", 6);
        address predicted = factory.predictVaultAddress(address(t), CYCLE);
        t.mint(lister, 1e6);
        vm.startPrank(lister);
        t.approve(address(factory), 1e6);
        address actual = factory.createVault(address(t), CYCLE, 1e6);
        vm.stopPrank();
        assertEq(actual, predicted);
    }

    function test_receiptDecimalsTrackUnderlying() public {
        MockERC20 usdcLike = new MockERC20("USD", "USD", 6);
        usdcLike.mint(lister, 1e6);
        vm.startPrank(lister);
        usdcLike.approve(address(factory), 1e6);
        SaveVault v = SaveVault(factory.createVault(address(usdcLike), CYCLE, 1e6));
        vm.stopPrank();

        assertEq(v.decimals(), 6 + 6); // underlying + offset
    }
}
