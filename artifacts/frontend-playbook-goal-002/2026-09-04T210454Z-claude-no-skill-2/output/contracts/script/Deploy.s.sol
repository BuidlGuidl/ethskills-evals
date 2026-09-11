// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {TipJar, IERC20} from "../src/TipJar.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Deploys the tip jar to a local chain and records the addresses for the web app.
/// @dev Picks the tip token in this order:
///      1. `USDC_ADDRESS` from the environment, if set.
///      2. Base USDC, when there is already code at that address — i.e. an `anvil --fork-url` chain.
///      3. A freshly deployed `MockUSDC`, pre-funding the default anvil accounts — plain `anvil`.
contract Deploy is Script {
    /// @notice Canonical USDC on Base mainnet.
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    /// @dev Anvil's well-known account #0 key. Public test key; local chains only.
    uint256 internal constant DEFAULT_ANVIL_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    /// @dev Amount of MockUSDC handed to each default anvil account, so you can tip immediately.
    uint256 internal constant FAUCET_AMOUNT = 10_000e6;

    function run() external returns (TipJar jar, address token) {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", DEFAULT_ANVIL_KEY);
        address deployer = vm.addr(deployerKey);
        address jarOwner = vm.envOr("TIP_JAR_OWNER", deployer);

        vm.startBroadcast(deployerKey);

        token = vm.envOr("USDC_ADDRESS", address(0));
        bool mock = false;
        if (token == address(0)) {
            if (BASE_USDC.code.length > 0) {
                token = BASE_USDC;
            } else {
                token = address(new MockUSDC());
                mock = true;
            }
        }

        jar = new TipJar(IERC20(token), jarOwner);

        if (mock) {
            for (uint256 i = 0; i < _anvilAccounts().length; ++i) {
                MockUSDC(token).mint(_anvilAccounts()[i], FAUCET_AMOUNT);
            }
        }

        vm.stopBroadcast();

        _report(jar, token, jarOwner, deployer, mock);
        _writeDeployment(address(jar), token, jarOwner, mock);
    }

    function _report(TipJar jar, address token, address jarOwner, address deployer, bool mock) private view {
        console2.log("chain id     ", block.chainid);
        console2.log("deployer     ", deployer);
        console2.log("tip jar      ", address(jar));
        console2.log("jar owner    ", jarOwner);
        console2.log("tip token    ", token);
        console2.log("token kind   ", mock ? "MockUSDC (local faucet)" : "existing USDC");
    }

    /// @dev Writes `deployments/<chainId>.json`, which `npm run deploy:local` turns into web/.env.local.
    function _writeDeployment(address jar, address token, address jarOwner, bool mock) private {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "tipJar": "',
            vm.toString(jar),
            '",\n',
            '  "token": "',
            vm.toString(token),
            '",\n',
            '  "owner": "',
            vm.toString(jarOwner),
            '",\n',
            '  "mockToken": ',
            mock ? "true" : "false",
            "\n}\n"
        );
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeFile(path, json);
        console2.log("wrote        ", path);
    }

    /// @dev The ten accounts anvil unlocks by default.
    function _anvilAccounts() private pure returns (address[10] memory accounts) {
        accounts = [
            0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
            0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
            0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,
            0x90F79bf6EB2c4f870365E785982E1f101E93b906,
            0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65,
            0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc,
            0x976EA74026E726554dB657fA54763abd0C3a0aa9,
            0x14dC79964da2C08b23698B3D3cc7Ca32193d9955,
            0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f,
            0xa0Ee7A142d267C1f36714E4a8F75612F20a79720
        ];
    }
}
