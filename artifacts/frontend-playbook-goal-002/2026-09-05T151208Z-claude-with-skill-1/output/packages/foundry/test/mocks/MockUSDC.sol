// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Minimal 6-decimal stand-in for USDC, for tests that do not need a fork.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Token that skims 1% on every transfer, to prove the jar records what it actually received.
contract FeeOnTransferUSDC is ERC20 {
    constructor() ERC20("Fee USD Coin", "fUSDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = value / 100;
        super._update(from, to, value - fee);
        super._update(from, address(0xFEE), fee);
    }
}

/// @notice Token that re-enters the jar from inside `transferFrom`, to exercise the reentrancy guard.
contract ReentrantUSDC is ERC20 {
    address public jar;
    bool private attacking;

    constructor() ERC20("Reentrant USD Coin", "rUSDC") { }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setJar(address _jar) external {
        jar = _jar;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (!attacking && jar != address(0)) {
            attacking = true;
            // Re-enter tip() mid-transfer. The guard must reject this.
            (bool ok, bytes memory data) = jar.call(abi.encodeWithSignature("tip(uint256,string)", value, "reentry"));
            attacking = false;
            if (!ok) {
                assembly {
                    revert(add(data, 0x20), mload(data))
                }
            }
        }
        return super.transferFrom(from, to, value);
    }
}
