// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

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

/// @notice Burns `feeBps` of every transfer.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public immutable feeBps;

    constructor(uint256 feeBps_) ERC20("Fee", "FEE") {
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

/// @notice Calls back into the vault on transfer, like an ERC-777 hook.
contract ReentrantERC20 is ERC20 {
    address public vault;
    bytes public payload;
    bool private _entered;

    constructor() ERC20("Reenter", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address vault_, bytes calldata payload_) external {
        vault = vault_;
        payload = payload_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (vault != address(0) && !_entered) {
            _entered = true;
            (bool ok, bytes memory ret) = vault.call(payload);
            _entered = false;
            if (!ok) {
                assembly {
                    revert(add(ret, 0x20), mload(ret))
                }
            }
        }
    }
}

/// @notice Returns a 1 MB blob from symbol() and reverts on decimals().
contract HostileMetadataERC20 is ERC20 {
    constructor() ERC20("", "") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function symbol() public pure override returns (string memory) {
        assembly {
            let size := 1048576
            mstore(0x00, 0x20)
            mstore(0x20, size)
            return(0x00, add(size, 0x40))
        }
    }

    function decimals() public pure override returns (uint8) {
        revert("no decimals");
    }
}
