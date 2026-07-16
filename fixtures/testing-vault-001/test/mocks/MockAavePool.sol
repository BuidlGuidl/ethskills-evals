// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAavePool} from "../../src/interfaces/IAavePool.sol";

/// @notice Receipt token minted by {MockAavePool}, mirroring aUSDT.
contract MockAToken is ERC20 {
    address public immutable pool;

    constructor(address _pool) ERC20("Aave Tether USD", "aUSDT") {
        pool = _pool;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == pool, "only pool");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == pool, "only pool");
        _burn(from, amount);
    }
}

/// @notice Stand-in for the Aave V3 pool used across the test suite.
contract MockAavePool is IAavePool {
    IERC20 public immutable underlying;
    MockAToken public immutable aToken;

    constructor(address _underlying) {
        underlying = IERC20(_underlying);
        aToken = new MockAToken(address(this));
    }

    function supply(address, uint256 amount, address onBehalfOf, uint16) external override {
        underlying.transferFrom(msg.sender, address(this), amount);
        aToken.mint(onBehalfOf, amount);
    }

    function withdraw(address, uint256 amount, address to) external override returns (uint256) {
        aToken.burn(msg.sender, amount);
        underlying.transfer(to, amount);
        return amount;
    }
}
