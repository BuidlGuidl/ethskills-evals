// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAerodromeRouter} from "../../src/interfaces/IAerodrome.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory n, uint8 d) ERC20(n, n) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

/// @dev Chainlink-style feed with settable values.
contract MockFeed {
    uint8 public decimals;
    int256 public answer;
    uint256 public startedAt;
    uint256 public updatedAt;
    bool public broken;

    constructor(uint8 d, int256 a) {
        decimals = d;
        answer = a;
        startedAt = 1;
        updatedAt = block.timestamp;
    }

    function set(int256 a, uint256 upd) external {
        answer = a;
        updatedAt = upd;
    }

    function setStartedAt(uint256 s) external {
        startedAt = s;
    }

    function setBroken(bool b) external {
        broken = b;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        require(!broken, "feed broken");
        return (1, answer, startedAt, updatedAt, 1);
    }
}

/// @dev x*y=k pool mimicking Aerodrome vAMM: fee is taken on input and sent OUT of the pool.
contract MockPool is ERC20 {
    address public immutable token0;
    address public immutable token1;
    bool public constant stable = false;
    uint256 public constant FEE_BPS = 30;
    address public constant FEE_SINK = address(0xFEE);
    uint256 public reserve0;
    uint256 public reserve1;

    constructor(address a, address b) ERC20("vAMM", "vAMM") {
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
        uint256 supply = totalSupply();
        if (supply == 0) {
            liq = Math.sqrt(a0 * a1) - 1000;
            _mint(address(1), 1000);
        } else {
            liq = Math.min(a0 * supply / reserve0, a1 * supply / reserve1);
        }
        require(liq > 0, "no liq");
        _mint(to, liq);
        (reserve0, reserve1) = (b0, b1);
    }

    function burn(address to) external returns (uint256 a0, uint256 a1) {
        uint256 liq = balanceOf(address(this));
        uint256 supply = totalSupply();
        a0 = liq * reserve0 / supply;
        a1 = liq * reserve1 / supply;
        _burn(address(this), liq);
        IERC20(token0).transfer(to, a0);
        IERC20(token1).transfer(to, a1);
        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
    }

    /// @dev amountIn of tokenIn must already be transferred in.
    function swap(address tokenIn, uint256 amountIn, address to) external returns (uint256 out) {
        bool zeroIn = tokenIn == token0;
        (uint256 rIn, uint256 rOut) = zeroIn ? (reserve0, reserve1) : (reserve1, reserve0);
        uint256 fee = amountIn * FEE_BPS / 10_000;
        uint256 net = amountIn - fee;
        out = net * rOut / (rIn + net);
        IERC20(tokenIn).transfer(FEE_SINK, fee);
        IERC20(zeroIn ? token1 : token0).transfer(to, out);
        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
    }
}

contract MockFactory {
    function getFee(address, bool) external pure returns (uint256) {
        return 30;
    }
}

contract MockRouter {
    address public immutable defaultFactory;
    mapping(address => mapping(address => MockPool)) public pools;

    constructor() {
        defaultFactory = address(new MockFactory());
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
        uint256
    ) external returns (uint256 a, uint256 b, uint256 liq) {
        MockPool p = pools[tokenA][tokenB];
        (a, b) = _optimal(p, tokenA, aDesired, bDesired);
        require(a >= aMin && b >= bMin, "Router: insufficient amount");
        IERC20(tokenA).transferFrom(msg.sender, address(p), a);
        IERC20(tokenB).transferFrom(msg.sender, address(p), b);
        liq = p.mint(to);
    }

    function _optimal(MockPool p, address tokenA, uint256 aDesired, uint256 bDesired)
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
        uint256
    ) external returns (uint256 a, uint256 b) {
        MockPool p = pools[tokenA][tokenB];
        p.transferFrom(msg.sender, address(p), liq);
        (uint256 a0, uint256 a1) = p.burn(to);
        (a, b) = tokenA == p.token0() ? (a0, a1) : (a1, a0);
        require(a >= aMin && b >= bMin, "Router: insufficient amount");
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 minOut,
        IAerodromeRouter.Route[] calldata routes,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        IERC20(routes[0].from).transferFrom(msg.sender, address(this), amountIn);
        for (uint256 i; i < routes.length; i++) {
            MockPool p = pools[routes[i].from][routes[i].to];
            IERC20(routes[i].from).transfer(address(p), amounts[i]);
            amounts[i + 1] = p.swap(routes[i].from, amounts[i], address(this));
        }
        require(amounts[routes.length] >= minOut, "Router: insufficient output");
        IERC20(routes[routes.length - 1].to).transfer(to, amounts[routes.length]);
    }
}

/// @dev Gauge whose rewards are set directly by tests.
contract MockGauge {
    IERC20 public immutable stakingToken;
    MockERC20 public immutable rewardToken;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public earned;

    constructor(address lp, MockERC20 reward) {
        stakingToken = IERC20(lp);
        rewardToken = reward;
    }

    function addReward(address account, uint256 amt) external {
        earned[account] += amt;
    }

    function deposit(uint256 amt) external {
        stakingToken.transferFrom(msg.sender, address(this), amt);
        balanceOf[msg.sender] += amt;
    }

    function withdraw(uint256 amt) external {
        balanceOf[msg.sender] -= amt;
        stakingToken.transfer(msg.sender, amt);
    }

    function getReward(address account) external {
        require(msg.sender == account, "not account");
        uint256 amt = earned[account];
        earned[account] = 0;
        rewardToken.mint(account, amt);
    }
}
