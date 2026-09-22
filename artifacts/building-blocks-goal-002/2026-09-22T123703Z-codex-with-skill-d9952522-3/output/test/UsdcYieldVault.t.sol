// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AerodromeUsdcWethStrategy} from "../src/AerodromeUsdcWethStrategy.sol";
import {UsdcYieldVault} from "../src/UsdcYieldVault.sol";
import {MockAerodromeRouter} from "./mocks/MockAerodromeRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockGauge} from "./mocks/MockGauge.sol";

contract RevertingCaller {
    function callHarvest(AerodromeUsdcWethStrategy strategy, AerodromeUsdcWethStrategy.HarvestParams calldata params)
        external
    {
        strategy.harvest(params);
    }
}

contract UsdcYieldVaultTest {
    MockERC20 private usdc;
    MockERC20 private weth;
    MockERC20 private aero;
    MockERC20 private lp;
    MockAerodromeRouter private router;
    MockGauge private gauge;
    AerodromeUsdcWethStrategy private strategy;
    UsdcYieldVault private vault;

    address private constant FACTORY = address(0xFACADE);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        aero = new MockERC20("Aerodrome", "AERO", 18);
        lp = new MockERC20("Aerodrome WETH/USDC", "vAMM-WETH/USDC", 18);
        router = new MockAerodromeRouter(usdc, weth, aero, lp);
        gauge = new MockGauge(lp, aero);

        strategy = new AerodromeUsdcWethStrategy(
            address(usdc),
            address(weth),
            address(aero),
            address(lp),
            address(router),
            address(gauge),
            FACTORY,
            false,
            address(this),
            address(this)
        );
        vault = new UsdcYieldVault(address(usdc), address(strategy));
        strategy.setVault(address(vault));

        usdc.mint(address(this), 10_000e6);
        usdc.approve(address(vault), type(uint256).max);
    }

    function testDepositPairsUsdcWithWethAndStakesLp() public {
        setUp();

        uint256 shares = vault.deposit(
            1_000e6,
            address(this),
            AerodromeUsdcWethStrategy.InvestParams({minWethOut: 0.25e18, minLp: 1_000e6, deadline: block.timestamp})
        );

        _assertEq(shares, 1_000e6, "shares");
        _assertEq(vault.balanceOf(address(this)), shares, "share balance");
        _assertEq(gauge.balanceOf(address(strategy)), 1_000e6, "staked lp");
        _assertEq(usdc.balanceOf(address(strategy)), 0, "idle usdc");
        _assertEq(weth.balanceOf(address(strategy)), 0, "idle weth");
    }

    function testHarvestClaimsAeroCompoundsAndRaisesLpPerShare() public {
        setUp();
        vault.deposit(
            1_000e6,
            address(this),
            AerodromeUsdcWethStrategy.InvestParams({minWethOut: 0, minLp: 0, deadline: block.timestamp})
        );
        uint256 sharesBefore = vault.totalSupply();
        uint256 lpBefore = strategy.totalLp();

        gauge.setPendingReward(address(strategy), 100e18);
        uint256 liquidity = strategy.harvest(
            AerodromeUsdcWethStrategy.HarvestParams({
                minUsdcFromAero: 100e6,
                minWethOut: 0.025e18,
                minLp: 100e6,
                deadline: block.timestamp
            })
        );

        _assertEq(liquidity, 100e6, "harvest lp");
        _assertEq(vault.totalSupply(), sharesBefore, "supply unchanged");
        require(strategy.totalLp() > lpBefore, "LP_NOT_COMPOUNDED");
        _assertEq(aero.balanceOf(address(strategy)), 0, "idle aero");
    }

    function testWithdrawBurnsSharesAndReturnsUsdc() public {
        setUp();
        uint256 shares = vault.deposit(
            1_000e6,
            address(this),
            AerodromeUsdcWethStrategy.InvestParams({minWethOut: 0, minLp: 0, deadline: block.timestamp})
        );
        uint256 usdcBefore = usdc.balanceOf(address(this));

        uint256 assets = vault.withdraw(
            shares,
            address(this),
            AerodromeUsdcWethStrategy.WithdrawParams({
                minWethFromLp: 0.25e18,
                minUsdcFromLp: 500e6,
                minUsdcFromWeth: 500e6,
                deadline: block.timestamp
            })
        );

        _assertEq(assets, 1_000e6, "assets");
        _assertEq(vault.totalSupply(), 0, "supply");
        _assertEq(gauge.balanceOf(address(strategy)), 0, "staked lp");
        _assertEq(usdc.balanceOf(address(this)), usdcBefore + 1_000e6, "receiver usdc");
    }

    function testOnlyKeeperCanHarvest() public {
        setUp();
        RevertingCaller caller = new RevertingCaller();

        bool reverted;
        try caller.callHarvest(
            strategy,
            AerodromeUsdcWethStrategy.HarvestParams({
                minUsdcFromAero: 0,
                minWethOut: 0,
                minLp: 0,
                deadline: block.timestamp
            })
        ) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "NON_KEEPER_HARVESTED");
    }

    function _assertEq(uint256 actual, uint256 expected, string memory label) private pure {
        require(actual == expected, label);
    }
}

