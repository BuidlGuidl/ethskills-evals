// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseUsdcYieldVault} from "../src/BaseUsdcYieldVault.sol";
import {BaseAerodromeStrategy} from "../src/BaseAerodromeStrategy.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockAerodromePool} from "../src/mocks/MockAerodromePool.sol";
import {MockAerodromeGauge} from "../src/mocks/MockAerodromeGauge.sol";
import {MockAerodromeRouter} from "../src/mocks/MockAerodromeRouter.sol";
import {IAerodromePool} from "../src/interfaces/IAerodromePool.sol";
import {IAerodromeGauge} from "../src/interfaces/IAerodromeGauge.sol";

contract HarvestCaller {
    function callHarvest(BaseUsdcYieldVault vault) external {
        vault.harvest(0, 0, 0);
    }
}

contract BaseYieldVaultTest {
    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockERC20 internal aero;
    MockAerodromePool internal pool;
    MockAerodromeRouter internal router;
    MockAerodromeGauge internal gauge;
    BaseUsdcYieldVault internal vault;
    BaseAerodromeStrategy internal strategy;

    address internal constant FACTORY = address(0xFACADE);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        aero = new MockERC20("Aero", "AERO", 18);

        pool = new MockAerodromePool(address(usdc), address(weth));
        router = new MockAerodromeRouter(pool);
        pool.setRouter(address(router));
        gauge = new MockAerodromeGauge(pool, aero);

        router.setRate(address(usdc), address(weth), 5e26);
        router.setRate(address(weth), address(usdc), 2e9);
        router.setRate(address(aero), address(usdc), 1e6);

        vault = new BaseUsdcYieldVault(usdc, "Base USDC Yield Vault", "bUSDCY", address(this));
        strategy = new BaseAerodromeStrategy(
            address(vault),
            usdc,
            weth,
            aero,
            router,
            IAerodromePool(address(pool)),
            IAerodromeGauge(address(gauge)),
            FACTORY,
            false,
            false,
            address(this)
        );
        vault.setStrategy(strategy);
        vault.setKeeper(address(this), true);

        usdc.mint(address(this), 10_000e6);
        usdc.approve(address(vault), type(uint256).max);
    }

    function testDepositInvestsIntoAerodromeGauge() public {
        setUp();

        uint256 shares = vault.deposit(1_000e6, address(this));

        assertEq(shares, 1_000e6, "initial shares");
        assertEq(vault.balanceOf(address(this)), 1_000e6, "share balance");
        assertEq(usdc.balanceOf(address(vault)), 0, "vault idle");
        assertGt(gauge.balanceOf(address(strategy)), 0, "staked lp");
        assertEqApprox(vault.totalAssets(), 1_000e6, 1, "total assets");
    }

    function testWithdrawFreesLiquidityAndReturnsUsdc() public {
        setUp();
        vault.deposit(1_000e6, address(this));

        uint256 beforeBalance = usdc.balanceOf(address(this));
        uint256 sharesBurned = vault.withdraw(200e6, address(this), address(this));

        assertGt(sharesBurned, 0, "shares burned");
        assertEq(usdc.balanceOf(address(this)) - beforeBalance, 200e6, "usdc returned");
        assertEq(vault.totalSupply(), 800e6, "share supply");
        assertEqApprox(vault.totalAssets(), 800e6, 2, "remaining assets");
    }

    function testKeeperHarvestClaimsAndCompoundsRewards() public {
        setUp();
        vault.deposit(1_000e6, address(this));
        uint256 lpBefore = gauge.balanceOf(address(strategy));

        aero.mint(address(this), 10e18);
        aero.approve(address(gauge), 10e18);
        gauge.notifyReward(address(strategy), 10e18);

        uint256 compounded = vault.harvest(10e6, 0, 0);

        assertEq(compounded, 10e6, "compounded assets");
        assertGt(gauge.balanceOf(address(strategy)), lpBefore, "more lp");
        assertEqApprox(vault.totalAssets(), 1_010e6, 2, "yield reflected");
    }

    function testOnlyKeeperCanHarvest() public {
        setUp();

        HarvestCaller caller = new HarvestCaller();
        try caller.callHarvest(vault) {
            revert("harvest should fail");
        } catch {}
    }

    function testRedeemBurnsSharesForAssets() public {
        setUp();
        vault.deposit(1_000e6, address(this));

        uint256 beforeBalance = usdc.balanceOf(address(this));
        uint256 assets = vault.redeem(100e6, address(this), address(this));

        assertEq(assets, 100e6, "redeem assets");
        assertEq(usdc.balanceOf(address(this)) - beforeBalance, 100e6, "usdc returned");
        assertEq(vault.balanceOf(address(this)), 900e6, "shares left");
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) internal pure {
        require(actual == expected, message);
    }

    function assertGt(uint256 actual, uint256 floor, string memory message) internal pure {
        require(actual > floor, message);
    }

    function assertEqApprox(uint256 actual, uint256 expected, uint256 tolerance, string memory message) internal pure {
        if (actual > expected) {
            require(actual - expected <= tolerance, message);
        } else {
            require(expected - actual <= tolerance, message);
        }
    }
}
