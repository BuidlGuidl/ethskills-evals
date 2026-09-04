// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The slice of Foundry's cheatcode interface this repo uses.
/// @dev Vendored rather than pulling in forge-std so that `forge build` works from
///      a bare clone with no `forge install` step and no submodules.
interface Vm {
    function envUint(string calldata name) external view returns (uint256);
    function envOr(string calldata name, uint256 defaultValue) external view returns (uint256);
    function envOr(string calldata name, string calldata defaultValue) external view returns (string memory);
    function addr(uint256 privateKey) external pure returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;

    function readFile(string calldata path) external view returns (string memory);
    function writeFile(string calldata path, string calldata data) external;
    function exists(string calldata path) external view returns (bool);
    function serializeAddress(string calldata objectKey, string calldata valueKey, address value)
        external
        returns (string memory);
    function serializeUint(string calldata objectKey, string calldata valueKey, uint256 value)
        external
        returns (string memory);
    function writeJson(string calldata json, string calldata path) external;
    function parseJsonAddress(string calldata json, string calldata key) external pure returns (address);
    function parseJsonBytes32(string calldata json, string calldata key) external pure returns (bytes32);
    function parseJsonBytes32Array(string calldata json, string calldata key)
        external
        pure
        returns (bytes32[] memory);
    function parseJsonBytes(string calldata json, string calldata key) external pure returns (bytes memory);
    function parseJsonUint(string calldata json, string calldata key) external pure returns (uint256);
    function parseJsonBool(string calldata json, string calldata key) external pure returns (bool);

    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function expectRevert(bytes4 revertData) external;
    function etch(address target, bytes calldata newRuntimeBytecode) external;
    function getCode(string calldata artifactPath) external view returns (bytes memory);
    function label(address account, string calldata newLabel) external;
}

library console {
    address constant CONSOLE = 0x000000000000000000636F6e736F6c652e6c6f67;

    function _send(bytes memory payload) private view {
        address target = CONSOLE;
        assembly {
            pop(staticcall(gas(), target, add(payload, 32), mload(payload), 0, 0))
        }
    }

    function log(string memory s) internal view {
        _send(abi.encodeWithSignature("log(string)", s));
    }

    function log(string memory s, address a) internal view {
        _send(abi.encodeWithSignature("log(string,address)", s, a));
    }

    function log(string memory s, uint256 v) internal view {
        _send(abi.encodeWithSignature("log(string,uint256)", s, v));
    }

    function log(string memory s, bytes32 v) internal view {
        _send(abi.encodeWithSignature("log(string,bytes32)", s, v));
    }
}

abstract contract CheatsUser {
    Vm internal constant vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
}
