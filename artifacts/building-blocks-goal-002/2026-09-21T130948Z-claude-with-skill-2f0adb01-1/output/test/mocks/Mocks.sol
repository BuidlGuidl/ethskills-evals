// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAeroRouter} from "../../src/interfaces/IAerodrome.sol";
import {ISwapRouter02} from "../../src/interfaces/IUniswapV3.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory s, uint8 d) ERC20(s, s) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

contract MockFeed {
    uint8 public decimals;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;

    constructor(uint8 d, int256 a) {
        decimals = d;
        set(a);
    }

    function set(int256 a) public {
        answer = a;
        updatedAt = block.timestamp;
    }

    function setTimes(uint256 started, uint256 updated) external {
        startedAt = started;
        updatedAt = updated;
    }

    function description() external pure returns (string memory) {
        return "mock";
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, startedAt, updatedAt, 1);
    }
}

/// @dev Volatile x*y=k pool with 0.3% fee. Router moves tokens; pool just books reserves.
contract MockPool is ERC20 {
    address public token0;
    address public token1;
    bool public constant stable = false;
    uint256 public reserve0;
    uint256 public reserve1;

    constructor(address a, address b) ERC20("vAMM", "vAMM") {
        (token0, token1) = a < b ? (a, b) : (b, a);
    }

    function getReserves() external view returns (uint256, uint256, uint256) {
        return (reserve0, reserve1, block.timestamp);
    }

    function sync() public {
        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
    }

    function mint(address to) external returns (uint256 liq) {
        uint256 a0 = IERC20(token0).balanceOf(address(this)) - reserve0;
        uint256 a1 = IERC20(token1).balanceOf(address(this)) - reserve1;
        uint256 s = totalSupply();
        liq = s == 0 ? Math.sqrt(a0 * a1) : Math.min(a0 * s / reserve0, a1 * s / reserve1);
        _mint(to, liq);
        sync();
    }

    function burn(address to) external returns (uint256 a0, uint256 a1) {
        uint256 liq = balanceOf(address(this));
        uint256 s = totalSupply();
        a0 = liq * reserve0 / s;
        a1 = liq * reserve1 / s;
        _burn(address(this), liq);
        IERC20(token0).transfer(to, a0);
        IERC20(token1).transfer(to, a1);
        sync();
    }

    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256) {
        (uint256 rIn, uint256 rOut) = tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 inAfterFee = amountIn * 9970 / 10_000;
        return inAfterFee * rOut / (rIn + inAfterFee);
    }

    function swap(address tokenIn, address to) external returns (uint256 out) {
        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this)) - (tokenIn == token0 ? reserve0 : reserve1);
        out = getAmountOut(amountIn, tokenIn);
        IERC20(tokenIn == token0 ? token1 : token0).transfer(to, out);
        sync();
    }
}

contract MockRouter {
    mapping(bytes32 => MockPool) public pools;

    function _key(address a, address b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }

    function register(MockPool p) external {
        pools[_key(p.token0(), p.token1())] = p;
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
        uint256
    ) external returns (uint256 a, uint256 b, uint256 liq) {
        MockPool p = pools[_key(tokenA, tokenB)];
        (a, b) = _optimal(p, tokenA, aDesired, bDesired);
        require(a >= aMin && b >= bMin, "min");
        IERC20(tokenA).transferFrom(msg.sender, address(p), a);
        IERC20(tokenB).transferFrom(msg.sender, address(p), b);
        liq = p.mint(to);
    }

    function _optimal(MockPool p, address tokenA, uint256 aDesired, uint256 bDesired)
        internal
        view
        returns (uint256 a, uint256 b)
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
        uint256
    ) external returns (uint256 a, uint256 b) {
        MockPool p = pools[_key(tokenA, tokenB)];
        p.transferFrom(msg.sender, address(p), liq);
        (uint256 a0, uint256 a1) = p.burn(to);
        (a, b) = tokenA == p.token0() ? (a0, a1) : (a1, a0);
        require(a >= aMin && b >= bMin, "min");
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 minOut,
        IAeroRouter.Route[] calldata routes,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        MockPool p = pools[_key(routes[0].from, routes[0].to)];
        IERC20(routes[0].from).transferFrom(msg.sender, address(p), amountIn);
        uint256 out = p.swap(routes[0].from, to);
        require(out >= minOut, "INSUFFICIENT_OUTPUT_AMOUNT");
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = out;
    }
}

contract MockGauge {
    address public stakingToken;
    address public rewardToken;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public earned;

    constructor(address s, address r) {
        stakingToken = s;
        rewardToken = r;
    }

    function deposit(uint256 amt) external {
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amt);
        balanceOf[msg.sender] += amt;
    }

    function withdraw(uint256 amt) external {
        balanceOf[msg.sender] -= amt;
        IERC20(stakingToken).transfer(msg.sender, amt);
    }

    /// @dev Test helper: accrue `amt` reward (caller must have funded the gauge).
    function accrue(address account, uint256 amt) external {
        earned[account] += amt;
    }

    function getReward(address account) external {
        require(msg.sender == account, "auth");
        uint256 amt = earned[account];
        earned[account] = 0;
        IERC20(rewardToken).transfer(account, amt);
    }
}

/// @dev Stands in for Uniswap V3 SwapRouter02, backed by a (deeper) MockPool.
contract MockUniRouter {
    MockPool public pool;

    constructor(MockPool p) {
        pool = p;
    }

    function exactInputSingle(ISwapRouter02.ExactInputSingleParams calldata p) external returns (uint256 out) {
        IERC20(p.tokenIn).transferFrom(msg.sender, address(pool), p.amountIn);
        out = pool.swap(p.tokenIn, p.recipient);
        require(out >= p.amountOutMinimum, "Too little received");
    }
}
