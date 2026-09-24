// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseUsdcVault} from "../src/BaseUsdcVault.sol";
import {UniswapV3UsdcWethStrategy} from "../src/UniswapV3UsdcWethStrategy.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IStrategy} from "../src/interfaces/IStrategy.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";
import {MockNonfungiblePositionManager} from "./mocks/MockNonfungiblePositionManager.sol";
import {MockPositionValueOracle} from "./mocks/MockPositionValueOracle.sol";

interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert(bytes calldata revertData) external;
}

contract Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 actual, uint256 expected) internal pure {
        require(actual == expected, "assertEq(uint256)");
    }

    function assertEq(address actual, address expected) internal pure {
        require(actual == expected, "assertEq(address)");
    }

    function assertGt(uint256 actual, uint256 expected) internal pure {
        require(actual > expected, "assertGt(uint256)");
    }
}

contract BaseUsdcVaultTest is Test {
    address internal owner = address(0xA11CE);
    address internal keeper = address(0xB0B);
    address internal user = address(0xCAFE);

    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockSwapRouter internal router;
    MockNonfungiblePositionManager internal positionManager;
    MockPositionValueOracle internal oracle;
    BaseUsdcVault internal vault;
    UniswapV3UsdcWethStrategy internal strategy;

    function setUp() external {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        router = new MockSwapRouter();
        positionManager = new MockNonfungiblePositionManager();
        oracle = new MockPositionValueOracle(positionManager);

        router.setRate(address(usdc), address(weth), 1e18);
        router.setRate(address(weth), address(usdc), 1e18);

        vault = new BaseUsdcVault(IERC20(address(usdc)), owner);
        strategy = new UniswapV3UsdcWethStrategy(
            address(vault),
            IERC20(address(usdc)),
            IERC20(address(weth)),
            router,
            positionManager,
            oracle,
            500,
            -887_220,
            887_220,
            owner
        );

        vm.startPrank(owner);
        vault.setStrategy(IStrategy(address(strategy)));
        strategy.setKeeper(keeper, true);
        vm.stopPrank();

        usdc.mint(user, 2_000e6);
    }

    function testDepositMintsSharesAndFundsStrategy() external {
        vm.startPrank(user);
        usdc.approve(address(vault), 1_000e6);
        uint256 shares = vault.deposit(1_000e6, user);
        vm.stopPrank();

        assertEq(shares, 1_000e6);
        assertEq(vault.balanceOf(user), 1_000e6);
        assertEq(usdc.balanceOf(address(strategy)), 1_000e6);
        assertEq(vault.totalAssets(), 1_000e6);
    }

    function testKeeperHarvestCreatesAndCompoundsLiquidity() external {
        _deposit(1_000e6);

        vm.prank(keeper);
        uint128 liquidity = strategy.harvest(
            UniswapV3UsdcWethStrategy.HarvestParams({
                minWethOut: 500e6, amount0Min: 0, amount1Min: 0, minLiquidity: 1_000e6, deadline: block.timestamp
            })
        );

        assertEq(uint256(liquidity), 1_000e6);
        assertEq(strategy.tokenId(), 1);
        assertEq(vault.totalAssets(), 1_000e6);

        uint256 tokenId = strategy.tokenId();
        positionManager.addFees(tokenId, 40e6, 60e6);
        assertEq(vault.totalAssets(), 1_100e6);

        vm.prank(keeper);
        uint128 added = strategy.harvest(
            UniswapV3UsdcWethStrategy.HarvestParams({
                minWethOut: 30e6, amount0Min: 0, amount1Min: 0, minLiquidity: 100e6, deadline: block.timestamp
            })
        );

        assertEq(uint256(added), 100e6);
        assertEq(vault.totalAssets(), 1_100e6);
    }

    function testRedeemAfterYieldReturnsProRataAssets() external {
        _deposit(1_000e6);

        vm.prank(keeper);
        strategy.harvest(
            UniswapV3UsdcWethStrategy.HarvestParams({
                minWethOut: 0, amount0Min: 0, amount1Min: 0, minLiquidity: 0, deadline: block.timestamp
            })
        );

        positionManager.addFees(strategy.tokenId(), 50e6, 50e6);

        vm.startPrank(user);
        uint256 assets = vault.redeem(500e6, user, user);
        vm.stopPrank();

        assertEq(assets, 550e6);
        assertEq(usdc.balanceOf(user), 1_550e6);
        assertEq(vault.balanceOf(user), 500e6);
        assertEq(vault.totalAssets(), 550e6);
    }

    function testOnlyKeeperCanHarvest() external {
        _deposit(1_000e6);

        vm.expectRevert(bytes("ONLY_KEEPER"));
        vm.prank(user);
        strategy.harvest(
            UniswapV3UsdcWethStrategy.HarvestParams({
                minWethOut: 0, amount0Min: 0, amount1Min: 0, minLiquidity: 0, deadline: block.timestamp
            })
        );
    }

    function _deposit(uint256 amount) internal {
        vm.startPrank(user);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, user);
        vm.stopPrank();
    }
}
