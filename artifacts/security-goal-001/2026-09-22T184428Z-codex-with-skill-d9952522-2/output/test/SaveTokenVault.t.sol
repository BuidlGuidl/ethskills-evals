// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SaveTokenVault} from "../src/SaveTokenVault.sol";
import {SaveTokenVaultFactory} from "../src/SaveTokenVaultFactory.sol";

interface Vm {
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function expectRevert(bytes calldata revertData) external;
}

contract MockToken is ERC20 {
    uint8 private immutable _TOKEN_DECIMALS;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _TOKEN_DECIMALS = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _TOKEN_DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeToken is MockToken {
    address public immutable FEE_SINK;
    uint256 public feeBps;

    constructor(address feeSink_) MockToken("Fee Token", "FEE", 18) {
        FEE_SINK = feeSink_;
    }

    function setFeeBps(uint256 feeBps_) external {
        feeBps = feeBps_;
    }

    function _update(address from, address to, uint256 value) internal override {
        uint256 fee = from == address(0) || to == address(0) ? 0 : (value * feeBps) / 10_000;

        if (fee == 0) {
            super._update(from, to, value);
            return;
        }

        super._update(from, to, value - fee);
        super._update(from, FEE_SINK, fee);
    }
}

contract SaveTokenVaultTest {
    Vm internal constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    SaveTokenVaultFactory internal factory;
    MockToken internal token;
    SaveTokenVault internal vault;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal keeper = address(0xC0FFEE);
    address internal feeSink = address(0xFEE);

    function assertEq(address actual, address expected) internal pure {
        require(actual == expected, "address mismatch");
    }

    function assertEq(uint256 actual, uint256 expected) internal pure {
        require(actual == expected, "uint256 mismatch");
    }

    function assertGt(uint256 actual, uint256 floor) internal pure {
        require(actual > floor, "not greater than floor");
    }

    function assertApproxEqAbs(uint256 actual, uint256 expected, uint256 maxDelta) internal pure {
        uint256 delta = actual > expected ? actual - expected : expected - actual;
        require(delta <= maxDelta, "outside max delta");
    }

    function setUp() public {
        factory = new SaveTokenVaultFactory();
        token = new MockToken("Example Token", "EX", 18);
        vault = factory.createVault(IERC20(address(token)));
    }

    function testFactoryCreatesOneCanonicalVaultPerAsset() public {
        assertEq(factory.vaultForAsset(address(token)), address(vault));
        assertEq(factory.allVaults(0), address(vault));
        assertEq(factory.allVaultsLength(), 1);

        VM.expectRevert(
            abi.encodeWithSelector(
                SaveTokenVaultFactory.VaultAlreadyExists.selector, address(token), address(vault)
            )
        );
        factory.createVault(IERC20(address(token)));
    }

    function testDepositorClaimRisesWhenKeeperTransfersYield() public {
        token.mint(alice, 100 ether);
        token.mint(keeper, 20 ether);

        VM.startPrank(alice);
        token.approve(address(vault), 100 ether);
        uint256 aliceShares = vault.deposit(100 ether, alice);
        VM.stopPrank();

        assertEq(vault.balanceOf(alice), aliceShares);
        assertEq(vault.totalAssets(), 100 ether);

        VM.prank(keeper);
        require(token.transfer(address(vault), 20 ether), "yield transfer failed");

        assertApproxEqAbs(vault.convertToAssets(aliceShares), 120 ether, 1);

        VM.prank(alice);
        uint256 assetsOut = vault.redeem(aliceShares, alice, alice);

        assertApproxEqAbs(assetsOut, 120 ether, 1);
        assertApproxEqAbs(token.balanceOf(alice), 120 ether, 1);
    }

    function testReceiptTokenCanBeTransferredAndRedeemedByHolder() public {
        token.mint(alice, 100 ether);
        token.mint(keeper, 10 ether);

        VM.startPrank(alice);
        token.approve(address(vault), 100 ether);
        uint256 shares = vault.deposit(100 ether, alice);
        require(vault.transfer(bob, shares), "share transfer failed");
        VM.stopPrank();

        VM.prank(keeper);
        require(token.transfer(address(vault), 10 ether), "yield transfer failed");

        VM.prank(bob);
        uint256 assetsOut = vault.redeem(shares, bob, bob);

        assertEq(vault.balanceOf(alice), 0);
        assertEq(vault.balanceOf(bob), 0);
        assertApproxEqAbs(assetsOut, 110 ether, 1);
        assertApproxEqAbs(token.balanceOf(bob), 110 ether, 1);
    }

    function testFeeOnTransferDepositIsRejected() public {
        FeeToken feeToken = new FeeToken(feeSink);
        SaveTokenVault feeVault = factory.createVault(IERC20(address(feeToken)));

        feeToken.mint(alice, 100 ether);
        feeToken.setFeeBps(100);

        VM.startPrank(alice);
        feeToken.approve(address(feeVault), 100 ether);
        VM.expectRevert(
            abi.encodeWithSelector(
                SaveTokenVault.FeeOnTransferToken.selector,
                address(feeToken),
                100 ether,
                99 ether
            )
        );
        feeVault.deposit(100 ether, alice);
        VM.stopPrank();
    }

    function testFeeOnTransferWithdrawIsRejected() public {
        FeeToken feeToken = new FeeToken(feeSink);
        SaveTokenVault feeVault = factory.createVault(IERC20(address(feeToken)));

        feeToken.mint(alice, 100 ether);

        VM.startPrank(alice);
        feeToken.approve(address(feeVault), 100 ether);
        uint256 shares = feeVault.deposit(100 ether, alice);
        feeToken.setFeeBps(100);
        VM.expectRevert(
            abi.encodeWithSelector(
                SaveTokenVault.FeeOnTransferToken.selector,
                address(feeToken),
                100 ether,
                99 ether
            )
        );
        feeVault.redeem(shares, alice, alice);
        VM.stopPrank();
    }

    function testDonationBeforeFirstDepositStillMintsSharesForNormalDeposit() public {
        token.mint(keeper, 1 ether);
        token.mint(alice, 1 ether);

        VM.prank(keeper);
        require(token.transfer(address(vault), 1 ether), "donation transfer failed");

        VM.startPrank(alice);
        token.approve(address(vault), 1 ether);
        uint256 shares = vault.deposit(1 ether, alice);
        VM.stopPrank();

        assertGt(shares, 0);
        assertApproxEqAbs(vault.convertToAssets(shares), 1 ether, 1e12);
    }
}
