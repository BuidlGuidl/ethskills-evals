// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SaveVault} from "../src/SaveVault.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";
import {MockERC20, FeeOnTransferERC20, ReentrantERC20, WeirdMetadataERC20} from "./mocks/Mocks.sol";

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
        token = new MockERC20("Dai Stablecoin", "DAI", 18);
        vault = factory.createVault(IERC20(address(token)));
    }

    function _fund(address who, uint256 amt) internal {
        token.mint(who, amt);
        vm.prank(who);
        token.approve(address(vault), type(uint256).max);
    }

    // ---------------------------------------------------------------- basics

    function test_metadataAndWiring() public view {
        assertEq(vault.name(), "Saved Dai Stablecoin");
        assertEq(vault.symbol(), "svDAI");
        assertEq(vault.decimals(), 24, "asset decimals + offset");
        assertEq(vault.asset(), address(token));
        assertEq(address(factory.vaultFor(address(token))), address(vault));
    }

    function test_depositRedeemRoundTrip() public {
        _fund(alice, 100e18);
        vm.prank(alice);
        uint256 shares = vault.deposit(100e18, alice);

        assertEq(vault.balanceOf(alice), shares);
        assertEq(vault.totalAssets(), 100e18);

        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice);
        assertApproxEqAbs(out, 100e18, 1, "round trip loses at most dust");
        assertEq(vault.balanceOf(alice), 0);
    }

    /// Yield is a bare transfer in; it must lift every holder pro rata.
    function test_keeperYieldLiftsClaimsProRata() public {
        _fund(alice, 100e18);
        _fund(bob, 300e18);

        vm.prank(alice);
        vault.deposit(100e18, alice);
        vm.prank(bob);
        vault.deposit(300e18, bob);

        // Keeper drips yield with a plain transfer. No vault call, no supply change.
        uint256 supplyBefore = vault.totalSupply();
        token.mint(keeper, 40e18);
        vm.prank(keeper);
        token.transfer(address(vault), 40e18);
        assertEq(vault.totalSupply(), supplyBefore, "yield must not mint shares");

        // 10% yield on the pool: alice 100 -> 110, bob 300 -> 330.
        assertApproxEqRel(vault.maxWithdraw(alice), 110e18, 1e12);
        assertApproxEqRel(vault.maxWithdraw(bob), 330e18, 1e12);
    }

    /// The receipt token is a plain transferable ERC-20; the claim follows the token.
    function test_receiptTokenTransfersClaim() public {
        _fund(alice, 100e18);
        vm.prank(alice);
        uint256 shares = vault.deposit(100e18, alice);

        vm.prank(alice);
        vault.transfer(bob, shares);

        assertEq(vault.maxWithdraw(alice), 0);
        assertApproxEqAbs(vault.maxWithdraw(bob), 100e18, 1);

        vm.prank(bob);
        vault.redeem(shares, bob, bob);
        assertApproxEqAbs(token.balanceOf(bob), 100e18, 1);
    }

    function test_depositOfZeroReverts() public {
        _fund(alice, 1e18);
        vm.prank(alice);
        vm.expectRevert(SaveVault.ZeroShares.selector);
        vault.deposit(0, alice);
    }

    // ------------------------------------------------- inflation / donation

    /**
     * The classic first-depositor attack. Because yield *is* a donation, the vault can
     * never reject donations; virtual shares have to carry the defence.
     */
    function test_inflationAttackIsUnprofitable() public {
        uint256 donation = 10_000e18;
        uint256 victimDeposit = 1e18;

        _fund(attacker, 1 + donation);
        _fund(alice, victimDeposit);

        // 1 wei deposit, then a giant donation to try to inflate the share price.
        vm.startPrank(attacker);
        uint256 attackerShares = vault.deposit(1, attacker);
        token.transfer(address(vault), donation);
        vm.stopPrank();

        // The victim still gets non-zero shares...
        vm.prank(alice);
        uint256 victimShares = vault.deposit(victimDeposit, alice);
        assertGt(victimShares, 0, "victim deposit must not round to zero");

        // ...and can get essentially all of their money back.
        vm.prank(alice);
        uint256 victimOut = vault.redeem(victimShares, alice, alice);
        assertGe(victimOut, (victimDeposit * 99) / 100, "victim keeps >=99% of deposit");

        // The attacker, meanwhile, is deep underwater: the virtual shares swallowed
        // most of the donation.
        vm.prank(attacker);
        uint256 attackerOut = vault.redeem(attackerShares, attacker, attacker);
        assertLt(attackerOut, donation + 1, "attack must never be profitable");
        console2.log("attacker spent", donation + 1, "recovered", attackerOut);
    }

    /// Fuzz the same shape: no donation size lets an attacker extract from a later depositor.
    function testFuzz_donationNeverStealsFromDepositor(uint96 donation, uint96 deposit_) public {
        uint256 d = bound(uint256(donation), 0, 1_000_000e18);
        uint256 v = bound(uint256(deposit_), 1e12, 1_000_000e18);

        _fund(attacker, 1 + d);
        _fund(alice, v);

        vm.startPrank(attacker);
        uint256 attackerShares = vault.deposit(1, attacker);
        if (d > 0) token.transfer(address(vault), d);
        vm.stopPrank();

        uint256 victimShares;

        vm.prank(alice);
        try vault.deposit(v, alice) returns (uint256 s) {
            victimShares = s;
        } catch (bytes memory err) {
            // The only tolerable failure mode: the donation is so large relative to the
            // deposit that shares would round to zero, and we revert instead of taking
            // the money. Confirm it is that case, that it cost the attacker ~1e6x the
            // victim's deposit to trigger, and that the victim kept their tokens.
            assertEq(bytes4(err), SaveVault.ZeroShares.selector, "unexpected revert");
            assertGt(d, v * 10 ** 6 - 1, "rounded to zero without a huge donation");
            assertEq(token.balanceOf(alice), v, "victim must keep their tokens");
            return;
        }

        vm.prank(alice);
        uint256 victimOut = vault.redeem(victimShares, alice, alice);
        vm.prank(attacker);
        uint256 attackerOut = vault.redeem(attackerShares, attacker, attacker);

        // The property that matters: the attacker never ends up ahead of what they
        // put in. The donation is absorbed by the virtual shares, not recaptured.
        assertLe(attackerOut, d + 1, "attacker profited from the donation");

        // The victim's residual loss is bounded by a single share of rounding at the
        // inflated price, i.e. ~donation / 10**offset -- it does NOT scale with the
        // donation the way an unprotected vault's would, and none of it reaches the
        // attacker. A real depositor caps this with a minimum-shares-out check.
        assertLe(v - victimOut, (d + 2) / 10 ** 6 + 2, "loss exceeded one share of rounding");
    }

    // ------------------------------------------------------- hostile tokens

    /// Shares must follow what actually landed, not what was asked for.
    function test_feeOnTransferDoesNotDiluteExistingHolders() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20(100); // 1%
        SaveVault v = factory.createVault(IERC20(address(fot)));

        fot.mint(alice, 100e18);
        fot.mint(bob, 100e18);
        vm.prank(alice);
        fot.approve(address(v), type(uint256).max);
        vm.prank(bob);
        fot.approve(address(v), type(uint256).max);

        vm.prank(alice);
        v.deposit(100e18, alice);
        // 1% was burned in transit: the vault holds 99, and alice's claim is 99, not 100.
        assertEq(v.totalAssets(), 99e18);
        assertApproxEqAbs(v.convertToAssets(v.balanceOf(alice)), 99e18, 1);

        vm.prank(bob);
        v.deposit(100e18, bob);

        // Bob's arrival must not move alice's claim.
        assertApproxEqAbs(v.convertToAssets(v.balanceOf(alice)), 99e18, 1e6);
        assertApproxEqAbs(v.convertToAssets(v.balanceOf(bob)), 99e18, 1e6);
    }

    /// Exact-share minting cannot be honoured by a token that shorts the transfer.
    function test_mintRevertsOnFeeOnTransferToken() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20(100);
        SaveVault v = factory.createVault(IERC20(address(fot)));

        fot.mint(alice, 100e18);
        vm.startPrank(alice);
        fot.approve(address(v), type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(SaveVault.InexactAssetTransfer.selector, 10e18, 10e18 - 0.1e18)
        );
        v.mint(10e18 * 1e6, alice);
        vm.stopPrank();
    }

    /// A token that hands control back mid-transfer cannot re-enter a value-moving path.
    function test_reentrantTokenIsBlocked() public {
        ReentrantERC20 re = new ReentrantERC20();
        SaveVault v = factory.createVault(IERC20(address(re)));

        re.mint(alice, 100e18);
        vm.startPrank(alice);
        re.approve(address(v), type(uint256).max);
        uint256 shares = v.deposit(100e18, alice);
        vm.stopPrank();

        re.arm(v);
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        v.redeem(shares, alice, alice);
    }

    /// bytes32 symbol and a reverting name() must not block a listing.
    function test_nonStandardMetadataStillLists() public {
        WeirdMetadataERC20 weird = new WeirdMetadataERC20();
        SaveVault v = factory.createVault(IERC20(address(weird)));
        assertEq(v.symbol(), "svMKR");
        // name() reverted, so we fall back to the address prefix rather than failing.
        assertEq(bytes(v.name()).length, bytes("Saved ").length + 8);
    }

    // ------------------------------------------------------------- factory

    function test_factoryRejectsEOA() public {
        vm.expectRevert(abi.encodeWithSelector(SaveVaultFactory.NotAContract.selector, alice));
        factory.createVault(IERC20(alice));
    }

    function test_factoryOneVaultPerToken() public {
        vm.expectRevert(
            abi.encodeWithSelector(SaveVaultFactory.VaultAlreadyExists.selector, address(token), address(vault))
        );
        factory.createVault(IERC20(address(token)));
    }

    function test_factoryPredictsAddress() public {
        MockERC20 t2 = new MockERC20("Wrapped Ether", "WETH", 18);
        address predicted = factory.predictVaultAddress(IERC20(address(t2)));
        SaveVault v = factory.createVault(IERC20(address(t2)));
        assertEq(address(v), predicted);
    }

    // ------------------------------------------------------------ invariant

    /// Total claims can never exceed what the vault actually holds.
    function testFuzz_claimsNeverExceedHoldings(uint96 a, uint96 b, uint96 yield) public {
        uint256 aa = bound(uint256(a), 1e12, 1e24);
        uint256 bb = bound(uint256(b), 1e12, 1e24);
        uint256 yy = bound(uint256(yield), 0, 1e24);

        _fund(alice, aa);
        _fund(bob, bb);

        vm.prank(alice);
        vault.deposit(aa, alice);
        vm.prank(bob);
        vault.deposit(bb, bob);

        token.mint(address(vault), yy); // keeper drip

        assertLe(
            vault.maxWithdraw(alice) + vault.maxWithdraw(bob),
            vault.totalAssets(),
            "claims exceed holdings"
        );
    }
}
