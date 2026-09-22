// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SaveVault} from "../src/SaveVault.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";
import {
    Bytes32MetadataToken,
    FeeOnTransferERC20,
    MockERC20,
    ReentrancyAttacker,
    ReentrantERC20,
    WeirdMetadataToken
} from "./mocks/Mocks.sol";

contract SaveVaultTest is Test {
    SaveVaultFactory factory;
    MockERC20 usdc; // 6 decimals, the decimal trap
    SaveVault vault;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address attacker = makeAddr("attacker");
    address keeper = makeAddr("keeper");

    function setUp() public {
        factory = new SaveVaultFactory();
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = SaveVault(factory.createVault(address(usdc)));

        for (uint256 i; i < 4; ++i) {
            address who = [alice, bob, attacker, keeper][i];
            usdc.mint(who, 1_000_000e6);
            vm.prank(who);
            usdc.approve(address(vault), type(uint256).max);
        }
    }

    // ---------------------------------------------------------------- claims

    function test_claimIsProRataAndYieldLiftsEveryone() public {
        vm.prank(alice);
        vault.deposit(100e6, alice);
        vm.prank(bob);
        vault.deposit(300e6, bob);

        // Keeper drops yield in as a bare transfer.
        vm.prank(keeper);
        usdc.transfer(address(vault), 40e6);

        // 40 USDC split 1:3 => alice +10, bob +30.
        assertApproxEqAbs(vault.maxWithdraw(alice), 110e6, 1);
        assertApproxEqAbs(vault.maxWithdraw(bob), 330e6, 1);
    }

    function test_receiptIsTransferableAndCarriesTheClaim() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100e6, alice);
        vm.prank(alice);
        vault.transfer(bob, shares);

        vm.prank(keeper);
        usdc.transfer(address(vault), 50e6);

        assertEq(vault.maxWithdraw(alice), 0);
        assertApproxEqAbs(vault.maxWithdraw(bob), 150e6, 1);
    }

    function test_decimalsTrackUnderlyingPlusOffset() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(vault.decimals(), 6 + 6);
    }

    // ------------------------------------------------------- inflation attack

    /// The canonical first-depositor / donation attack, run end to end.
    function test_inflationAttackIsUnprofitable() public {
        uint256 attackerStart = usdc.balanceOf(attacker);

        vm.prank(attacker);
        vault.deposit(1, attacker); // 1 wei -> 1e6 shares thanks to the offset

        vm.prank(attacker);
        usdc.transfer(address(vault), 200_000e6); // donate to inflate the rate

        vm.prank(alice);
        vault.deposit(100_000e6, alice);

        // Victim must still receive shares...
        assertGt(vault.balanceOf(alice), 0, "victim rounded to zero shares");

        // ...and the attacker must not come out ahead.
        uint256 atkShares = vault.balanceOf(attacker);
        vm.prank(attacker);
        vault.redeem(atkShares, attacker, attacker);
        assertLt(usdc.balanceOf(attacker), attackerStart, "attack was profitable");

        // The victim keeps essentially all of their deposit (loss is pure rounding).
        assertGe(vault.maxWithdraw(alice), 99_999e6, "victim was drained");
    }

    /// An attacker willing to burn ~1e6x the victim's deposit can still push the quote to zero
    /// shares. That must revert, not silently mint nothing and donate the deposit to the pool.
    function test_absurdDonationGriefsWithARevertNotATheft() public {
        vm.prank(attacker);
        vault.deposit(1, attacker);
        vm.prank(attacker);
        usdc.transfer(address(vault), 500_000e6);

        uint256 aliceStart = usdc.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert(SaveVault.ZeroShares.selector);
        vault.deposit(1e5, alice); // 0.1 USDC against a 500k donation

        assertEq(usdc.balanceOf(alice), aliceStart, "victim lost funds");
    }

    function test_dustDepositThatRoundsToZeroSharesReverts() public {
        vm.prank(alice);
        vault.deposit(1000e6, alice);
        vm.prank(keeper);
        usdc.transfer(address(vault), 1_000_000e6 - 1000e6);

        vm.prank(bob);
        vm.expectRevert(SaveVault.ZeroShares.selector);
        vault.deposit(0, bob);
    }

    // ---------------------------------------------------- fee-on-transfer

    function test_feeOnTransferCreditsOnlyWhatArrived() public {
        FeeOnTransferERC20 fee = new FeeOnTransferERC20(100); // 1%
        SaveVault v = SaveVault(factory.createVault(address(fee)));

        fee.mint(alice, 1000e18);
        fee.mint(bob, 1000e18);
        vm.prank(alice);
        fee.approve(address(v), type(uint256).max);
        vm.prank(bob);
        fee.approve(address(v), type(uint256).max);

        vm.prank(alice);
        v.deposit(1000e18, alice);
        assertEq(fee.balanceOf(address(v)), 990e18, "vault received 99%");

        vm.prank(bob);
        v.deposit(1000e18, bob);

        // Bob must not be able to dilute alice: equal deposits, equal claims.
        assertApproxEqRel(v.maxWithdraw(alice), v.maxWithdraw(bob), 1e12);
        assertLe(v.maxWithdraw(alice) + v.maxWithdraw(bob), fee.balanceOf(address(v)));
    }

    // ------------------------------------------------------------ reentrancy

    function test_reentrantTokenCannotReenter() public {
        ReentrantERC20 hooked = new ReentrantERC20();
        SaveVault v = SaveVault(factory.createVault(address(hooked)));
        ReentrancyAttacker atk = new ReentrancyAttacker(v);

        hooked.mint(address(atk), 100e18);
        hooked.setHook(address(atk));
        vm.prank(address(atk));
        hooked.approve(address(v), type(uint256).max);

        atk.go(50e18);

        assertTrue(atk.reenterAttempted(), "hook never fired");
        assertFalse(atk.reenterSucceeded(), "reentrancy succeeded");
    }

    // ---------------------------------------------------------- slippage

    function test_depositMinEnforcesFloor() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.depositMin(100e6, alice, type(uint256).max);
    }

    function test_redeemMinEnforcesFloor() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100e6, alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeemMin(shares, alice, alice, 101e6);
    }

    // ---------------------------------------------------------- validation

    function test_cannotMintSharesToTheVaultItself() public {
        vm.prank(alice);
        vm.expectRevert(SaveVault.InvalidReceiver.selector);
        vault.deposit(100e6, address(vault));
    }

    function test_zeroWithdrawReverts() public {
        vm.prank(alice);
        vault.deposit(100e6, alice);
        vm.prank(alice);
        vm.expectRevert(SaveVault.ZeroAssets.selector);
        vault.withdraw(0, alice, alice);
    }

    function test_cannotRedeemSomeoneElsesSharesWithoutAllowance() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100e6, alice);
        vm.prank(bob);
        vm.expectRevert();
        vault.redeem(shares, bob, alice);
    }

    // ------------------------------------------------------------- factory

    function test_oneVaultPerTokenAtADeterministicAddress() public {
        MockERC20 t = new MockERC20("T", "T", 18);
        address predicted = factory.computeVaultAddress(address(t));
        address created = factory.createVault(address(t));
        assertEq(created, predicted);

        vm.expectRevert(abi.encodeWithSelector(SaveVaultFactory.VaultAlreadyExists.selector, created));
        factory.createVault(address(t));
    }

    function test_listingANonContractReverts() public {
        vm.expectRevert(SaveVaultFactory.TokenNotContract.selector);
        factory.createVault(makeAddr("not a token"));
    }

    function test_hostileMetadataDoesNotBlockOrPoisonListing() public {
        WeirdMetadataToken weird = new WeirdMetadataToken();
        SaveVault v = SaveVault(factory.createVault(address(weird)));
        assertEq(v.name(), "Save Unknown Token"); // name() reverted -> fallback
        assertEq(v.symbol(), "svBADscript"); // NUL, quote and angle brackets stripped
    }

    function test_bytes32MetadataIsDecoded() public {
        Bytes32MetadataToken mkr = new Bytes32MetadataToken();
        SaveVault v = SaveVault(factory.createVault(address(mkr)));
        assertEq(v.symbol(), "svMKR");
    }

    // ---------------------------------------------------------------- fuzz

    /// No sequence of deposits, yield and redemptions may let a holder withdraw more than the
    /// vault holds, and the total of all claims must never exceed the balance.
    function testFuzz_claimsNeverExceedAssets(uint96 aDep, uint96 bDep, uint96 yield) public {
        aDep = uint96(bound(aDep, 1e6, 100_000e6));
        bDep = uint96(bound(bDep, 1e6, 100_000e6));
        yield = uint96(bound(yield, 0, 100_000e6));

        vm.prank(alice);
        vault.deposit(aDep, alice);
        vm.prank(bob);
        vault.deposit(bDep, bob);
        vm.prank(keeper);
        usdc.transfer(address(vault), yield);

        assertLe(
            vault.maxWithdraw(alice) + vault.maxWithdraw(bob), usdc.balanceOf(address(vault)), "claims exceed assets"
        );

        uint256 aliceShares = vault.balanceOf(alice);
        uint256 bobShares = vault.balanceOf(bob);
        vm.prank(alice);
        vault.redeem(aliceShares, alice, alice);
        vm.prank(bob);
        vault.redeem(bobShares, bob, bob);
    }

    /// A depositor who immediately withdraws must never extract more than they put in.
    function testFuzz_roundTripIsNeverProfitable(uint96 seed, uint96 amount) public {
        seed = uint96(bound(seed, 1e6, 500_000e6));
        amount = uint96(bound(amount, 1e6, 500_000e6));

        vm.prank(alice);
        vault.deposit(seed, alice);

        uint256 before = usdc.balanceOf(bob);
        vm.prank(bob);
        uint256 shares = vault.deposit(amount, bob);
        vm.prank(bob);
        vault.redeem(shares, bob, bob);
        assertLe(usdc.balanceOf(bob), before, "free money on round trip");
    }
}
