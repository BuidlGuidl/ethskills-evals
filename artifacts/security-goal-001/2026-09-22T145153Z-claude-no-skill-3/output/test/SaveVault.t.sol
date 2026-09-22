// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SaveVault} from "../src/SaveVault.sol";
import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";
import {
    Bytes32MetadataToken,
    FeeOnTransferToken,
    HookToken,
    HostileMetadataToken,
    MockERC20
} from "./mocks/Tokens.sol";

contract SaveVaultTest is Test {
    SaveVaultFactory factory;
    MockERC20 token;
    SaveVault vault;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address keeper = makeAddr("keeper");

    function setUp() public {
        factory = new SaveVaultFactory();
        token = new MockERC20("Dai Stablecoin", "DAI", 18);
        vault = SaveVault(factory.createVault(address(token)));

        token.mint(alice, 1_000e18);
        token.mint(bob, 1_000e18);
        token.mint(keeper, 1_000e18);
        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        token.approve(address(vault), type(uint256).max);
    }

    function _deposit(address who, uint256 amount) internal returns (uint256) {
        vm.prank(who);
        return vault.deposit(amount, who);
    }

    /// Keeper yield lifts every holder's claim, pro-rata.
    function test_yieldIsSharedProRata() public {
        _deposit(alice, 100e18);
        _deposit(bob, 300e18);

        vm.prank(keeper);
        token.transfer(address(vault), 40e18);
        skip(vault.VESTING_PERIOD()); // let it vest fully

        assertApproxEqAbs(vault.maxWithdraw(alice), 110e18, 1e6);
        assertApproxEqAbs(vault.maxWithdraw(bob), 330e18, 1e6);
    }

    /// Yield does not land in a single block, so it cannot be sandwiched by a
    /// deposit-then-withdraw in the same transaction.
    function test_yieldCannotBeSandwiched() public {
        _deposit(alice, 100e18);

        vm.prank(keeper);
        token.transfer(address(vault), 100e18);

        uint256 before = token.balanceOf(bob);
        uint256 shares = _deposit(bob, 100e18);
        vm.prank(bob);
        vault.redeem(shares, bob, bob);

        assertLe(token.balanceOf(bob), before, "JIT depositor extracted value");
    }

    /// Classic first-depositor inflation attack: 1 wei deposit, then a large donation to
    /// round the victim's shares down to zero.
    function test_inflationAttackIsUnprofitable() public {
        vm.startPrank(alice); // attacker
        uint256 attackerShares = vault.deposit(1, alice);
        token.transfer(address(vault), 100e18);
        vm.stopPrank();
        skip(vault.VESTING_PERIOD());

        vm.prank(bob); // victim
        uint256 victimShares = vault.deposit(100e18, bob);
        assertGt(victimShares, 0, "victim minted zero shares");

        vm.prank(alice);
        vault.redeem(attackerShares, alice, alice);
        vm.prank(bob);
        vault.redeem(victimShares, bob, bob);

        assertLt(token.balanceOf(alice), 1_000e18, "attack was profitable");
        assertGe(token.balanceOf(bob), 100e18 - 1e6, "victim lost funds");
    }

    /// Shares are minted against what actually arrived, not what was asked for.
    function test_feeOnTransferCreditsOnlyReceived() public {
        FeeOnTransferToken fot = new FeeOnTransferToken();
        SaveVault v = SaveVault(factory.createVault(address(fot)));
        fot.mint(alice, 100e18);

        vm.startPrank(alice);
        fot.approve(address(v), type(uint256).max);
        uint256 shares = v.deposit(100e18, alice);
        vm.stopPrank();

        assertEq(fot.balanceOf(address(v)), 99e18);
        assertApproxEqAbs(v.convertToAssets(shares), 99e18, 1e6);
        // `mint` cannot honour "pull exactly N" for this token, so it refuses.
        vm.prank(alice);
        vm.expectRevert();
        v.mint(1e18, alice);
    }

    /// A token that calls back into the vault mid-transfer gets nowhere.
    function test_reentrantTokenIsBlocked() public {
        HookToken hook = new HookToken();
        SaveVault v = SaveVault(factory.createVault(address(hook)));
        hook.mint(alice, 100e18);

        vm.prank(alice);
        hook.approve(address(v), type(uint256).max);
        hook.setHook(address(v), abi.encodeCall(SaveVault.sync, ()));

        vm.prank(alice);
        vm.expectRevert();
        v.deposit(10e18, alice);
    }

    /// Weird or hostile metadata cannot stop a token from being listed.
    function test_listsTokensWithOddMetadata() public {
        Bytes32MetadataToken mkr = new Bytes32MetadataToken();
        SaveVault v = SaveVault(factory.createVault(address(mkr)));
        assertEq(v.name(), "Save Maker");
        assertEq(v.symbol(), "svMKR");
        assertEq(v.decimals(), 18 + 6);

        HostileMetadataToken hostile = new HostileMetadataToken();
        SaveVault h = SaveVault(factory.createVault(address(hostile)));
        assertEq(h.name(), "Save Unknown Token");
        assertEq(h.symbol(), "svTKN");
    }

    function test_factoryIsDeterministicAndDeduplicates() public {
        MockERC20 t = new MockERC20("T", "T", 6);
        address predicted = factory.predictVaultAddress(address(t));
        address created = factory.createVault(address(t));
        assertEq(created, predicted);
        assertEq(factory.vaultFor(address(t)), created);

        vm.expectRevert();
        factory.createVault(address(t));

        vm.expectRevert(SaveVault.AssetNotAContract.selector);
        factory.createVault(address(0xdead));
    }

    function testFuzz_roundTripNeverMintsValue(uint96 depositA, uint96 depositB, uint96 yield) public {
        depositA = uint96(bound(depositA, 1e6, 1_000e18));
        depositB = uint96(bound(depositB, 1e6, 1_000e18));
        yield = uint96(bound(yield, 0, 1_000e18));
        token.mint(alice, depositA);
        token.mint(bob, depositB);

        uint256 sharesA = _deposit(alice, depositA);
        uint256 yieldAmount = yield % (token.balanceOf(keeper) + 1);
        vm.prank(keeper);
        token.transfer(address(vault), yieldAmount);
        uint256 sharesB = _deposit(bob, depositB);

        // Bob cannot leave in the same block with more than he put in: the yield that arrived
        // just before him is still vesting and is not part of his claim yet.
        assertLe(vault.previewRedeem(sharesB), depositB);

        // Once everything has vested, the two claims are still fully backed.
        skip(vault.VESTING_PERIOD());
        assertLe(vault.previewRedeem(sharesA) + vault.previewRedeem(sharesB), vault.totalAssets());
    }
}
