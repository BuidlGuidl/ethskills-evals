// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {BaseUsdcYieldVault} from "../src/BaseUsdcYieldVault.sol";
import {AerodromeUsdcWethStrategy} from "../src/strategies/AerodromeUsdcWethStrategy.sol";
import {IAerodromePool} from "../src/interfaces/IAerodrome.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockAerodromeGauge} from "./mocks/MockAerodromeGauge.sol";
import {MockAerodromePool} from "./mocks/MockAerodromePool.sol";
import {MockAerodromeRouter} from "./mocks/MockAerodromeRouter.sol";

interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert(bytes4 selector) external;
}

contract BaseUsdcYieldVaultTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant OWNER = address(0xA11CE);
    address internal constant KEEPER = address(0xB0B);
    address internal constant USER = address(0xCAFE);
    address internal constant FACTORY = address(0xFAc70);

    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockERC20 internal aero;
    MockAerodromePool internal pool;
    MockAerodromeRouter internal router;
    MockAerodromeGauge internal gauge;
    BaseUsdcYieldVault internal vault;
    AerodromeUsdcWethStrategy internal strategy;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        aero = new MockERC20("Aerodrome", "AERO", 18);

        pool = new MockAerodromePool(address(usdc), address(weth));
        router = new MockAerodromeRouter(pool);
        pool.setRouter(address(router));
        gauge = new MockAerodromeGauge(pool, aero);

        router.setRate(address(usdc), address(weth), 1e18, 2_000e6);
        router.setRate(address(weth), address(usdc), 2_000e6, 1e18);
        router.setRate(address(aero), address(weth), 1e18, 1_000e18);

        vault = new BaseUsdcYieldVault(usdc, OWNER);
        strategy = new AerodromeUsdcWethStrategy(
            address(vault),
            usdc,
            weth,
            aero,
            router,
            gauge,
            IAerodromePool(address(pool)),
            FACTORY,
            OWNER,
            KEEPER
        );

        vm.prank(OWNER);
        vault.setStrategy(strategy);

        usdc.mint(USER, 100_000e6);
        vm.prank(USER);
        usdc.approve(address(vault), type(uint256).max);
    }

    function testDepositPairsUsdcWithWethAndStakesLp() public {
        vm.prank(USER);
        uint256 shares = vault.deposit(10_000e6, USER);

        _assertEq(shares, 10_000e6, "shares");
        _assertEq(vault.balanceOf(USER), 10_000e6, "user shares");
        _assertEq(usdc.balanceOf(address(vault)), 0, "vault idle usdc");
        _assertEq(gauge.balanceOf(address(strategy)), 10_000e6, "staked lp");
        _assertEq(vault.totalAssets(), 10_000e6, "total assets");
    }

    function testKeeperHarvestClaimsRewardsAndCompounds() public {
        vm.prank(USER);
        vault.deposit(10_000e6, USER);
        gauge.fund(100e18);

        vm.prank(KEEPER);
        uint256 liquidity = strategy.harvest();

        _assertEq(liquidity, 200e6, "liquidity minted from rewards");
        _assertEq(gauge.balanceOf(address(strategy)), 10_200e6, "staked lp after harvest");
        _assertEq(vault.totalAssets(), 10_200e6, "harvested total assets");
        _assertEq(aero.balanceOf(address(strategy)), 0, "aero compounded");
    }

    function testWithdrawUnwindsLiquidityAndReturnsUsdc() public {
        vm.prank(USER);
        vault.deposit(10_000e6, USER);

        vm.prank(USER);
        uint256 burnedShares = vault.withdraw(1_000e6, USER, USER);

        _assertEq(burnedShares, 1_000e6, "burned shares");
        _assertEq(usdc.balanceOf(USER), 91_000e6, "user usdc");
        _assertEq(vault.balanceOf(USER), 9_000e6, "remaining shares");
        _assertEq(gauge.balanceOf(address(strategy)), 9_000e6, "remaining lp");
        _assertEq(vault.totalAssets(), 9_000e6, "remaining total assets");
    }

    function testRedeemAfterHarvestIncludesYield() public {
        vm.prank(USER);
        vault.deposit(10_000e6, USER);
        gauge.fund(100e18);

        vm.prank(KEEPER);
        strategy.harvest();

        uint256 shares = vault.balanceOf(USER);
        vm.prank(USER);
        uint256 assets = vault.redeem(shares, USER, USER);

        _assertEq(assets, 10_200e6, "redeemed assets");
        _assertEq(usdc.balanceOf(USER), 100_200e6, "user usdc");
        _assertEq(vault.totalSupply(), 0, "supply");
        _assertEq(gauge.balanceOf(address(strategy)), 0, "lp fully withdrawn");
    }

    function testOnlyKeeperOrOwnerCanHarvest() public {
        vm.prank(USER);
        vault.deposit(10_000e6, USER);

        vm.expectRevert(AerodromeUsdcWethStrategy.NotKeeper.selector);
        vm.prank(USER);
        strategy.harvest();
    }

    function _assertEq(uint256 actual, uint256 expected, string memory label) internal pure {
        require(actual == expected, label);
    }
}
