// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {BatchRelayer} from "../src/BatchRelayer.sol";

interface IUSDC {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function allowance(address, address) external view returns (uint256);
}

/// @dev Runs against a live Base fork. Measures the marginal L2 execution gas
/// of one USDC transfer inside a batch vs a standalone transfer tx, and checks
/// Circle-USDC allowance behaviour under an unlimited approval.
/// Usage: forge test --match-contract BatchRelayerBaseForkTest -vvv
contract BatchRelayerBaseForkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WHALE = 0x1887FA9EdADeaB7562B01CC3F4FA246AcE2c3Cdd; // ~544k USDC
    uint256 constant AMOUNT = 25_500_000; // 25.50 USDC

    BatchRelayer relayer;
    address relayerOwner = makeAddr("relayerOwner");

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org")));
        vm.prank(relayerOwner);
        relayer = new BatchRelayer();
        vm.prank(WHALE);
        IUSDC(USDC).approve(address(relayer), type(uint256).max);
    }

    function test_MeasureBatchMarginalGasColdRecipients() public {
        vm.prank(WHALE);
        uint256 g0 = gasleft();
        IUSDC(USDC).transfer(makeAddr("standalone"), AMOUNT);
        uint256 standaloneCall = g0 - gasleft();
        console2.log("standalone USDC transfer, exec-only (no 21k intrinsic):", standaloneCall);

        uint256 g1 = _batch(1, 0);
        uint256 g11 = _batch(11, 0);
        uint256 g21 = _batch(21, 0);
        console2.log("batch N=1  gasleft-delta :", g1);
        console2.log("batch N=11 gasleft-delta :", g11);
        console2.log("batch N=21 gasleft-delta :", g21);
        console2.log("marginal per item (11-1)/10  :", (g11 - g1) / 10);
        console2.log("marginal per item (21-11)/10 :", (g21 - g11) / 10);
    }

    function test_MeasureBatchMarginalGasWarmRecipients() public {
        address[4] memory warm;
        for (uint256 i = 0; i < 4; i++) {
            warm[i] = makeAddr(string.concat("warm", vm.toString(i)));
            vm.prank(WHALE);
            IUSDC(USDC).transfer(warm[i], AMOUNT);
        }

        uint256 g1 = _batch(1, 1);
        uint256 g11 = _batch(11, 1);
        uint256 g21 = _batch(21, 1);
        console2.log("warm: batch N=1  gasleft-delta :", g1);
        console2.log("warm: batch N=11 gasleft-delta :", g11);
        console2.log("warm: batch N=21 gasleft-delta :", g21);
        console2.log("warm: marginal per item (11-1)/10 :", (g11 - g1) / 10);
        console2.log("warm: marginal per item (21-11)/10 :", (g21 - g11) / 10);
    }

    function test_AllowanceBehaviorUnderUnlimitedApproval() public {
        address to = makeAddr("postbatch");
        uint256 before = IUSDC(USDC).allowance(WHALE, address(relayer));
        address[] memory recipients = new address[](3);
        uint256[] memory amounts = new uint256[](3);
        for (uint256 i = 0; i < 3; i++) {
            recipients[i] = makeAddr(string.concat("allow", vm.toString(i)));
            amounts[i] = AMOUNT;
        }
        vm.prank(relayerOwner);
        relayer.batchTransferFrom(USDC, WHALE, recipients, amounts);
        uint256 post = IUSDC(USDC).allowance(WHALE, address(relayer));
        console2.log("allowance before:", before);
        console2.log("allowance after :", post);
        console2.log("unlimited approval eroded by batch:", post != before);
    }

    function _batch(uint256 count, uint8 mode) internal returns (uint256 used) {
        address[] memory recipients = new address[](count);
        uint256[] memory amounts = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            recipients[i] = mode == 0
                ? makeAddr(string.concat("cold", vm.toString(i), vm.toString(_salt())))
                : makeAddr(string.concat("warm", vm.toString(i % 4)));
            amounts[i] = AMOUNT;
        }
        vm.prank(relayerOwner);
        uint256 g0 = gasleft();
        relayer.batchTransferFrom(USDC, WHALE, recipients, amounts);
        used = g0 - gasleft();
    }

    uint256 private _saltCounter;

    function _salt() internal returns (uint256) {
        return ++_saltCounter;
    }
}
