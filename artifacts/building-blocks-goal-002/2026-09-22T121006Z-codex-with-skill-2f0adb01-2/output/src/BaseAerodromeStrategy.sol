// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAerodromeGauge, IAerodromePair, IAerodromeRouter} from "./interfaces/IAerodrome.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransferLib} from "./lib/SafeTransferLib.sol";

contract BaseAerodromeStrategy {
    using SafeTransferLib for IERC20;

    IERC20 public immutable usdc;
    IERC20 public immutable weth;
    IERC20 public immutable rewardToken;
    IAerodromeRouter public immutable router;
    IAerodromePair public immutable pair;
    IAerodromeGauge public immutable gauge;
    address public immutable factory;
    bool public immutable stablePool;

    address public owner;
    address public keeper;
    address public vault;
    uint256 public maxSlippageBps = 100;
    uint256 public minCompoundUsdc = 1e6;

    uint256 private locked = 1;

    event VaultSet(address indexed vault);
    event KeeperUpdated(address indexed keeper);
    event SlippageUpdated(uint256 maxSlippageBps);
    event MinCompoundUpdated(uint256 minCompoundUsdc);
    event Deposited(uint256 usdcAmount, uint256 liquidity);
    event Withdrawn(uint256 requestedUsdc, uint256 sentUsdc);
    event Harvested(uint256 rewardAmount, uint256 compoundedUsdc, uint256 liquidity);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    error ZeroAddress();
    error Unauthorized();
    error InvalidSlippage();
    error InsufficientAssets();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert Unauthorized();
        _;
    }

    modifier onlyKeeperOrOwner() {
        if (msg.sender != keeper && msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(
        IERC20 usdc_,
        IERC20 weth_,
        IERC20 rewardToken_,
        IAerodromeRouter router_,
        IAerodromePair pair_,
        IAerodromeGauge gauge_,
        address factory_,
        bool stablePool_,
        address owner_,
        address keeper_
    ) {
        if (
            address(usdc_) == address(0) || address(weth_) == address(0) || address(rewardToken_) == address(0)
                || address(router_) == address(0) || address(pair_) == address(0) || address(gauge_) == address(0)
                || factory_ == address(0) || owner_ == address(0) || keeper_ == address(0)
        ) revert ZeroAddress();

        usdc = usdc_;
        weth = weth_;
        rewardToken = rewardToken_;
        router = router_;
        pair = pair_;
        gauge = gauge_;
        factory = factory_;
        stablePool = stablePool_;
        owner = owner_;
        keeper = keeper_;

        usdc.safeApprove(address(router_), type(uint256).max);
        weth.safeApprove(address(router_), type(uint256).max);
        rewardToken.safeApprove(address(router_), type(uint256).max);
        IERC20(address(pair_)).safeApprove(address(router_), type(uint256).max);
        IERC20(address(pair_)).safeApprove(address(gauge_), type(uint256).max);
    }

    function setVault(address vault_) external onlyOwner {
        if (vault != address(0) || vault_ == address(0)) revert Unauthorized();
        vault = vault_;
        emit VaultSet(vault_);
    }

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperUpdated(keeper_);
    }

    function setMaxSlippageBps(uint256 maxSlippageBps_) external onlyOwner {
        if (maxSlippageBps_ > 1_000) revert InvalidSlippage();
        maxSlippageBps = maxSlippageBps_;
        emit SlippageUpdated(maxSlippageBps_);
    }

    function setMinCompoundUsdc(uint256 minCompoundUsdc_) external onlyOwner {
        minCompoundUsdc = minCompoundUsdc_;
        emit MinCompoundUpdated(minCompoundUsdc_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function deposit(uint256 amountUsdc) external onlyVault nonReentrant {
        (, uint256 liquidity) = _compoundIdleUsdc();
        emit Deposited(amountUsdc, liquidity);
    }

    function withdraw(uint256 requestedUsdc, address receiver)
        external
        onlyVault
        nonReentrant
        returns (uint256 sentUsdc)
    {
        uint256 idle = usdc.balanceOf(address(this));
        if (idle < requestedUsdc) {
            _freeUsdc(requestedUsdc - idle);
        }

        sentUsdc = usdc.balanceOf(address(this));
        if (sentUsdc < requestedUsdc) revert InsufficientAssets();
        sentUsdc = requestedUsdc;
        usdc.safeTransfer(receiver, sentUsdc);
        emit Withdrawn(requestedUsdc, sentUsdc);
    }

    function harvest()
        external
        onlyKeeperOrOwner
        nonReentrant
        returns (uint256 rewardAmount, uint256 compoundedUsdc, uint256 liquidity)
    {
        uint256 rewardBefore = rewardToken.balanceOf(address(this));
        gauge.getReward(address(this));
        rewardAmount = rewardToken.balanceOf(address(this)) - rewardBefore;

        if (rewardToken.balanceOf(address(this)) > 0 && address(rewardToken) != address(usdc)) {
            _swapRewardToUsdc(rewardToken.balanceOf(address(this)));
        }

        compoundedUsdc = usdc.balanceOf(address(this));
        (, liquidity) = _compoundIdleUsdc();
        emit Harvested(rewardAmount, compoundedUsdc, liquidity);
    }

    function totalAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this)) + _lpValueUsdc(gauge.balanceOf(address(this)))
            + _lpValueUsdc(pair.balanceOf(address(this)));
    }

    function _compoundIdleUsdc() private returns (uint256 pairedUsdc, uint256 liquidity) {
        uint256 amountUsdc = usdc.balanceOf(address(this));
        if (amountUsdc < minCompoundUsdc) return (0, 0);

        uint256 swapAmount = amountUsdc / 2;
        uint256 expectedWeth = _quoteUsdcToWeth(swapAmount);
        IAerodromeRouter.Route[] memory routes = _singleRoute(address(usdc), address(weth));
        router.swapExactTokensForTokens(swapAmount, _minOut(expectedWeth), routes, address(this), block.timestamp);

        uint256 usdcForLp = usdc.balanceOf(address(this));
        uint256 wethForLp = weth.balanceOf(address(this));
        uint256 expectedUsdcMin = _minOut(usdcForLp);
        uint256 expectedWethMin = _minOut(wethForLp);
        (pairedUsdc,, liquidity) = router.addLiquidity(
            address(usdc),
            address(weth),
            stablePool,
            usdcForLp,
            wethForLp,
            expectedUsdcMin,
            expectedWethMin,
            address(this),
            block.timestamp
        );

        uint256 lpBalance = pair.balanceOf(address(this));
        if (lpBalance > 0) gauge.deposit(lpBalance);
    }

    function _freeUsdc(uint256 deficit) private {
        uint256 managed = totalAssets();
        uint256 stakedLp = gauge.balanceOf(address(this));
        if (managed == 0 || stakedLp == 0) revert InsufficientAssets();

        uint256 lpToWithdraw = _mulDivUp(stakedLp, deficit, managed);
        if (lpToWithdraw > stakedLp) lpToWithdraw = stakedLp;
        gauge.withdraw(lpToWithdraw);

        (uint256 expectedUsdc, uint256 expectedWeth) = _expectedRemoveAmounts(lpToWithdraw);
        router.removeLiquidity(
            address(usdc),
            address(weth),
            stablePool,
            lpToWithdraw,
            _minOut(expectedUsdc),
            _minOut(expectedWeth),
            address(this),
            block.timestamp
        );

        uint256 wethBalance = weth.balanceOf(address(this));
        if (wethBalance > 0) {
            uint256 expectedSwapUsdc = _quoteWethToUsdc(wethBalance);
            IAerodromeRouter.Route[] memory routes = _singleRoute(address(weth), address(usdc));
            router.swapExactTokensForTokens(
                wethBalance, _minOut(expectedSwapUsdc), routes, address(this), block.timestamp
            );
        }
    }

    function _swapRewardToUsdc(uint256 amount) private {
        uint256 expectedUsdc = _quoteRewardToUsdc(amount);
        IAerodromeRouter.Route[] memory routes = _singleRoute(address(rewardToken), address(usdc));
        router.swapExactTokensForTokens(amount, _minOut(expectedUsdc), routes, address(this), block.timestamp);
    }

    function _lpValueUsdc(uint256 lpAmount) private view returns (uint256) {
        if (lpAmount == 0) return 0;
        uint256 supply = pair.totalSupply();
        if (supply == 0) return 0;

        (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
        (uint256 usdcReserve, uint256 wethReserve) =
            pair.token0() == address(usdc) ? (reserve0, reserve1) : (reserve1, reserve0);

        uint256 usdcShare = usdcReserve * lpAmount / supply;
        uint256 wethShare = wethReserve * lpAmount / supply;
        return usdcShare + _quoteWethToUsdc(wethShare);
    }

    function _expectedRemoveAmounts(uint256 lpAmount)
        private
        view
        returns (uint256 expectedUsdc, uint256 expectedWeth)
    {
        uint256 supply = pair.totalSupply();
        if (supply == 0) return (0, 0);

        (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
        (uint256 usdcReserve, uint256 wethReserve) =
            pair.token0() == address(usdc) ? (reserve0, reserve1) : (reserve1, reserve0);
        expectedUsdc = usdcReserve * lpAmount / supply;
        expectedWeth = wethReserve * lpAmount / supply;
    }

    function _quoteUsdcToWeth(uint256 amount) private view returns (uint256) {
        IAerodromeRouter.Route[] memory routes = _singleRoute(address(usdc), address(weth));
        uint256[] memory amounts = router.getAmountsOut(amount, routes);
        return amounts[amounts.length - 1];
    }

    function _quoteWethToUsdc(uint256 amount) private view returns (uint256) {
        IAerodromeRouter.Route[] memory routes = _singleRoute(address(weth), address(usdc));
        uint256[] memory amounts = router.getAmountsOut(amount, routes);
        return amounts[amounts.length - 1];
    }

    function _quoteRewardToUsdc(uint256 amount) private view returns (uint256) {
        IAerodromeRouter.Route[] memory routes = _singleRoute(address(rewardToken), address(usdc));
        uint256[] memory amounts = router.getAmountsOut(amount, routes);
        return amounts[amounts.length - 1];
    }

    function _singleRoute(address from, address to) private view returns (IAerodromeRouter.Route[] memory routes) {
        routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({from: from, to: to, stable: false, factory: factory});
    }

    function _minOut(uint256 amount) private view returns (uint256) {
        return amount * (10_000 - maxSlippageBps) / 10_000;
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 denominator) private pure returns (uint256) {
        return x == 0 ? 0 : ((x * y - 1) / denominator) + 1;
    }
}
