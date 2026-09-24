// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SaveVault} from "../../src/SaveVault.sol";

/// @dev Plain ERC-20 with configurable decimals (USDC is 6, WBTC is 8).
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

/// @dev Burns `feeBps` of every transfer, like PAXG / SAFEMOON-style tokens.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public immutable feeBps;

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
        super._update(from, address(0), fee);
    }
}

/// @dev Hands control to a hook contract during `transfer`, like an ERC-777 `tokensReceived`.
contract ReentrantERC20 is ERC20 {
    address public hook;
    bool private _entered;

    constructor() ERC20("Hooked", "HOOK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setHook(address hook_) external {
        hook = hook_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (hook != address(0) && !_entered && (to == hook || from == hook)) {
            _entered = true;
            ReentrancyAttacker(hook).onTokenTransfer();
            _entered = false;
        }
    }
}

contract ReentrancyAttacker {
    SaveVault public immutable vault;
    bool public reenterAttempted;
    bool public reenterSucceeded;

    constructor(SaveVault vault_) {
        vault = vault_;
    }

    function onTokenTransfer() external {
        if (reenterAttempted) return;
        reenterAttempted = true;
        try vault.redeem(1, address(this), address(this)) {
            reenterSucceeded = true;
        } catch {}
    }

    function go(uint256 assets) external {
        vault.deposit(assets, address(this));
        vault.redeem(vault.balanceOf(address(this)), address(this), address(this));
    }
}

/// @dev Metadata that is hostile in every way a real token has been: bytes32 symbol, no name,
///      control characters, and a reverting call.
contract WeirdMetadataToken is ERC20 {
    constructor() ERC20("", "") {}

    function name() public pure override returns (string memory) {
        revert("no name");
    }

    function symbol() public pure override returns (string memory) {
        return "BA\x00D\"<script>";
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract Bytes32MetadataToken {
    function name() external pure returns (bytes32) {
        return "Maker";
    }

    function symbol() external pure returns (bytes32) {
        return "MKR";
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function balanceOf(address) external pure returns (uint256) {
        return 0;
    }
}
