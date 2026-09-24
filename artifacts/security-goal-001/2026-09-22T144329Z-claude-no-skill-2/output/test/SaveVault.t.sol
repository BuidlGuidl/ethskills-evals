// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SaveVault} from "../src/SaveVault.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";
import {
    MockERC20,
    FeeOnTransferERC20,
    ReentrantERC20,
    Bytes32MetadataToken,
    NoDecimalsToken,
    HostileMetadataToken,
    GasBombMetadataToken
} from "./mocks/Mocks.sol";

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
        token = new MockERC20("USD Coin", "USDC", 6);
        vault = SaveVault(factory.createVault(address(token)));

        for (uint256 i; i < 4; ++i) {
            address who = [alice, bob, keeper, attacker][i];
            token.mint(who, 1_000_000e6);
            vm.prank(who);
            token.approve(address(vault), type(uint256).max);
        }
    }

    /*//////////////////////////////////////////////////////////// core */

    function test_receiptIsProRataAndYieldLiftsEveryHolder() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice, 0);
        vm.prank(bob);
        vault.deposit(3_000e6, bob, 0);

        // Keeper drops yield in by plain transfer.
        vm.prank(keeper);
        token.transfer(address(vault), 400e6);

        // 10% gain, minus the dust held by the permanently locked shares.
        assertApproxEqRel(vault.maxWithdraw(alice), 1_100e6, 1e12);
        assertApproxEqRel(vault.maxWithdraw(bob), 3_300e6, 1e12);

        uint256 before = token.balanceOf(alice);
        uint256 aliceShares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice, 0);
        assertApproxEqRel(token.balanceOf(alice) - before, 1_100e6, 1e12);
    }

    function test_receiptTokenIsTransferableAndCarriesTheClaim() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e6, alice, 0);

        vm.prank(alice);
        vault.transfer(bob, shares);

        vm.prank(keeper);
        token.transfer(address(vault), 1_000e6);

        assertEq(vault.maxWithdraw(alice), 0);
        assertGt(vault.maxWithdraw(bob), 1_900e6);
    }

    function test_withdrawViaAllowanceSpendsIt() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e6, alice, 0);

        vm.prank(alice);
        vault.approve(bob, shares);

        vm.prank(bob);
        vault.redeem(shares, bob, alice, 0);
        assertEq(vault.allowance(alice, bob), 0);
    }

    function test_redeemWithoutAllowanceReverts() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e6, alice, 0);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(shares, bob, alice, 0);
    }

    /*//////////////////////////////////////////////// donation / inflation */

    function test_donationBeforeFirstDepositCannotDiluteTheFirstDepositor() public {
        // Classic setup: attacker sends assets to an empty vault.
        vm.prank(attacker);
        token.transfer(address(vault), 500_000e6);

        vm.prank(alice);
        vault.deposit(1_000e6, alice, 0);

        // Alice keeps her deposit and pockets the donation instead of losing it.
        assertGt(vault.maxWithdraw(alice), 1_000e6);
    }

    function test_inflationAttackIsUnprofitable() public {
        // Attacker seeds the vault with the smallest position they can, then
        // donates to inflate the share price before the victim deposits.
        vm.prank(attacker);
        vault.deposit(2, attacker, 0);
        vm.prank(attacker);
        token.transfer(address(vault), 100_000e6);

        uint256 attackerSpent = 100_000e6 + 2;

        vm.prank(alice);
        vault.deposit(100_000e6, alice, 0);

        // Victim is not rounded down to zero shares...
        assertGt(vault.balanceOf(alice), 0);
        // ...and keeps essentially all of her deposit.
        assertGt(vault.maxWithdraw(alice), 99_000e6);

        // The attacker cannot recover what they burned on the attack.
        uint256 attackerShares = vault.balanceOf(attacker);
        vm.prank(attacker);
        uint256 recovered = vault.redeem(attackerShares, attacker, attacker, 0);
        assertLt(recovered, attackerSpent);
    }

    function test_firstDepositMustExceedLockedShares() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.deposit(1, alice, 0); // 1 asset -> exactly MIN_LOCKED_SHARES
        assertEq(vault.totalSupply(), 0);
    }

    function test_totalSupplyNeverReturnsToZero() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e6, alice, 0);
        vm.prank(alice);
        vault.redeem(shares, alice, alice, 0);
        assertEq(vault.totalSupply(), vault.MIN_LOCKED_SHARES());
    }

    /*//////////////////////////////////////////////////////////// slippage */

    function test_depositRespectsMinSharesOut() public {
        vm.prank(alice);
        vault.deposit(1_000e6, alice, 0);

        uint256 quote = vault.previewDeposit(1_000e6);

        // Share price moves against bob before his tx lands.
        vm.prank(keeper);
        token.transfer(address(vault), 1_000e6);

        vm.prank(bob);
        vm.expectRevert();
        vault.deposit(1_000e6, bob, quote);
    }

    function test_redeemRespectsMinAssetsOut() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(1_000e6, alice, 0);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares, alice, alice, 2_000e6);
    }

    /*//////////////////////////////////////////////// hostile token shapes */

    function test_feeOnTransferCreditsOnlyWhatArrived() public {
        FeeOnTransferERC20 fee = new FeeOnTransferERC20(100); // 1%
        SaveVault v = SaveVault(factory.createVault(address(fee)));
        fee.mint(alice, 1_000e18);
        fee.mint(bob, 1_000e18);

        vm.startPrank(alice);
        fee.approve(address(v), type(uint256).max);
        v.deposit(1_000e18, alice, 0);
        vm.stopPrank();

        vm.startPrank(bob);
        fee.approve(address(v), type(uint256).max);
        v.deposit(1_000e18, bob, 0);
        vm.stopPrank();

        // Bob must not be able to redeem more than he actually put in: if the
        // vault credited the requested amount instead of the received amount,
        // the last depositor out would be short.
        assertLe(v.maxWithdraw(alice) + v.maxWithdraw(bob), v.totalAssets());
        assertApproxEqRel(v.maxWithdraw(bob), 990e18, 1e15);
    }

    function test_feeOnTransferMintRevertsRatherThanMisprice() public {
        FeeOnTransferERC20 fee = new FeeOnTransferERC20(100);
        SaveVault v = SaveVault(factory.createVault(address(fee)));
        fee.mint(alice, 1_000e18);
        vm.startPrank(alice);
        fee.approve(address(v), type(uint256).max);
        vm.expectRevert();
        v.mint(1_000e21, alice, type(uint256).max);
        vm.stopPrank();
    }

    function test_reentrantTokenIsBlocked() public {
        ReentrantERC20 hook = new ReentrantERC20();
        SaveVault v = SaveVault(factory.createVault(address(hook)));
        hook.mint(alice, 1_000e18);

        vm.startPrank(alice);
        hook.approve(address(v), type(uint256).max);
        v.deposit(100e18, alice, 0);
        vm.stopPrank();

        hook.arm(v);
        vm.startPrank(alice);
        vm.expectRevert();
        v.deposit(100e18, alice, 0);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////// factory */

    function test_oneVaultPerToken() public {
        assertEq(factory.vaultFor(address(token)), address(vault));
        vm.expectRevert();
        factory.createVault(address(token));
    }

    function test_predictVaultMatchesDeployment() public {
        MockERC20 t = new MockERC20("Dai", "DAI", 18);
        address predicted = factory.predictVault(address(t));
        assertEq(factory.createVault(address(t)), predicted);
    }

    function test_rejectsEOAAndUnreadableTokens() public {
        vm.expectRevert();
        factory.createVault(makeAddr("not a token"));

        NoDecimalsToken bad = new NoDecimalsToken();
        vm.expectRevert();
        factory.createVault(address(bad));
    }

    function test_listsLegacyBytes32Metadata() public {
        Bytes32MetadataToken legacy = new Bytes32MetadataToken();
        SaveVault v = SaveVault(factory.createVault(address(legacy)));
        assertEq(v.symbol(), "svOLD");
    }

    function test_hostileMetadataIsTruncatedAndSanitised() public {
        HostileMetadataToken hostile = new HostileMetadataToken();
        SaveVault v = SaveVault(factory.createVault(address(hostile)));
        assertEq(v.symbol(), "sv????????????????"); // truncated to 16, unprintables replaced
        assertEq(v.decimals(), 6 + v.DECIMALS_OFFSET());
    }

    function test_metadataGasBombFallsBackInsteadOfBricking() public {
        GasBombMetadataToken bomb = new GasBombMetadataToken();
        SaveVault v = SaveVault(factory.createVault(address(bomb)));
        assertEq(v.symbol(), "svTKN");
    }

    function test_shareDecimalsTrackAsset() public view {
        assertEq(vault.decimals(), 6 + vault.DECIMALS_OFFSET());
    }

    /*//////////////////////////////////////////////////////////// invariant-ish */

    function testFuzz_redeemNeverReturnsMoreThanProRata(uint96 aliceIn, uint96 bobIn, uint96 yield) public {
        aliceIn = uint96(bound(aliceIn, 1e6, 1_000_000e6));
        bobIn = uint96(bound(bobIn, 1e6, 1_000_000e6));
        yield = uint96(bound(yield, 0, 1_000_000e6));

        token.mint(alice, aliceIn);
        token.mint(bob, bobIn);
        token.mint(keeper, yield);

        vm.prank(alice);
        vault.deposit(aliceIn, alice, 0);
        vm.prank(bob);
        vault.deposit(bobIn, bob, 0);
        if (yield > 0) {
            vm.prank(keeper);
            token.transfer(address(vault), yield);
        }

        // Claims of all holders never exceed what the vault holds.
        uint256 claims =
            vault.maxWithdraw(alice) + vault.maxWithdraw(bob) + vault.convertToAssets(vault.balanceOf(address(0xdEaD)));
        assertLe(claims, vault.totalAssets());

        // And both can actually exit.
        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice, 0);
        vm.prank(bob);
        vault.redeem(bobShares, bob, bob, 0);
    }
}
