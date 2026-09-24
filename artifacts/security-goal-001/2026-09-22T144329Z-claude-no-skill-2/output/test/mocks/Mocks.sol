// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

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

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Burns `feeBps` of every transfer, like USDT-with-fees-enabled or STA.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public feeBps;

    constructor(uint256 feeBps_) ERC20("Fee Token", "FEE") {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * feeBps) / 10_000;
        super._update(from, to, value - fee);
        if (fee > 0) super._update(from, address(0xFEE), fee);
    }
}

/// @dev ERC-777-style: hands control to the receiver mid-transfer.
contract ReentrantERC20 is ERC20 {
    SaveVault public vault;
    bool public armed;

    constructor() ERC20("Hook Token", "HOOK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(SaveVault vault_) external {
        vault = vault_;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (armed && to == address(vault) && address(vault) != address(0)) {
            armed = false;
            // Try to re-enter while the vault's balance has moved but its
            // share supply has not.
            vault.deposit(1, msg.sender, 0);
        }
    }
}

/// @dev Legacy metadata: symbol() returns a raw bytes32 (MKR style).
contract Bytes32MetadataToken {
    mapping(address => uint256) public balanceOf;

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function symbol() external pure returns (bytes32) {
        return "OLD";
    }
}

/// @dev No decimals(), so it must not be listable.
contract NoDecimalsToken {
    mapping(address => uint256) public balanceOf;
}

/// @dev Hostile metadata: over-long symbol full of unprintable control bytes.
contract HostileMetadataToken {
    mapping(address => uint256) public balanceOf;

    function decimals() external pure returns (uint8) {
        return 6;
    }

    function symbol() external pure returns (string memory) {
        bytes memory b = new bytes(64);
        for (uint256 i; i < b.length; ++i) {
            b[i] = bytes1(uint8(1));
        }
        return string(b);
    }
}

/// @dev Metadata gas bomb: reading symbol() should not be able to grief listing.
contract GasBombMetadataToken {
    mapping(address => uint256) public balanceOf;

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function symbol() external pure returns (string memory) {
        bytes memory b = new bytes(20_000);
        for (uint256 i; i < b.length; ++i) {
            b[i] = bytes1(uint8(65));
        }
        return string(b);
    }
}
