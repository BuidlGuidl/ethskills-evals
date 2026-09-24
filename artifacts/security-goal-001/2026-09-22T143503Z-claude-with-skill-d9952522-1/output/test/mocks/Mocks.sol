// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SaveVault} from "../../src/SaveVault.sol";

/// @dev Plain, well-behaved ERC-20 with configurable decimals.
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

/// @dev Burns `feeBps` of every transfer. Must be rejected by the vault.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public feeBps;

    constructor(uint256 feeBps_) ERC20("Fee", "FEE") {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = (value * feeBps) / 10_000;
            if (fee > 0) {
                super._update(from, address(0), fee);
                value -= fee;
            }
        }
        super._update(from, to, value);
    }
}

/// @dev Symbol returns bytes32 rather than string, like MKR.
contract Bytes32SymbolERC20 is ERC20 {
    constructor() ERC20("Maker", "ignored") {}

    function symbol() public pure override returns (string memory) {
        assembly {
            mstore(0x00, "MKR")
            return(0x00, 0x20)
        }
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

/// @dev symbol() reverts. Listing must still succeed.
contract NoSymbolERC20 is ERC20 {
    constructor() ERC20("NoSymbol", "x") {}

    function symbol() public pure override returns (string memory) {
        revert("no symbol");
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

/// @dev ERC-777-style token that calls back into the vault on transfer.
contract ReentrantERC20 is ERC20 {
    SaveVault public vault;
    bool public attacking;

    constructor() ERC20("Reentrant", "RE") {}

    function setVault(SaveVault v) external {
        vault = v;
    }

    function setAttacking(bool a) external {
        attacking = a;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (attacking && address(vault) != address(0) && from == address(vault)) {
            // Re-enter on the way out of a withdrawal.
            attacking = false;
            vault.redeem(1, address(this), address(this));
        }
    }
}
