// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {YieldVault} from "../../src/YieldVault.sol";
import {AerodromeUsdcWethStrategy} from "../../src/AerodromeUsdcWethStrategy.sol";
import {IStrategy} from "../../src/interfaces/IStrategy.sol";
import {IAerodromePoolFactory, IAerodromeVoter} from "../../src/interfaces/IAerodrome.sol";
import {BaseAddresses as B} from "../../script/BaseAddresses.sol";

/// @notice Runs against real Aerodrome + Chainlink on a Base fork. Skipped unless BASE_RPC_URL is set.
contract BaseForkTest is Test {
    YieldVault vault;
    AerodromeUsdcWethStrategy strategy;
    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        uint256 forkBlock = vm.envOr("BASE_FORK_BLOCK", uint256(0));
        if (forkBlock == 0) vm.createSelectFork(rpc);
        else vm.createSelectFork(rpc, forkBlock);

        address pool = IAerodromePoolFactory(B.AERO_POOL_FACTORY).getPool(B.WETH, B.USDC, false);
        address gauge = IAerodromeVoter(B.AERO_VOTER).gauges(pool);

        vault = new YieldVault(IERC20(B.USDC), owner, keeper, 1_000_000e6);
        strategy = new AerodromeUsdcWethStrategy(
            AerodromeUsdcWethStrategy.Config({
                vault: address(vault),
                usdc: B.USDC,
                weth: B.WETH,
                aero: B.AERO,
                router: B.AERO_ROUTER,
                poolFactory: B.AERO_POOL_FACTORY,
                pool: pool,
                gauge: gauge,
                ethUsdFeed: B.CHAINLINK_ETH_USD,
                sequencerFeed: B.CHAINLINK_SEQUENCER_UPTIME
            }),
            owner
        );
        vm.prank(owner);
        vault.setStrategy(IStrategy(address(strategy)));

        deal(B.USDC, alice, 10_000e6);
        vm.prank(alice);
        IERC20(B.USDC).approve(address(vault), type(uint256).max);
    }

    function test_fork_depositHarvestCompoundRedeem() public {
        vm.prank(alice);
        vault.deposit(10_000e6, alice);

        vm.prank(keeper);
        vault.harvest(0);
        assertGt(strategy.stakedLiquidity(), 0, "not staked");
        assertApproxEqRel(vault.totalAssets(), 10_000e6, 0.01e18);

        // Let AERO emissions accrue, keep the oracle fresh by mocking its timestamp.
        skip(1 days);
        _freshOracle();
        uint256 pending = strategy.pendingRewards();
        assertGt(pending, 0, "no emissions");

        vm.prank(keeper);
        uint256 profit = vault.harvest(0);
        assertGt(profit, 0, "no profit");

        skip(vault.profitUnlockTime());
        _freshOracle();

        uint256 shares = vault.balanceOf(alice);
        uint256 preview = vault.previewRedeem(shares);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice);
        assertGe(out, preview);
        assertApproxEqRel(out, 10_000e6, 0.01e18);
    }

    /// @dev After warping, the real feed looks stale; re-serve its latest answer with a fresh timestamp.
    function _freshOracle() internal {
        (uint80 id, int256 answer,,, uint80 answeredIn) =
            AerodromeUsdcWethStrategy(address(strategy)).ethUsdFeed().latestRoundData();
        vm.mockCall(
            B.CHAINLINK_ETH_USD,
            abi.encodeWithSignature("latestRoundData()"),
            abi.encode(id, answer, block.timestamp, block.timestamp, answeredIn)
        );
    }
}
