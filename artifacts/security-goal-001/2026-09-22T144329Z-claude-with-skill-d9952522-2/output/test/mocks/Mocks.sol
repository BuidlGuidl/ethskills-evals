// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SaveVault} from "../../src/SaveVault.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

/// @dev Burns `feeBps` of every transfer.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public immutable feeBps;

    constructor(uint256 feeBps_) ERC20("Fee", "FEE") {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = (value * feeBps) / 10_000;
            super._update(from, address(0xdead), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

/// @dev Calls back into the vault on transfer, ERC-777 style.
contract ReentrantERC20 is ERC20 {
    SaveVault public vault;
    bool public armed;

    constructor() ERC20("Reenter", "RE") {}

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }

    function arm(SaveVault v) external {
        vault = v;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (armed && address(vault) != address(0) && from == address(vault)) {
            armed = false;
            vault.deposit(1, address(this));
        }
    }
}

/// @dev `symbol()` returns bytes32, `name()` reverts.
contract WeirdMetadataERC20 is ERC20 {
    constructor() ERC20("x", "x") {}

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }

    function symbol() public pure override returns (string memory) {
        assembly {
            mstore(0, "MKR")
            return(0, 32)
        }
    }

    function name() public pure override returns (string memory) {
        revert("no name");
    }
}
