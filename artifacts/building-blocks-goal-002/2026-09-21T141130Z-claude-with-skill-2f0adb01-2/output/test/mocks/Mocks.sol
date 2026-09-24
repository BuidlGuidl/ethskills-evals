// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract MockERC20 is ERC20 {
    uint8 internal immutable _dec;

    constructor(string memory n, uint8 d) ERC20(n, n) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockFeed {
    uint8 public decimals = 8;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;

    function set(int256 a, uint256 started, uint256 updated) external {
        answer = a;
        startedAt = started;
        updatedAt = updated;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, startedAt, updatedAt, 1);
    }
}

/// @dev Minimal x*y=k pool with 0.3% fee and Aerodrome-like views. LP token is the pool itself.
contract MockPool is ERC20 {
    address public immutable token0;
    address public immutable token1;
    bool public constant stable = false;
    uint256 internal reserve0;
    uint256 internal reserve1;

    constructor(address a, address b) ERC20("LP", "LP") {
        (token0, token1) = a < b ? (a, b) : (b, a);
    }

    function getReserves() external view returns (uint256, uint256, uint256) {
        return (reserve0, reserve1, block.timestamp);
    }

    function mint(address to) external returns (uint256 liq) {
        uint256 b0 = IERC20(token0).balanceOf(address(this));
        uint256 b1 = IERC20(token1).balanceOf(address(this));
        uint256 a0 = b0 - reserve0;
        uint256 a1 = b1 - reserve1;
        uint256 ts = totalSupply();
        liq = ts == 0 ? Math.sqrt(a0 * a1) : Math.min(a0 * ts / reserve0, a1 * ts / reserve1);
        _mint(to, liq);
        _sync();
    }

    function burn(address to) external returns (uint256 a0, uint256 a1) {
        uint256 liq = balanceOf(address(this));
        uint256 ts = totalSupply();
        a0 = liq * IERC20(token0).balanceOf(address(this)) / ts;
        a1 = liq * IERC20(token1).balanceOf(address(this)) / ts;
        _burn(address(this), liq);
        IERC20(token0).transfer(to, a0);
        IERC20(token1).transfer(to, a1);
        _sync();
    }

    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256) {
        (uint256 rIn, uint256 rOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 inFee = amountIn * 997;
        return inFee * rOut / (rIn * 1000 + inFee);
    }

    function swap(address tokenIn, address to) external returns (uint256 out) {
        uint256 rIn = tokenIn == token0 ? reserve0 : reserve1;
        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this)) - rIn;
        out = getAmountOut(amountIn, tokenIn);
        IERC20(tokenIn == token0 ? token1 : token0).transfer(to, out);
        _sync();
    }

    function _sync() internal {
        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
    }
}

/// @dev Router with the Aerodrome Router ABI subset used by the vault.
contract MockRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    mapping(address => mapping(address => MockPool)) public pools;

    function defaultFactory() external view returns (address) {
        return address(this);
    }

    function register(MockPool p) external {
        pools[p.token0()][p.token1()] = p;
        pools[p.token1()][p.token0()] = p;
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool,
        uint256 aDesired,
        uint256 bDesired,
        uint256 aMin,
        uint256 bMin,
        address to,
        uint256 deadline
    ) external returns (uint256 a, uint256 b, uint256 liq) {
        require(block.timestamp <= deadline, "expired");
        MockPool p = pools[tokenA][tokenB];
        (a, b) = _quote(p, tokenA, aDesired, bDesired);
        require(a >= aMin && b >= bMin, "min");
        IERC20(tokenA).transferFrom(msg.sender, address(p), a);
        IERC20(tokenB).transferFrom(msg.sender, address(p), b);
        liq = p.mint(to);
    }

    function _quote(MockPool p, address tokenA, uint256 aDesired, uint256 bDesired)
        internal
        view
        returns (uint256, uint256)
    {
        (uint256 r0, uint256 r1,) = p.getReserves();
        (uint256 rA, uint256 rB) = tokenA == p.token0() ? (r0, r1) : (r1, r0);
        if (rA == 0 && rB == 0) return (aDesired, bDesired);
        uint256 bOpt = aDesired * rB / rA;
        if (bOpt <= bDesired) return (aDesired, bOpt);
        return (bDesired * rA / rB, bDesired);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool,
        uint256 liq,
        uint256 aMin,
        uint256 bMin,
        address to,
        uint256 deadline
    ) external returns (uint256 a, uint256 b) {
        require(block.timestamp <= deadline, "expired");
        MockPool p = pools[tokenA][tokenB];
        p.transferFrom(msg.sender, address(p), liq);
        (uint256 a0, uint256 a1) = p.burn(to);
        (a, b) = tokenA == p.token0() ? (a0, a1) : (a1, a0);
        require(a >= aMin && b >= bMin, "min");
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "expired");
        require(routes.length == 1, "single hop");
        MockPool p = pools[routes[0].from][routes[0].to];
        IERC20(routes[0].from).transferFrom(msg.sender, address(p), amountIn);
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = p.swap(routes[0].from, to);
        require(amounts[1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
    }
}

/// @dev Gauge that pays AERO set by the test via `accrue`.
contract MockGauge {
    IERC20 public immutable stakingToken;
    MockERC20 public immutable rewardToken;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public earned;

    constructor(IERC20 lp, MockERC20 aero) {
        stakingToken = lp;
        rewardToken = aero;
    }

    function accrue(address account, uint256 amount) external {
        earned[account] += amount;
    }

    function deposit(uint256 amount) external {
        stakingToken.transferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        stakingToken.transfer(msg.sender, amount);
    }

    function getReward(address account) external {
        uint256 r = earned[account];
        earned[account] = 0;
        rewardToken.mint(account, r);
    }
}
