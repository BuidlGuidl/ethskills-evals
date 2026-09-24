// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";
import {TokenSavingsVaultFactory} from "../src/TokenSavingsVaultFactory.sol";

contract MockToken is ERC20 {
    uint8 private immutable _DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeToken is MockToken {
    constructor() MockToken("Fee Token", "FEE", 18) {}

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = amount / 100;
            super._update(from, address(0), fee);
            super._update(from, to, amount - fee);
        } else {
            super._update(from, to, amount);
        }
    }
}

contract TokenSavingsVaultTest is Test {
    MockToken internal token;
    TokenSavingsVault internal vault;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal keeper = address(0xC0FFEE);

    function setUp() public {
        token = new MockToken("Mock USD", "mUSD", 6);
        vault = new TokenSavingsVault(token, "Save mUSD Vault", "svmUSD");

        token.mint(alice, 10_000e6);
        token.mint(bob, 10_000e6);
        token.mint(keeper, 10_000e6);
    }

    function testDepositsMintTransferableProRataShares() public {
        _deposit(alice, 100e6);

        uint256 aliceShares = vault.balanceOf(alice);
        assertEq(vault.decimals(), 12);
        assertEq(vault.convertToAssets(aliceShares), 100e6);

        vm.prank(alice);
        assertTrue(vault.transfer(bob, aliceShares / 4));

        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(bob)), 25e6, 1);
        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(alice)), 75e6, 1);
    }

    function testDirectYieldIncreasesEveryShareClaim() public {
        _deposit(alice, 100e6);
        _deposit(bob, 300e6);

        vm.prank(keeper);
        assertTrue(token.transfer(address(vault), 40e6));

        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(alice)), 110e6, 1);
        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(bob)), 330e6, 1);
    }

    function testWithdrawBurnsSharesAndReturnsAssets() public {
        _deposit(alice, 100e6);

        vm.prank(keeper);
        assertTrue(token.transfer(address(vault), 20e6));

        vm.prank(alice);
        uint256 sharesBurned = vault.withdraw(60e6, alice, alice);

        assertGt(sharesBurned, 0);
        assertEq(token.balanceOf(alice), 9_960e6);
        assertApproxEqAbs(vault.convertToAssets(vault.balanceOf(alice)), 60e6, 1);
    }

    function testDepositUsesActualReceivedForFeeOnTransferTokens() public {
        FeeToken feeToken = new FeeToken();
        TokenSavingsVault feeVault = new TokenSavingsVault(feeToken, "Save FEE Vault", "svFEE");
        feeToken.mint(alice, 100 ether);

        vm.startPrank(alice);
        feeToken.approve(address(feeVault), 100 ether);
        uint256 shares = feeVault.deposit(100 ether, alice);
        vm.stopPrank();

        assertEq(feeToken.balanceOf(address(feeVault)), 99 ether);
        assertEq(feeVault.convertToAssets(shares), 99 ether);
    }

    function testMintRevertsWhenTransferFeePreventsRequiredAssets() public {
        FeeToken feeToken = new FeeToken();
        TokenSavingsVault feeVault = new TokenSavingsVault(feeToken, "Save FEE Vault", "svFEE");
        feeToken.mint(alice, 100 ether);

        vm.startPrank(alice);
        feeToken.approve(address(feeVault), 100 ether);
        vm.expectRevert();
        feeVault.mint(1 ether, alice);
        vm.stopPrank();
    }

    function testFactoryCreatesSingleVaultPerAsset() public {
        TokenSavingsVaultFactory factory = new TokenSavingsVaultFactory();

        address predicted = factory.predictVault(address(token));
        address created = factory.createVault(address(token));
        address again = factory.createVault(address(token));

        assertEq(created, predicted);
        assertEq(again, created);
        assertEq(factory.vaultForAsset(address(token)), created);
        assertEq(factory.allVaultsLength(), 1);
    }

    function _deposit(address user, uint256 assets) internal {
        vm.startPrank(user);
        token.approve(address(vault), assets);
        vault.deposit(assets, user);
        vm.stopPrank();
    }
}
