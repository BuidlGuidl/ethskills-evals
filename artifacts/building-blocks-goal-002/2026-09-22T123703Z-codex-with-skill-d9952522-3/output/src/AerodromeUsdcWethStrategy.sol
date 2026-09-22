// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAerodromeRouter} from "./interfaces/IAerodromeRouter.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IGauge} from "./interfaces/IGauge.sol";
import {ReentrancyGuard} from "./lib/ReentrancyGuard.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";

contract AerodromeUsdcWethStrategy is ReentrancyGuard {
    using SafeTransferLib for IERC20;

    struct InvestParams {
        uint256 minWethOut;
        uint256 minLp;
        uint256 deadline;
    }

    struct HarvestParams {
        uint256 minUsdcFromAero;
        uint256 minWethOut;
        uint256 minLp;
        uint256 deadline;
    }

    struct WithdrawParams {
        uint256 minWethFromLp;
        uint256 minUsdcFromLp;
        uint256 minUsdcFromWeth;
        uint256 deadline;
    }

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable aero;
    IERC20 public immutable lpToken;
    IAerodromeRouter public immutable router;
    IGauge public immutable gauge;
    address public immutable factory;
    bool public immutable stablePool;

    address public owner;
    address public keeper;
    address public vault;

    event OwnerUpdated(address indexed owner);
    event KeeperUpdated(address indexed keeper);
    event VaultSet(address indexed vault);
    event Invested(uint256 usdcAmount, uint256 wethBought, uint256 liquidity);
    event Harvested(uint256 aeroClaimed, uint256 usdcFromAero, uint256 liquidity);
    event Withdrawn(address indexed receiver, uint256 lpAmount, uint256 usdcReturned);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyKeeper() {
        require(msg.sender == keeper, "ONLY_KEEPER");
        _;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "ONLY_VAULT");
        _;
    }

    constructor(
        address usdc_,
        address weth_,
        address aero_,
        address lpToken_,
        address router_,
        address gauge_,
        address factory_,
        bool stablePool_,
        address owner_,
        address keeper_
    ) {
        require(usdc_ != address(0) && weth_ != address(0) && aero_ != address(0), "ZERO_TOKEN");
        require(lpToken_ != address(0) && router_ != address(0) && gauge_ != address(0), "ZERO_INTEGRATION");
        require(owner_ != address(0) && keeper_ != address(0), "ZERO_AUTH");

        usdc = IERC20(usdc_);
        weth = IERC20(weth_);
        aero = IERC20(aero_);
        lpToken = IERC20(lpToken_);
        router = IAerodromeRouter(router_);
        gauge = IGauge(gauge_);
        factory = factory_;
        stablePool = stablePool_;
        owner = owner_;
        keeper = keeper_;

        usdc.safeApprove(router_, type(uint256).max);
        weth.safeApprove(router_, type(uint256).max);
        aero.safeApprove(router_, type(uint256).max);
        lpToken.safeApprove(router_, type(uint256).max);
        lpToken.safeApprove(gauge_, type(uint256).max);
    }

    function setOwner(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "ZERO_OWNER");
        owner = nextOwner;
        emit OwnerUpdated(nextOwner);
    }

    function setKeeper(address nextKeeper) external onlyOwner {
        require(nextKeeper != address(0), "ZERO_KEEPER");
        keeper = nextKeeper;
        emit KeeperUpdated(nextKeeper);
    }

    function setVault(address vault_) external onlyOwner {
        require(vault == address(0), "VAULT_SET");
        require(vault_ != address(0), "ZERO_VAULT");
        vault = vault_;
        emit VaultSet(vault_);
    }

    function totalLp() public view returns (uint256) {
        return gauge.balanceOf(address(this)) + lpToken.balanceOf(address(this));
    }

    function invest(uint256 usdcAmount, InvestParams calldata params)
        external
        onlyVault
        nonReentrant
        returns (uint256 liquidity)
    {
        require(usdcAmount > 0, "ZERO_AMOUNT");

        uint256 wethBought = _swapUsdcToWeth(usdcAmount / 2, params.minWethOut, params.deadline);
        liquidity = _addAndStake(params.minLp, params.deadline);

        emit Invested(usdcAmount, wethBought, liquidity);
    }

    function harvest(HarvestParams calldata params) external onlyKeeper nonReentrant returns (uint256 liquidity) {
        uint256 aeroBefore = aero.balanceOf(address(this));
        gauge.getReward(address(this));
        uint256 aeroClaimed = aero.balanceOf(address(this)) - aeroBefore;

        uint256 usdcFromAero;
        if (aeroClaimed > 0) {
            usdcFromAero = _swap(aero, usdc, aeroClaimed, params.minUsdcFromAero, params.deadline);
        } else {
            require(params.minUsdcFromAero == 0, "NO_REWARD");
        }

        uint256 usdcToPair = usdc.balanceOf(address(this)) / 2;
        if (usdcToPair > 0) {
            _swapUsdcToWeth(usdcToPair, params.minWethOut, params.deadline);
        } else {
            require(params.minWethOut == 0, "NO_USDC");
        }

        liquidity = _addAndStake(params.minLp, params.deadline);
        emit Harvested(aeroClaimed, usdcFromAero, liquidity);
    }

    function withdraw(uint256 lpAmount, address receiver, WithdrawParams calldata params)
        external
        onlyVault
        nonReentrant
        returns (uint256 usdcReturned)
    {
        require(lpAmount > 0, "ZERO_LP");
        require(receiver != address(0), "ZERO_RECEIVER");

        uint256 usdcBefore = usdc.balanceOf(address(this));
        gauge.withdraw(lpAmount);
        router.removeLiquidity(
            address(weth),
            address(usdc),
            stablePool,
            lpAmount,
            params.minWethFromLp,
            params.minUsdcFromLp,
            address(this),
            params.deadline
        );

        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0) {
            _swap(weth, usdc, wethBalance, params.minUsdcFromWeth, params.deadline);
        } else {
            require(params.minUsdcFromWeth == 0, "NO_WETH");
        }

        usdcReturned = usdc.balanceOf(address(this)) - usdcBefore;
        usdc.safeTransfer(receiver, usdcReturned);

        emit Withdrawn(receiver, lpAmount, usdcReturned);
    }

    function _swapUsdcToWeth(uint256 amountIn, uint256 minWethOut, uint256 deadline) internal returns (uint256) {
        if (amountIn == 0) return 0;
        return _swap(usdc, weth, amountIn, minWethOut, deadline);
    }

    function _swap(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, uint256 amountOutMin, uint256 deadline)
        internal
        returns (uint256 amountOut)
    {
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route(address(tokenIn), address(tokenOut), stablePool, factory);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(amountIn, amountOutMin, routes, address(this), deadline);
        amountOut = amounts[amounts.length - 1];
    }

    function _addAndStake(uint256 minLp, uint256 deadline) internal returns (uint256 liquidity) {
        uint256 wethBalance = weth.balanceOf(address(this));
        uint256 usdcBalance = usdc.balanceOf(address(this));
        if (wethBalance == 0 || usdcBalance == 0) {
            require(minLp == 0, "INSUFFICIENT_PAIR");
            return 0;
        }

        (,, liquidity) = router.addLiquidity(
            address(weth),
            address(usdc),
            stablePool,
            wethBalance,
            usdcBalance,
            0,
            0,
            address(this),
            deadline
        );
        require(liquidity >= minLp, "LP_SLIPPAGE");
        gauge.deposit(liquidity);
    }
}
