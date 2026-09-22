// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SaveVault} from "../../src/SaveVault.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(uint8 dec_) ERC20("Mock Token", "MOCK") {
        _dec = dec_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

/// @dev Charges a 1% fee on every transfer, like PAXG or USDT with the fee switch flipped.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = value / 100;
        super._update(from, address(0xFEE), fee);
        super._update(from, to, value - fee);
    }
}

/// @dev ERC-777-style token that calls back into the vault mid-transfer.
contract ReenteringToken is ERC20 {
    SaveVault public vault;
    bool public attacking;

    constructor() ERC20("Hook Token", "HOOK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setVault(SaveVault v) external {
        vault = v;
    }

    function arm() external {
        attacking = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (attacking && address(vault) != address(0) && from != address(0)) {
            attacking = false;
            vault.sync();
        }
    }
}

/// @dev Pre-EIP-20-final metadata: name/symbol returned as a raw bytes32 (MKR style).
contract Bytes32MetadataToken is ERC20 {
    constructor() ERC20("", "") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function name() public pure override returns (string memory) {
        assembly ("memory-safe") {
            mstore(0, "Maker")
            return(0, 32)
        }
    }

    function symbol() public pure override returns (string memory) {
        assembly ("memory-safe") {
            mstore(0, "MKR")
            return(0, 32)
        }
    }
}

/// @dev Metadata getters that revert or return junk; the token must still be listable.
contract HostileMetadataToken is ERC20 {
    constructor() ERC20("", "") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function name() public pure override returns (string memory) {
        assembly ("memory-safe") {
            // Malformed "string": the offset word points past the end of the returndata.
            mstore(0, 0xdead)
            mstore(32, 0xbeef)
            return(0, 64)
        }
    }

    function symbol() public pure override returns (string memory) {
        revert();
    }

    function decimals() public pure override returns (uint8) {
        revert();
    }
}
