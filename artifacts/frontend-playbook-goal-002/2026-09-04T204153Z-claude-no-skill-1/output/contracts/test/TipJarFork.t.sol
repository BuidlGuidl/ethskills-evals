// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TipJar} from "../src/TipJar.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/**
 * @notice Exercises the jar against the real USDC contract on Base.
 * @dev Needs an RPC, so the whole suite no-ops unless BASE_RPC_URL is set:
 *      BASE_RPC_URL=https://mainnet.base.org forge test --match-path test/TipJarFork.t.sol
 */
contract TipJarForkTest is Test {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    IERC20 internal usdc = IERC20(BASE_USDC);
    TipJar internal jar;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;

        vm.createSelectFork(rpc);
        forked = true;
        jar = new TipJar(BASE_USDC, owner);
        _mintUsdc(alice, 1_000e6);
    }

    /// @dev Grants ourselves minting rights through USDC's own masterMinter, which is
    ///      stable across blocks, unlike picking a whale that may move its funds.
    function _mintUsdc(address to, uint256 amount) internal {
        address masterMinter = _readAddress("masterMinter()");
        vm.prank(masterMinter);
        (bool ok,) = BASE_USDC.call(abi.encodeWithSignature("configureMinter(address,uint256)", address(this), amount));
        require(ok, "configureMinter failed");

        (ok,) = BASE_USDC.call(abi.encodeWithSignature("mint(address,uint256)", to, amount));
        require(ok, "mint failed");
    }

    function _readAddress(string memory sig) internal view returns (address) {
        (bool ok, bytes memory ret) = BASE_USDC.staticcall(abi.encodeWithSignature(sig));
        require(ok, "static call failed");
        return abi.decode(ret, (address));
    }

    function test_fork_realUSDCMetadata() public view {
        if (!forked) return;
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.symbol(), "USDC");
        assertEq(address(jar.token()), BASE_USDC);
    }

    function test_fork_tipWithRealUSDC() public {
        if (!forked) return;

        vm.startPrank(alice);
        usdc.approve(address(jar), 25e6);
        uint256 index = jar.tip(25e6, "gm from the fork");
        vm.stopPrank();

        assertEq(index, 0);
        assertEq(usdc.balanceOf(address(jar)), 25e6);
        assertEq(jar.totalTipped(), 25e6);

        TipJar.Tip memory t = jar.getTip(0);
        assertEq(t.sender, alice);
        assertEq(t.amount, 25e6);
        assertEq(t.message, "gm from the fork");
    }

    function test_fork_ownerWithdrawsRealUSDC() public {
        if (!forked) return;

        vm.startPrank(alice);
        usdc.approve(address(jar), 40e6);
        jar.tip(40e6, "for the coffee");
        vm.stopPrank();

        vm.prank(owner);
        uint256 amount = jar.withdrawAll(owner);

        assertEq(amount, 40e6);
        assertEq(usdc.balanceOf(owner), 40e6);
        assertEq(jar.balance(), 0);
    }

    function test_fork_tipFailsWithoutApproval() public {
        if (!forked) return;

        vm.prank(alice);
        vm.expectRevert(TipJar.TransferFailed.selector);
        jar.tip(1e6, "no approval");
    }
}
