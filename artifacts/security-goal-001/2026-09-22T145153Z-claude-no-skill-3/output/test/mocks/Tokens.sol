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

/// @dev Takes a 1% cut on every transfer.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

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

/// @dev Calls an arbitrary target on every transfer, the way an ERC-777 receive hook would.
contract HookToken is ERC20 {
    address public hookTarget;
    bytes public hookData;
    bool private _firing;

    constructor() ERC20("Hook", "HOOK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setHook(address target, bytes calldata data) external {
        hookTarget = target;
        hookData = data;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (hookTarget != address(0) && !_firing) {
            _firing = true;
            (bool ok, bytes memory ret) = hookTarget.call(hookData);
            _firing = false;
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
    }
}

/// @dev MKR-style bytes32 metadata and no `decimals()` at all.
contract Bytes32MetadataToken {
    bytes32 public constant name = "Maker";
    bytes32 public constant symbol = "MKR";

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        return true;
    }

    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
        return true;
    }

    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        if (f != msg.sender) allowance[f][msg.sender] -= a;
        balanceOf[f] -= a;
        balanceOf[t] += a;
        return true;
    }
}

/// @dev Metadata methods revert and burn all the gas they are given.
contract HostileMetadataToken is ERC20 {
    constructor() ERC20("", "") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function name() public pure override returns (string memory) {
        _burnGas();
        return "";
    }

    function symbol() public pure override returns (string memory) {
        _burnGas();
        return "";
    }

    function decimals() public pure override returns (uint8) {
        _burnGas();
        return 18;
    }

    function _burnGas() private pure {
        uint256 x;
        while (true) {
            unchecked {
                x = uint256(keccak256(abi.encode(x)));
            }
        }
    }
}
