// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IYieldStrategy, YieldVault } from "../src/YieldVault.sol";
import { UniswapV3UsdcWethStrategy } from "../src/UniswapV3UsdcWethStrategy.sol";
import { IERC20 } from "../src/interfaces/IERC20.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockSwapRouter } from "./mocks/MockSwapRouter.sol";
import { MockNonfungiblePositionManager } from "./mocks/MockNonfungiblePositionManager.sol";

interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert(bytes4 selector) external;
}

contract YieldVaultTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockERC20 private usdc;
    MockERC20 private weth;
    MockSwapRouter private router;
    MockNonfungiblePositionManager private positionManager;
    YieldVault private vault;
    UniswapV3UsdcWethStrategy private strategy;

    address private owner = address(0xA11CE);
    address private keeper = address(0xB0B);
    address private alice = address(0xCAFE);
    address private bob = address(0xBEEF);

    uint256 private constant WETH_PER_USDC = 5e14;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        router = new MockSwapRouter(address(usdc), address(weth), WETH_PER_USDC);
        positionManager = new MockNonfungiblePositionManager();

        vault =
            new YieldVault(IERC20(address(usdc)), "Base USDC/WETH Yield Vault", "byvUSDC", owner);
        strategy = new UniswapV3UsdcWethStrategy(
            IERC20(address(usdc)),
            IERC20(address(weth)),
            router,
            positionManager,
            address(vault),
            keeper,
            owner,
            500,
            -887270,
            887270
        );

        vm.prank(owner);
        vault.setStrategy(IYieldStrategy(address(strategy)));

        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);
    }

    function testDepositMintsSharesAndAccountsAssets() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 1_000e6);
        uint256 shares = vault.deposit(1_000e6, alice);
        vm.stopPrank();

        assertEq(shares, 1_000e6, "initial shares");
        assertEq(vault.balanceOf(alice), 1_000e6, "share balance");
        assertEq(vault.totalAssets(), 1_000e6, "vault assets");
        assertEq(usdc.balanceOf(address(strategy)), 1_000e6, "strategy idle usdc");
    }

    function testKeeperHarvestPairsUsdcWithWethAndMintsPosition() public {
        _deposit(alice, 1_000e6);

        vm.prank(keeper);
        strategy.harvest(0.24 ether, 0, 499e6, 0.24 ether, block.timestamp + 1);

        uint256 tokenId = strategy.tokenId();
        assertTrue(tokenId != 0, "token id");
        assertTrue(strategy.liquidity() != 0, "liquidity");
        assertEq(usdc.balanceOf(address(strategy)), 0, "no idle usdc");
        assertEq(weth.balanceOf(address(strategy)), 0, "no idle weth");
        assertEq(vault.totalAssets(), 1_000e6, "cost basis unchanged before fees");
    }

    function testHarvestCollectsFeesAndCompoundsThem() public {
        _deposit(alice, 1_000e6);

        vm.prank(keeper);
        strategy.harvest(0.24 ether, 0, 499e6, 0.24 ether, block.timestamp + 1);

        uint256 tokenId = strategy.tokenId();
        positionManager.accrueFees(tokenId, 20e6, 0.01 ether);

        vm.prank(keeper);
        strategy.harvest(0, 19e6, 0, 0, block.timestamp + 1);

        assertEq(vault.totalAssets(), 1_040e6, "realized fees added to assets");
        assertTrue(strategy.liquidity() > 0, "liquidity still present");
    }

    function testRedeemBurnsSharesAndReturnsUsdc() public {
        _deposit(alice, 1_000e6);

        vm.prank(keeper);
        strategy.harvest(0, 0, 0, 0, block.timestamp + 1);

        vm.prank(alice);
        uint256 assets = vault.redeem(250e6, alice, alice, 124e6, block.timestamp + 1);

        assertEq(assets, 250e6, "redeemed assets");
        assertEq(vault.balanceOf(alice), 750e6, "remaining shares");
        assertEq(usdc.balanceOf(alice), 9_250e6, "alice usdc");
        assertEq(vault.totalAssets(), 750e6, "remaining assets");
    }

    function testOnlyKeeperOrOwnerCanHarvest() public {
        _deposit(alice, 1_000e6);

        vm.prank(bob);
        vm.expectRevert(UniswapV3UsdcWethStrategy.NotKeeperOrOwner.selector);
        strategy.harvest(0, 0, 0, 0, block.timestamp + 1);
    }

    function _deposit(address user, uint256 amount) private {
        vm.startPrank(user);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, user);
        vm.stopPrank();
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function assertTrue(bool condition, string memory message) private pure {
        require(condition, message);
    }
}
