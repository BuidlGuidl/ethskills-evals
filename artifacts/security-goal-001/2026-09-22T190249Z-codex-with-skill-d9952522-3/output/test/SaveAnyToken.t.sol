// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SaveAnyTokenFactory} from "../src/SaveAnyTokenFactory.sol";
import {TokenSavingsVault} from "../src/TokenSavingsVault.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0) || value == 0) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = value / 100;
        super._update(from, address(0), fee);
        super._update(from, to, value - fee);
    }
}

contract SaveAnyTokenTest is Test {
    SaveAnyTokenFactory internal factory;
    MockERC20 internal asset;
    TokenSavingsVault internal vault;

    address internal alice = address(0xA11CE);

    function setUp() public {
        factory = new SaveAnyTokenFactory();
        asset = new MockERC20();
        vault = TokenSavingsVault(factory.createVault(IERC20(address(asset)), "Saved Mock Token", "svMOCK"));

        asset.mint(alice, 1_000 ether);
        vm.prank(alice);
        asset.approve(address(vault), type(uint256).max);
    }

    function testFactoryDeploysOneVaultPerAsset() public {
        assertEq(factory.vaultForAsset(address(asset)), address(vault));
        assertEq(factory.allVaultsLength(), 1);
        assertEq(factory.allVaults(0), address(vault));

        vm.expectRevert(
            abi.encodeWithSelector(SaveAnyTokenFactory.VaultAlreadyExists.selector, address(asset), address(vault))
        );
        factory.createVault(IERC20(address(asset)), "Duplicate", "DUP");
    }

    function testDirectYieldRaisesDepositorClaim() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100 ether, alice);

        uint256 beforeYield = vault.convertToAssets(shares);
        asset.mint(address(vault), 10 ether);
        uint256 afterYield = vault.convertToAssets(shares);

        assertGt(afterYield, beforeYield);

        vm.prank(alice);
        uint256 assetsOut = vault.redeem(shares, alice, alice);

        assertGt(assetsOut, 100 ether);
    }

    function testDepositRejectsInexactInboundTransfers() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        TokenSavingsVault feeVault =
            TokenSavingsVault(factory.createVault(IERC20(address(feeToken)), "Saved Fee Token", "svFEE"));

        feeToken.mint(alice, 100 ether);
        vm.startPrank(alice);
        feeToken.approve(address(feeVault), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(TokenSavingsVault.InexactAssetTransfer.selector, 100 ether, 99 ether));
        feeVault.deposit(100 ether, alice);
        vm.stopPrank();
    }
}
