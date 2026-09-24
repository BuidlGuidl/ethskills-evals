// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BatchTransfer} from "../contracts/BatchTransfer.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public blocked;

    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function block_(address a, bool b) external { blocked[a] = b; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }

    function transfer(address to, uint256 a) public virtual returns (bool) {
        require(!blocked[to] && !blocked[msg.sender], "blocked");
        require(balanceOf[msg.sender] >= a, "balance");
        balanceOf[msg.sender] -= a; balanceOf[to] += a; return true;
    }

    function transferFrom(address f, address to, uint256 a) external returns (bool) {
        require(!blocked[to] && !blocked[f], "blocked");
        require(balanceOf[f] >= a, "balance");
        uint256 al = allowance[f][msg.sender];
        require(al >= a, "allowance");
        if (al != type(uint256).max) allowance[f][msg.sender] = al - a;
        balanceOf[f] -= a; balanceOf[to] += a; return true;
    }
}

/// Returns false instead of reverting, like some non-compliant tokens.
contract FalseReturningERC20 is MockERC20 {
    function transfer(address, uint256) public pure override returns (bool) { return false; }
}

/// Returns no data at all, like USDT on mainnet.
contract VoidERC20 {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function transfer(address to, uint256 a) external {
        require(balanceOf[msg.sender] >= a, "balance");
        balanceOf[msg.sender] -= a; balanceOf[to] += a;
    }
}

contract BatchTransferTest is Test {
    BatchTransfer bt;
    MockERC20 token;
    address owner = address(0xA11CE);
    address relayer = address(0xBEEF);
    address funder = address(0xF00D);

    function setUp() public {
        bt = new BatchTransfer(owner, relayer);
        token = new MockERC20();
    }

    function _pack(address[] memory to, uint96[] memory amt) internal pure returns (bytes memory b) {
        for (uint256 i = 0; i < to.length; i++) {
            b = bytes.concat(b, bytes20(to[i]), bytes12(amt[i]));
        }
    }

    function _simple(uint256 n) internal pure returns (address[] memory to, uint96[] memory amt) {
        to = new address[](n); amt = new uint96[](n);
        for (uint256 i = 0; i < n; i++) { to[i] = address(uint160(0x1000 + i)); amt[i] = uint96((i + 1) * 100); }
    }

    // ---- float model --------------------------------------------------------

    function test_payout_movesExactAmounts() public {
        (address[] memory to, uint96[] memory amt) = _simple(5);
        token.mint(address(bt), 10_000);
        vm.prank(relayer);
        bt.payout(address(token), _pack(to, amt));
        for (uint256 i = 0; i < 5; i++) assertEq(token.balanceOf(to[i]), amt[i], "recipient balance");
    }

    function test_payout_onlyRelayer() public {
        (address[] memory to, uint96[] memory amt) = _simple(1);
        vm.expectRevert(BatchTransfer.NotRelayer.selector);
        bt.payout(address(token), _pack(to, amt));
    }

    function test_payout_rejectsMalformedBlob() public {
        token.mint(address(bt), 10_000);
        vm.prank(relayer);
        vm.expectRevert(BatchTransfer.MalformedPayouts.selector);
        bt.payout(address(token), hex"1234");
    }

    function test_payout_emptyBlobIsNoop() public {
        vm.prank(relayer);
        bt.payout(address(token), "");
    }

    /// The index in the revert is what the relayer's preflight uses to drop a
    /// single bad payout, so it has to be exact.
    function test_payout_revertsWithFailingIndex() public {
        (address[] memory to, uint96[] memory amt) = _simple(4);
        token.mint(address(bt), 10_000);
        token.block_(to[2], true);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.TransferFailed.selector, 2));
        bt.payout(address(token), _pack(to, amt));
    }

    function test_payout_revertsOnInsufficientFloat() public {
        (address[] memory to, uint96[] memory amt) = _simple(3);
        token.mint(address(bt), 150); // enough for payout 0 only
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.TransferFailed.selector, 1));
        bt.payout(address(token), _pack(to, amt));
    }

    function test_payout_treatsFalseReturnAsFailure() public {
        FalseReturningERC20 bad = new FalseReturningERC20();
        (address[] memory to, uint96[] memory amt) = _simple(1);
        bad.mint(address(bt), 10_000);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.TransferFailed.selector, 0));
        bt.payout(address(bad), _pack(to, amt));
    }

    function test_payout_acceptsVoidReturningToken() public {
        VoidERC20 usdtLike = new VoidERC20();
        (address[] memory to, uint96[] memory amt) = _simple(2);
        usdtLike.mint(address(bt), 10_000);
        vm.prank(relayer);
        bt.payout(address(usdtLike), _pack(to, amt));
        assertEq(usdtLike.balanceOf(to[1]), amt[1]);
    }

    /// An EOA has no code, so a raw call to it succeeds with empty returndata.
    /// Without a code check that would look like a successful transfer.
    function test_payout_revertsOnTokenWithNoCode() public {
        (address[] memory to, uint96[] memory amt) = _simple(1);
        vm.prank(relayer);
        vm.expectRevert(BatchTransfer.NotAContract.selector);
        bt.payout(address(0xDEAD), _pack(to, amt));
    }

    // ---- pull model ---------------------------------------------------------

    function test_payoutFrom_pullsFromFunder() public {
        (address[] memory to, uint96[] memory amt) = _simple(3);
        token.mint(funder, 10_000);
        vm.prank(funder);
        token.approve(address(bt), type(uint256).max);
        vm.prank(relayer);
        bt.payoutFrom(address(token), funder, _pack(to, amt));
        for (uint256 i = 0; i < 3; i++) assertEq(token.balanceOf(to[i]), amt[i]);
    }

    function test_payoutFrom_revertsWithoutAllowance() public {
        (address[] memory to, uint96[] memory amt) = _simple(1);
        token.mint(funder, 10_000);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(BatchTransfer.TransferFailed.selector, 0));
        bt.payoutFrom(address(token), funder, _pack(to, amt));
    }

    // ---- admin --------------------------------------------------------------

    function test_setRelayer_onlyOwner() public {
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        bt.setRelayer(address(1), true);
        vm.prank(owner);
        bt.setRelayer(address(1), true);
        assertTrue(bt.isRelayer(address(1)));
    }

    function test_sweep_onlyOwner() public {
        token.mint(address(bt), 500);
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        bt.sweep(address(token), owner, 500);
        vm.prank(owner);
        bt.sweep(address(token), owner, 500);
        assertEq(token.balanceOf(owner), 500);
    }

    function test_ownershipTransferIsTwoStep() public {
        address next = address(0xDEE7);
        vm.prank(owner);
        bt.transferOwnership(next);
        assertEq(bt.owner(), owner, "owner unchanged until accepted");

        vm.expectRevert(BatchTransfer.NotOwner.selector);
        bt.acceptOwnership(); // wrong caller

        vm.prank(next);
        bt.acceptOwnership();
        assertEq(bt.owner(), next);
        assertEq(bt.pendingOwner(), address(0));
    }

    function test_ownershipTransferCanBeCancelled() public {
        address next = address(0xBEEF1);
        vm.startPrank(owner);
        bt.transferOwnership(next);
        bt.transferOwnership(address(0));
        vm.stopPrank();
        vm.prank(next);
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        bt.acceptOwnership();
    }

    function test_transferOwnership_onlyOwner() public {
        vm.expectRevert(BatchTransfer.NotOwner.selector);
        bt.transferOwnership(address(1));
    }

    // ---- encoding -----------------------------------------------------------

    /// Decoding must survive arbitrary addresses and the full uint96 range.
    function testFuzz_decodesPackedWord(address to, uint96 amt) public {
        vm.assume(to != address(0) && to != address(bt) && amt > 0);
        address[] memory t = new address[](1); t[0] = to;
        uint96[] memory a = new uint96[](1); a[0] = amt;
        token.mint(address(bt), type(uint96).max);
        uint256 before = token.balanceOf(to);
        vm.prank(relayer);
        bt.payout(address(token), _pack(t, a));
        assertEq(token.balanceOf(to) - before, amt);
    }
}
