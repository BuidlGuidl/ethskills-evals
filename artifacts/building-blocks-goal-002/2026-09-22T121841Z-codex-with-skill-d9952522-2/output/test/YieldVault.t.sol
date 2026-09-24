// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {YieldVault} from "../src/YieldVault.sol";
import {UniswapV3CompoundStrategy} from "../src/UniswapV3CompoundStrategy.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";
import {MockNonfungiblePositionManager} from "./mocks/MockNonfungiblePositionManager.sol";

contract YieldVaultTest {
    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockSwapRouter internal router;
    MockNonfungiblePositionManager internal positionManager;
    YieldVault internal vault;
    UniswapV3CompoundStrategy internal strategy;
    address internal keeper = address(0xBEEF);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        router = new MockSwapRouter();
        positionManager = new MockNonfungiblePositionManager();
        vault = new YieldVault(address(usdc), "Base USDC LP Vault", "bUSDC-LP");
        strategy = new UniswapV3CompoundStrategy(
            UniswapV3CompoundStrategy.StrategyParams({
                vault: address(vault),
                asset: address(usdc),
                weth: address(weth),
                swapRouter: address(router),
                positionManager: address(positionManager),
                poolFee: 500,
                tickLower: -887220,
                tickUpper: 887220,
                keeper: keeper
            })
        );
        vault.setStrategy(address(strategy));
    }

    function testDepositPairsUsdcWithWethLiquidity() public {
        uint256 assets = 1_000e6;
        usdc.mint(address(this), assets);
        usdc.approve(address(vault), assets);

        uint256 shares = vault.deposit(assets, address(this), 1, 1);

        assertEq(shares, assets, "shares");
        assertEq(vault.balanceOf(address(this)), assets, "vault shares");
        assertEq(vault.totalDebt(), assets, "debt");
        assertTrue(strategy.tokenId() != 0, "token id");
        assertTrue(strategy.positionLiquidity() > 0, "liquidity");
        assertEq(usdc.balanceOf(address(vault)), 0, "vault idle usdc");
    }

    function testKeeperHarvestCollectsAndCompoundsFees() public {
        _deposit(1_000e6);
        uint128 beforeLiquidity = strategy.positionLiquidity();
        uint256 tokenId = strategy.tokenId();
        (address token0,) = _tokens();

        if (token0 == address(weth)) {
            positionManager.accrueFees(tokenId, 3e6, 7e6);
        } else {
            positionManager.accrueFees(tokenId, 7e6, 3e6);
        }

        KeeperCaller caller = new KeeperCaller(strategy);
        strategy.setKeeper(address(caller));
        caller.harvest(1);

        assertTrue(strategy.positionLiquidity() > beforeLiquidity, "compounded liquidity");
        assertEq(usdc.balanceOf(address(strategy)), 0, "usdc compounded");
        assertEq(weth.balanceOf(address(strategy)), 0, "weth compounded");
    }

    function testOnlyKeeperOrOwnerCanHarvest() public {
        _deposit(1_000e6);

        UnauthorizedHarvestCaller attacker = new UnauthorizedHarvestCaller(strategy);
        try attacker.harvest() {
            revert("harvest should fail");
        } catch {}
    }

    function testRedeemUnwindsPositionAndReturnsUsdc() public {
        uint256 assets = 1_000e6;
        _deposit(assets);

        uint256 balanceBefore = usdc.balanceOf(address(this));
        uint256 shares = vault.balanceOf(address(this));
        uint256 assetsOut = vault.redeem(shares, address(this), address(this), 1);

        assertTrue(assetsOut > 0, "assets out");
        assertEq(vault.balanceOf(address(this)), 0, "shares burned");
        assertEq(vault.totalSupply(), 0, "total supply");
        assertEq(vault.totalDebt(), 0, "debt cleared");
        assertEq(usdc.balanceOf(address(this)), balanceBefore + assetsOut, "receiver paid");
    }

    function _deposit(uint256 assets) internal {
        usdc.mint(address(this), assets);
        usdc.approve(address(vault), assets);
        vault.deposit(assets, address(this), 1, 1);
    }

    function _tokens() internal view returns (address token0, address token1) {
        token0 = strategy.token0();
        token1 = strategy.token1();
    }

    function assertEq(uint256 actual, uint256 expected, string memory label) internal pure {
        require(actual == expected, label);
    }

    function assertEq(address actual, address expected, string memory label) internal pure {
        require(actual == expected, label);
    }

    function assertTrue(bool condition, string memory label) internal pure {
        require(condition, label);
    }
}

contract KeeperCaller {
    UniswapV3CompoundStrategy internal strategy;

    constructor(UniswapV3CompoundStrategy strategy_) {
        strategy = strategy_;
    }

    function harvest(uint256 minLiquidity) external {
        strategy.harvest(minLiquidity);
    }
}

contract UnauthorizedHarvestCaller {
    UniswapV3CompoundStrategy internal strategy;

    constructor(UniswapV3CompoundStrategy strategy_) {
        strategy = strategy_;
    }

    function harvest() external {
        strategy.harvest(0);
    }
}
