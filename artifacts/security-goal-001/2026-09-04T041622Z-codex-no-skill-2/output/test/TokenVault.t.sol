// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {MockERC20} from "../src/mocks/MockERC20.sol";
import {TokenVault, TokenVaultFactory} from "../src/TokenVault.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract Test {
    function assertEq(uint256 left, uint256 right, string memory message) internal pure {
        require(left == right, message);
    }

    function assertEq(address left, address right, string memory message) internal pure {
        require(left == right, message);
    }
}

contract TokenVaultTest is Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant KEEPER = address(0xBEEF);

    function testCreateVaultRejectsDuplicateAsset() external {
        MockERC20 asset = new MockERC20("Mock USD", "mUSD", 18);
        TokenVaultFactory factory = new TokenVaultFactory();

        address vaultAddress = factory.createVault(address(asset));
        assertEq(factory.vaultOf(address(asset)), vaultAddress, "factory should store vault");

        vm.expectRevert(TokenVaultFactory.VaultAlreadyExists.selector);
        factory.createVault(address(asset));
    }

    function testYieldAccruesProRataAcrossDepositors() external {
        (MockERC20 asset, TokenVault vault) = _deployVault();

        asset.mint(ALICE, 100 ether);
        asset.mint(BOB, 60 ether);
        asset.mint(KEEPER, 20 ether);

        vm.prank(ALICE);
        asset.approve(address(vault), type(uint256).max);
        vm.prank(ALICE);
        uint256 aliceShares = vault.deposit(100 ether, ALICE);

        vm.prank(KEEPER);
        require(asset.transfer(address(vault), 20 ether), "keeper transfer failed");

        vm.prank(BOB);
        asset.approve(address(vault), type(uint256).max);
        vm.prank(BOB);
        uint256 bobShares = vault.deposit(60 ether, BOB);

        assertEq(aliceShares, 100 ether, "first depositor should mint 1:1 shares");
        assertEq(bobShares, 50 ether, "second depositor should price off boosted assets");
        assertEq(vault.totalAssets(), 180 ether, "vault should hold deposits plus yield");

        vm.prank(ALICE);
        uint256 aliceAssets = vault.redeem(aliceShares, ALICE, ALICE);
        vm.prank(BOB);
        uint256 bobAssets = vault.redeem(bobShares, BOB, BOB);

        assertEq(aliceAssets, 120 ether, "alice should receive her pro-rata assets");
        assertEq(bobAssets, 60 ether, "bob should receive his pro-rata assets");
    }

    function testReceiptTransfersMoveTheClaim() external {
        (MockERC20 asset, TokenVault vault) = _deployVault();

        asset.mint(ALICE, 100 ether);
        asset.mint(KEEPER, 50 ether);

        vm.prank(ALICE);
        asset.approve(address(vault), type(uint256).max);
        vm.prank(ALICE);
        vault.deposit(100 ether, ALICE);

        vm.prank(ALICE);
        require(vault.transfer(BOB, 40 ether), "share transfer failed");

        vm.prank(KEEPER);
        require(asset.transfer(address(vault), 50 ether), "keeper transfer failed");

        vm.prank(BOB);
        uint256 bobAssets = vault.redeem(40 ether, BOB, BOB);
        vm.prank(ALICE);
        uint256 aliceAssets = vault.redeem(60 ether, ALICE, ALICE);

        assertEq(bobAssets, 60 ether, "bob should inherit the transferred claim");
        assertEq(aliceAssets, 90 ether, "alice keeps the remaining claim");
    }

    function testDepositRevertsIfVaultWasFundedBeforeAnySharesExist() external {
        (MockERC20 asset, TokenVault vault) = _deployVault();

        asset.mint(KEEPER, 1 ether);
        asset.mint(ALICE, 10 ether);

        vm.prank(KEEPER);
        require(asset.transfer(address(vault), 1 ether), "keeper transfer failed");

        vm.prank(ALICE);
        asset.approve(address(vault), type(uint256).max);

        vm.expectRevert(TokenVault.VaultFundedBeforeSharesExist.selector);
        vm.prank(ALICE);
        vault.deposit(10 ether, ALICE);
    }

    function _deployVault() internal returns (MockERC20 asset, TokenVault vault) {
        asset = new MockERC20("Mock USD", "mUSD", 18);
        TokenVaultFactory factory = new TokenVaultFactory();
        vault = TokenVault(factory.createVault(address(asset)));
    }
}
