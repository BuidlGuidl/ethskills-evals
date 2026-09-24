// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IAerodromeGauge, IAerodromePool, IAerodromeRouter } from "./interfaces/IAerodrome.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { Owned } from "./utils/Owned.sol";
import { SafeTransferLib } from "./utils/SafeTransferLib.sol";

contract AerodromeUsdcWethStrategy is Owned {
    using SafeTransferLib for IERC20;

    struct DepositParams {
        uint256 minWethOut;
        uint256 minWethToLp;
        uint256 minUsdcToLp;
        uint256 minLpOut;
        uint256 deadline;
    }

    struct WithdrawParams {
        uint256 minWethFromLp;
        uint256 minUsdcFromLp;
        uint256 minUsdcFromWeth;
        uint256 deadline;
    }

    struct HarvestParams {
        uint256 minUsdcFromReward;
        uint256 minWethOut;
        uint256 minWethToLp;
        uint256 minUsdcToLp;
        uint256 minLpOut;
        uint256 deadline;
    }

    error BadPool();
    error NotVault();
    error ZeroAmount();

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable rewardToken;
    IAerodromeRouter public immutable router;
    IAerodromePool public immutable pool;
    IAerodromeGauge public immutable gauge;
    address public immutable factory;
    bool public immutable stable;

    address public vault;

    event Deposited(uint256 usdcAmount, uint256 wethAmount, uint256 liquidity);
    event Harvested(uint256 rewardAmount, uint256 liquidity);
    event VaultSet(address indexed vault);
    event Withdrawn(uint256 requestedAssets, uint256 usdcOut);

    constructor(
        IERC20 usdc_,
        IERC20 weth_,
        IERC20 rewardToken_,
        IAerodromeRouter router_,
        IAerodromePool pool_,
        IAerodromeGauge gauge_,
        address factory_,
        bool stable_,
        address owner_
    ) Owned(owner_) {
        usdc = usdc_;
        weth = weth_;
        rewardToken = rewardToken_;
        router = router_;
        pool = pool_;
        gauge = gauge_;
        factory = factory_;
        stable = stable_;

        if (
            pool_.token0() != address(weth_) || pool_.token1() != address(usdc_)
                || pool_.stable() != stable_
        ) {
            revert BadPool();
        }

        usdc_.forceApprove(address(router_), type(uint256).max);
        weth_.forceApprove(address(router_), type(uint256).max);
        rewardToken_.forceApprove(address(router_), type(uint256).max);
        IERC20(address(pool_)).forceApprove(address(router_), type(uint256).max);
        IERC20(address(pool_)).forceApprove(address(gauge_), type(uint256).max);
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    function setVault(address vault_) external onlyOwner {
        if (vault != address(0)) revert NotVault();
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
        emit VaultSet(vault_);
    }

    function totalAssets() public view returns (uint256) {
        (uint256 wethReserve, uint256 usdcReserve,) = pool.getReserves();
        uint256 value = usdc.balanceOf(address(this));

        if (wethReserve != 0) {
            value += weth.balanceOf(address(this)) * usdcReserve / wethReserve;
        }

        uint256 lpSupply = pool.totalSupply();
        if (lpSupply != 0) {
            uint256 lpBalance = pool.balanceOf(address(this)) + gauge.balanceOf(address(this));
            value += lpBalance * (2 * usdcReserve) / lpSupply;
        }

        return value;
    }

    function deposit(uint256 usdcAmount, DepositParams calldata params)
        external
        onlyVault
        returns (uint256 liquidity)
    {
        if (usdcAmount == 0) revert ZeroAmount();

        uint256 wethBefore = weth.balanceOf(address(this));
        uint256 swapAmount = usdcAmount / 2;
        if (swapAmount != 0) {
            _swap(address(usdc), address(weth), swapAmount, params.minWethOut, params.deadline);
        }
        uint256 wethReceived = weth.balanceOf(address(this)) - wethBefore;
        liquidity =
            _addAndStake(params.minWethToLp, params.minUsdcToLp, params.minLpOut, params.deadline);

        emit Deposited(usdcAmount - swapAmount, wethReceived, liquidity);
    }

    function withdraw(uint256 assets, address receiver, WithdrawParams calldata params)
        external
        onlyVault
        returns (uint256 usdcOut)
    {
        if (assets == 0) revert ZeroAmount();

        uint256 currentUsdc = usdc.balanceOf(address(this));
        if (currentUsdc < assets) {
            _freeLpForUsdc(assets - currentUsdc, params);
        }

        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance != 0) {
            _swap(
                address(weth), address(usdc), wethBalance, params.minUsdcFromWeth, params.deadline
            );
        }

        usdcOut = assets;
        uint256 available = usdc.balanceOf(address(this));
        if (available < usdcOut) usdcOut = available;
        usdc.safeTransfer(receiver, usdcOut);

        emit Withdrawn(assets, usdcOut);
    }

    function harvest(HarvestParams calldata params)
        external
        onlyVault
        returns (uint256 rewardAmount, uint256 liquidity)
    {
        uint256 rewardBefore = rewardToken.balanceOf(address(this));
        gauge.getReward(address(this));
        rewardAmount = rewardToken.balanceOf(address(this)) - rewardBefore;

        if (rewardAmount != 0 && address(rewardToken) != address(usdc)) {
            _swap(
                address(rewardToken),
                address(usdc),
                rewardAmount,
                params.minUsdcFromReward,
                params.deadline
            );
        }

        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 swapAmount = usdcBalance / 2;
        if (swapAmount != 0) {
            _swap(address(usdc), address(weth), swapAmount, params.minWethOut, params.deadline);
        }

        liquidity =
            _addAndStake(params.minWethToLp, params.minUsdcToLp, params.minLpOut, params.deadline);
        emit Harvested(rewardAmount, liquidity);
    }

    function _freeLpForUsdc(uint256 usdcNeeded, WithdrawParams calldata params) internal {
        (uint256 wethReserve, uint256 usdcReserve,) = pool.getReserves();
        uint256 lpSupply = pool.totalSupply();
        uint256 lpBalance = pool.balanceOf(address(this)) + gauge.balanceOf(address(this));
        uint256 denominator = 2 * usdcReserve;
        uint256 lpNeeded =
            denominator == 0 ? lpBalance : (usdcNeeded * lpSupply + denominator - 1) / denominator;
        if (lpNeeded > lpBalance) lpNeeded = lpBalance;

        uint256 staked = gauge.balanceOf(address(this));
        if (lpNeeded > pool.balanceOf(address(this))) {
            uint256 fromGauge = lpNeeded - pool.balanceOf(address(this));
            if (fromGauge > staked) fromGauge = staked;
            gauge.withdraw(fromGauge);
        }

        router.removeLiquidity(
            address(weth),
            address(usdc),
            stable,
            lpNeeded,
            params.minWethFromLp,
            params.minUsdcFromLp,
            address(this),
            params.deadline
        );

        wethReserve;
    }

    function _addAndStake(uint256 minWeth, uint256 minUsdc, uint256 minLp, uint256 deadline)
        internal
        returns (uint256 liquidity)
    {
        uint256 wethAmount = weth.balanceOf(address(this));
        uint256 usdcAmount = usdc.balanceOf(address(this));
        if (wethAmount == 0 || usdcAmount == 0) return 0;

        (,, liquidity) = router.addLiquidity(
            address(weth),
            address(usdc),
            stable,
            wethAmount,
            usdcAmount,
            minWeth,
            minUsdc,
            address(this),
            deadline
        );
        if (liquidity < minLp) revert BadPool();
        if (liquidity != 0) gauge.deposit(liquidity);
    }

    function _swap(address from, address to, uint256 amount, uint256 minOut, uint256 deadline)
        internal
        returns (uint256 out)
    {
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({ from: from, to: to, stable: false, factory: factory });
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amount, minOut, routes, address(this), deadline);
        out = amounts[amounts.length - 1];
    }
}
