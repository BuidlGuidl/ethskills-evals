// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ForkVm {
    function envOr(string calldata name, string calldata defaultValue)
        external
        view
        returns (string memory);
    function createSelectFork(string calldata urlOrAlias) external returns (uint256 forkId);
}

interface IERC20Metadata {
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}

contract BaseUsdcForkTest {
    ForkVm private constant vm = ForkVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function testBaseUsdcAddressWhenRpcIsConfigured() public {
        string memory rpcUrl = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            return;
        }

        vm.createSelectFork(rpcUrl);
        IERC20Metadata usdc = IERC20Metadata(BASE_USDC);

        require(usdc.decimals() == 6, "USDC decimals changed");
        require(keccak256(bytes(usdc.symbol())) == keccak256("USDC"), "USDC symbol changed");
    }
}
