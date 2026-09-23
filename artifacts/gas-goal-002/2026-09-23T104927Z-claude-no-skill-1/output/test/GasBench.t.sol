// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {BatchPay, IERC20} from "../src/BatchPay.sol";

/**
 * Gas benchmarks against real USDC on a Base fork.
 *
 * `vm.lastCallGas().gasTotalUsed` reports the FULL transaction gas for a top-level
 * call: intrinsic 21,000 + calldata + execution. This is verified by
 * `test_00_HarnessMatchesMainnet`, which reproduces gas figures observed in real
 * Base transactions exactly. Nothing is added on top of it by hand.
 */
contract GasBench is Test {
    IERC20 constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    uint256 constant FORK_BLOCK = 51685756;
    uint256 constant AMOUNT = 5_000_000; // 5 USDC

    BatchPay pay;
    address relayer = makeAddr("relayer");
    address owner = makeAddr("owner");
    uint256 salt;

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_RPC_URL"), FORK_BLOCK);
        pay = new BatchPay(owner, relayer);
        deal(address(USDC), relayer, 100_000_000e6);
        deal(address(USDC), address(pay), 100_000_000e6);
        vm.prank(relayer);
        (bool ok,) = address(USDC).call(
            abi.encodeWithSignature("approve(address,uint256)", address(pay), type(uint256).max)
        );
        require(ok, "approve failed");
    }

    /* ------------------------------------------------------------- helpers */

    /// @dev Fresh recipient set each call (salted), so no measurement inherits
    ///      warm slots or balances seeded by a previous one.
    function _recipients(uint256 n, uint256 freshPct)
        internal
        returns (address[] memory to, uint256[] memory amt)
    {
        uint256 s = ++salt;
        to = new address[](n);
        amt = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            to[i] = address(uint160(uint256(keccak256(abi.encode("payee", s, i)))));
            amt[i] = AMOUNT + i;
            // Deterministic interleave so any n has ~freshPct new payees.
            if ((i * 100) / n % 100 >= freshPct) deal(address(USDC), to[i], 1e6);
        }
    }

    function _pack(address[] memory to, uint256[] memory amt) internal pure returns (bytes memory p) {
        for (uint256 i; i < to.length; ++i) {
            p = abi.encodePacked(p, bytes20(to[i]), bytes12(uint96(amt[i])));
        }
    }

    /* ------------------------------------------- 0. harness validation */

    function test_00_HarnessMatchesMainnet() public {
        address existing = makeAddr("existingPayee");
        deal(address(USDC), existing, 1e6);
        vm.prank(relayer);
        USDC.transfer(existing, AMOUNT);
        uint256 gExisting = vm.lastCallGas().gasTotalUsed;

        address fresh = makeAddr("brandNewPayee");
        vm.prank(relayer);
        USDC.transfer(fresh, AMOUNT);
        uint256 gFresh = vm.lastCallGas().gasTotalUsed;

        console2.log("existing payee : harness", gExisting, "| mainnet 45059");
        console2.log("new payee      : harness", gFresh, "| mainnet 62159");
        assertEq(gExisting, 45_059, "existing-payee gas drifted from mainnet");
        assertEq(gFresh, 62_159, "new-payee gas drifted from mainnet");
    }

    /* --------------------------------------------- 1. batch scaling */

    function _benchFloat(uint256 n, uint256 freshPct) internal returns (uint256) {
        (address[] memory to, uint256[] memory amt) = _recipients(n, freshPct);
        bytes memory payload = _pack(to, amt);
        vm.prank(relayer);
        pay.payFromBalancePacked(USDC, payload);
        return vm.lastCallGas().gasTotalUsed;
    }

    function _benchRelayer(uint256 n, uint256 freshPct) internal returns (uint256) {
        (address[] memory to, uint256[] memory amt) = _recipients(n, freshPct);
        bytes memory payload = _pack(to, amt);
        vm.prank(relayer);
        pay.payFromRelayerPacked(USDC, payload);
        return vm.lastCallGas().gasTotalUsed;
    }

    function test_01_BatchScaling_Float() public {
        uint256[6] memory sizes = [uint256(1), 10, 25, 50, 100, 250];
        for (uint256 freshIdx; freshIdx < 3; ++freshIdx) {
            uint256 freshPct = [uint256(0), 36, 100][freshIdx];
            console2.log("--- float mode, new-payee share (%) =", freshPct);
            for (uint256 i; i < sizes.length; ++i) {
                uint256 g = _benchFloat(sizes[i], freshPct);
                console2.log("   n =", sizes[i], "gas/payment =", g / sizes[i]);
            }
        }
    }

    function test_02_BatchScaling_Relayer() public {
        uint256[4] memory sizes = [uint256(1), 25, 100, 250];
        for (uint256 freshIdx; freshIdx < 2; ++freshIdx) {
            uint256 freshPct = [uint256(0), 36][freshIdx];
            console2.log("--- relayer/transferFrom mode, new-payee share (%) =", freshPct);
            for (uint256 i; i < sizes.length; ++i) {
                uint256 g = _benchRelayer(sizes[i], freshPct);
                console2.log("   n =", sizes[i], "gas/payment =", g / sizes[i]);
            }
        }
    }

    /* ---------------------------------- 2. marginal cost of one payment */

    function test_03_MarginalGasPerPayment() public {
        for (uint256 freshIdx; freshIdx < 2; ++freshIdx) {
            uint256 freshPct = [uint256(0), 100][freshIdx];
            uint256 g100 = _benchFloat(100, freshPct);
            uint256 g200 = _benchFloat(200, freshPct);
            console2.log("new-payee share (%) =", freshPct);
            console2.log("   marginal gas per extra payment =", (g200 - g100) / 100);
        }
    }

    /* --------------------------- 3. packed payload vs plain ABI arrays */

    function test_04_PackedVsAbiArrays() public {
        uint256 n = 100;
        (address[] memory a, uint256[] memory b) = _recipients(n, 36);
        bytes memory dArrays = abi.encodeCall(BatchPay.payFromBalance, (USDC, a, b));
        vm.prank(relayer);
        pay.payFromBalance(USDC, a, b);
        uint256 gArrays = vm.lastCallGas().gasTotalUsed;

        (address[] memory c, uint256[] memory d) = _recipients(n, 36);
        bytes memory payload = _pack(c, d);
        bytes memory dPacked = abi.encodeCall(BatchPay.payFromBalancePacked, (USDC, payload));
        vm.prank(relayer);
        pay.payFromBalancePacked(USDC, payload);
        uint256 gPacked = vm.lastCallGas().gasTotalUsed;

        console2.log("n=100 abi-arrays: calldata bytes", dArrays.length, "total gas", gArrays);
        console2.log("n=100 packed    : calldata bytes", dPacked.length, "total gas", gPacked);
        console2.log("L2 gas saved by packing:", gArrays - gPacked);
        console2.log("calldata bytes saved   :", dArrays.length - dPacked.length);
    }
}
