// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseAerodromeStrategy} from "../src/BaseAerodromeStrategy.sol";
import {BaseUsdcYieldVault} from "../src/BaseUsdcYieldVault.sol";
import {IAerodromeGauge, IAerodromePair} from "../src/interfaces/IAerodrome.sol";
import {MockAerodromeGauge} from "./mocks/MockAerodromeGauge.sol";
import {MockAerodromePair} from "./mocks/MockAerodromePair.sol";
import {MockAerodromeRouter} from "./mocks/MockAerodromeRouter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert(bytes4) external;
}

contract BaseUsdcYieldVaultTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockERC20 private usdc;
    MockERC20 private weth;
    MockERC20 private aero;
    MockAerodromePair private pair;
    MockAerodromeRouter private router;
    MockAerodromeGauge private gauge;
    BaseAerodromeStrategy private strategy;
    BaseUsdcYieldVault private vault;

    address private constant OWNER = address(0xA11CE);
    address private constant KEEPER = address(0xB0B);
    address private constant USER = address(0xCAFE);
    address private constant FACTORY = address(0xFACADE);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        aero = new MockERC20("Aerodrome", "AERO", 18);
        pair = new MockAerodromePair(address(usdc), address(weth));
        router = new MockAerodromeRouter(usdc, weth, aero, pair);
        gauge = new MockAerodromeGauge(pair, aero);

        strategy = new BaseAerodromeStrategy(
            usdc,
            weth,
            aero,
            router,
            IAerodromePair(address(pair)),
            IAerodromeGauge(address(gauge)),
            FACTORY,
            false,
            OWNER,
            KEEPER
        );
        vault = new BaseUsdcYieldVault(usdc, strategy, OWNER);

        vm.prank(OWNER);
        strategy.setVault(address(vault));

        usdc.mint(USER, 10_000e6);
        vm.prank(USER);
        usdc.approve(address(vault), type(uint256).max);
    }

    function testDepositPairsUsdcWithWethAndStakesLp() public {
        vm.prank(USER);
        uint256 shares = vault.deposit(1_000e6, USER);

        require(shares == 1_000e6, "wrong shares");
        require(vault.balanceOf(USER) == 1_000e6, "shares not minted");
        require(gauge.balanceOf(address(strategy)) == 1_000e6, "lp not staked");
        require(vault.totalAssets() == 1_000e6, "assets not tracked");
        require(usdc.balanceOf(address(vault)) == 0, "vault idle usdc");
    }

    function testKeeperHarvestClaimsRewardsAndCompounds() public {
        vm.prank(USER);
        vault.deposit(1_000e6, USER);

        gauge.setRewardPerHarvest(100e18);
        uint256 assetsBefore = vault.totalAssets();
        uint256 lpBefore = gauge.balanceOf(address(strategy));

        vm.prank(KEEPER);
        strategy.harvest();

        require(vault.totalAssets() == assetsBefore + 100e6, "yield not added");
        require(gauge.balanceOf(address(strategy)) == lpBefore + 100e6, "yield not compounded");
        require(vault.balanceOf(USER) == 1_000e6, "shares changed");
        require(vault.convertToAssets(1_000e6) == 1_100e6, "share price did not rise");
    }

    function testOnlyKeeperOrOwnerCanHarvest() public {
        vm.expectRevert(BaseAerodromeStrategy.Unauthorized.selector);
        vm.prank(USER);
        strategy.harvest();
    }

    function testWithdrawBurnsSharesAndReturnsUsdc() public {
        vm.prank(USER);
        vault.deposit(1_000e6, USER);

        gauge.setRewardPerHarvest(100e18);
        vm.prank(KEEPER);
        strategy.harvest();

        uint256 balanceBefore = usdc.balanceOf(USER);
        vm.prank(USER);
        uint256 sharesBurned = vault.withdraw(440e6, USER, USER);

        require(sharesBurned == 400e6, "wrong shares burned");
        require(usdc.balanceOf(USER) == balanceBefore + 440e6, "usdc not returned");
        require(vault.balanceOf(USER) == 600e6, "shares not burned");
        require(vault.totalAssets() == 660e6, "remaining assets wrong");
    }

    function testRedeemReturnsProRataAssets() public {
        vm.prank(USER);
        vault.deposit(1_000e6, USER);

        gauge.setRewardPerHarvest(50e18);
        vm.prank(KEEPER);
        strategy.harvest();

        uint256 balanceBefore = usdc.balanceOf(USER);
        vm.prank(USER);
        uint256 assets = vault.redeem(500e6, USER, USER);

        require(assets == 525e6, "wrong redeem assets");
        require(usdc.balanceOf(USER) == balanceBefore + 525e6, "redeem usdc not returned");
        require(vault.balanceOf(USER) == 500e6, "wrong remaining shares");
    }
}
