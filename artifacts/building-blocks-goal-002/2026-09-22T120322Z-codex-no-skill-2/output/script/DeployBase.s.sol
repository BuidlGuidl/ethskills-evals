// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { BaseDeployConfig } from "../src/BaseDeployConfig.sol";
import { IERC20 } from "../src/interfaces/IERC20.sol";
import { INonfungiblePositionManager } from "../src/interfaces/INonfungiblePositionManager.sol";
import { ISwapRouter } from "../src/interfaces/ISwapRouter.sol";
import { IYieldStrategy, YieldVault } from "../src/YieldVault.sol";
import { UniswapV3UsdcWethStrategy } from "../src/UniswapV3UsdcWethStrategy.sol";

interface Vm {
    function envUint(string calldata key) external returns (uint256);
    function envAddress(string calldata key) external returns (address);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployBase {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (YieldVault vault, UniswapV3UsdcWethStrategy strategy) {
        require(block.chainid == BaseDeployConfig.BASE_CHAIN_ID, "BASE_ONLY");

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address keeper = vm.envAddress("KEEPER");
        address owner = vm.envAddress("OWNER");

        vm.startBroadcast(deployerKey);

        vault = new YieldVault(
            IERC20(BaseDeployConfig.USDC), "Base USDC/WETH Yield Vault", "byvUSDC", deployer
        );
        strategy = new UniswapV3UsdcWethStrategy(
            IERC20(BaseDeployConfig.USDC),
            IERC20(BaseDeployConfig.WETH),
            ISwapRouter(BaseDeployConfig.UNISWAP_V3_SWAP_ROUTER),
            INonfungiblePositionManager(BaseDeployConfig.UNISWAP_V3_POSITION_MANAGER),
            address(vault),
            keeper,
            owner,
            BaseDeployConfig.USDC_WETH_POOL_FEE,
            BaseDeployConfig.FULL_RANGE_TICK_LOWER,
            BaseDeployConfig.FULL_RANGE_TICK_UPPER
        );
        vault.setStrategy(IYieldStrategy(address(strategy)));
        if (owner != deployer) vault.transferOwnership(owner);

        vm.stopBroadcast();
    }
}
