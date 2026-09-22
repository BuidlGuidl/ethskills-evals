// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SaveVaultFactory} from "../src/SaveVaultFactory.sol";
import {SaveTokenVault} from "../src/SaveTokenVault.sol";
import {ERC20} from "../src/ERC20.sol";
import {IERC20} from "../src/IERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock USD", "MUSD", 6) {}

    function mint(address to, uint256 value) external {
        _mint(to, value);
    }
}

contract FeeToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE", 18) {}

    function mint(address to, uint256 value) external {
        _mint(to, value);
    }

    function _transfer(address from, address to, uint256 value) internal override {
        uint256 fee = value / 100;
        uint256 received = value - fee;

        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "ERC20: insufficient balance");
        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += received;
            totalSupply -= fee;
        }

        emit Transfer(from, to, received);
        emit Transfer(from, address(0), fee);
    }
}

contract SaveVaultTest {
    MockToken private token;
    SaveVaultFactory private factory;
    SaveTokenVault private vault;

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant KEEPER = address(0xC0FFEE);

    function setUp() public {
        token = new MockToken();
        factory = new SaveVaultFactory();
        vault = factory.createVault(IERC20(address(token)));

        token.mint(ALICE, 1_000e6);
        token.mint(BOB, 1_000e6);
        token.mint(KEEPER, 1_000e6);
    }

    function testFactoryPreventsDuplicateVaults() public {
        bool reverted;
        try factory.createVault(IERC20(address(token))) {
            reverted = false;
        } catch {
            reverted = true;
        }

        assertTrue(reverted);
        assertEq(factory.vaultForAsset(address(token)), address(vault));
        assertEq(factory.allVaultsLength(), 1);
    }

    function testKeeperTransferLiftsShareClaim() public {
        vmStartPrank(ALICE);
        token.approve(address(vault), 100e6);
        uint256 aliceShares = vault.deposit(100e6, ALICE, 100e6);
        vmStopPrank();

        assertEq(aliceShares, 100e6);
        assertEq(vault.convertToAssets(aliceShares), 100e6);

        vmPrank(KEEPER);
        assertTrue(token.transfer(address(vault), 25e6));

        assertEq(vault.totalAssets(), 125e6);
        assertEq(vault.convertToAssets(aliceShares), 125e6);
    }

    function testDepositsAfterYieldMintProRataShares() public {
        vmStartPrank(ALICE);
        token.approve(address(vault), 100e6);
        vault.deposit(100e6, ALICE, 100e6);
        vmStopPrank();

        vmPrank(KEEPER);
        assertTrue(token.transfer(address(vault), 100e6));

        vmStartPrank(BOB);
        token.approve(address(vault), 100e6);
        uint256 bobShares = vault.deposit(100e6, BOB, 50e6);
        vmStopPrank();

        assertEq(bobShares, 50e6);
        assertEq(vault.convertToAssets(vault.balanceOf(ALICE)), 200e6);
        assertEq(vault.convertToAssets(vault.balanceOf(BOB)), 100e6);
    }

    function testReceiptTokenCanMoveThenRedeem() public {
        vmStartPrank(ALICE);
        token.approve(address(vault), 100e6);
        vault.deposit(100e6, ALICE, 100e6);
        assertTrue(vault.transfer(BOB, 40e6));
        vmStopPrank();

        vmPrank(BOB);
        uint256 withdrawn = vault.redeem(40e6, BOB, BOB, 40e6);

        assertEq(withdrawn, 40e6);
        assertEq(token.balanceOf(BOB), 1_040e6);
    }

    function testFeeOnTransferMintsOnlyReceivedAmount() public {
        FeeToken feeToken = new FeeToken();
        SaveTokenVault feeVault = factory.createVault(IERC20(address(feeToken)));
        feeToken.mint(ALICE, 100e18);

        vmStartPrank(ALICE);
        feeToken.approve(address(feeVault), 100e18);
        uint256 shares = feeVault.deposit(100e18, ALICE, 99e18);
        vmStopPrank();

        assertEq(shares, 99e18);
        assertEq(feeVault.totalAssets(), 99e18);
    }

    function testRedeemHonorsShareAllowance() public {
        vmStartPrank(ALICE);
        token.approve(address(vault), 100e6);
        vault.deposit(100e6, ALICE, 100e6);
        vault.approve(BOB, 30e6);
        vmStopPrank();

        vmPrank(BOB);
        uint256 assets = vault.redeem(30e6, BOB, ALICE, 30e6);

        assertEq(assets, 30e6);
        assertEq(vault.balanceOf(ALICE), 70e6);
        assertEq(token.balanceOf(BOB), 1_030e6);
    }

    function testWithdrawBurnsEnoughSharesForExactAssets() public {
        vmStartPrank(ALICE);
        token.approve(address(vault), 100e6);
        vault.deposit(100e6, ALICE, 100e6);
        vmStopPrank();

        vmPrank(KEEPER);
        assertTrue(token.transfer(address(vault), 50e6));

        vmPrank(ALICE);
        uint256 sharesBurned = vault.withdraw(45e6, ALICE, ALICE, 31e6);

        assertEq(sharesBurned, 30e6);
        assertEq(token.balanceOf(ALICE), 945e6);
        assertEq(vault.balanceOf(ALICE), 70e6);
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "assert eq failed");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "assert eq failed");
    }

    function assertTrue(bool value) internal pure {
        require(value, "assert true failed");
    }

    function vmPrank(address caller) internal {
        Vm(address(uint160(uint256(keccak256("hevm cheat code"))))).prank(caller);
    }

    function vmStartPrank(address caller) internal {
        Vm(address(uint160(uint256(keccak256("hevm cheat code"))))).startPrank(caller);
    }

    function vmStopPrank() internal {
        Vm(address(uint160(uint256(keccak256("hevm cheat code"))))).stopPrank();
    }
}

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
}
