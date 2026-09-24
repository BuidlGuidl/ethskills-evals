// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice The slice of Foundry's cheatcode interface this project uses.
/// Declared locally so `forge test` and `forge script` work with nothing
/// installed under lib/.
interface Vm {
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert() external;
    function label(address addr, string calldata newLabel) external;
    function envAddress(string calldata name) external view returns (address);
    function envUint(string calldata name) external view returns (uint256);
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @dev Deterministic address of the Foundry cheatcode precompile.
address constant VM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
