// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/**
 * @title TipJar
 * @notice Collects ERC-20 tips (USDC on Base) together with a short public message,
 *         and keeps the full tip history onchain so a frontend can render a feed
 *         without relying on log indexing.
 * @dev The token is fixed at deployment. On Base that is the canonical USDC at
 *      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals).
 */
contract TipJar {
    struct Tip {
        address sender;
        uint128 amount; // token units received (USDC has 6 decimals)
        uint64 timestamp; // block timestamp of the tip
        string message;
    }

    /// @notice Longest tip message accepted, in bytes.
    uint256 public constant MAX_MESSAGE_BYTES = 200;

    /// @notice Token accepted by this jar (USDC on Base).
    IERC20 public immutable token;

    /// @notice Account allowed to withdraw collected tips.
    address public owner;

    /// @notice Sum of every tip ever received.
    uint256 public totalTipped;

    /// @notice Running total contributed per address.
    mapping(address => uint256) public tippedBy;

    Tip[] private _tips;

    uint256 private _locked = 1;

    event TipReceived(uint256 indexed index, address indexed sender, uint256 amount, string message, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();
    error TokenNotAContract();
    error ZeroAmount();
    error AmountTooLarge();
    error MessageTooLong();
    error NothingToWithdraw();
    error TransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    /**
     * @param token_ ERC-20 accepted as tips (USDC on Base).
     * @param owner_ Account allowed to withdraw the balance.
     */
    constructor(address token_, address owner_) {
        if (token_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        // The token is immutable, so a wrong address here would brick the jar permanently.
        if (token_.code.length == 0) revert TokenNotAContract();
        token = IERC20(token_);
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    /**
     * @notice Send a tip. The sender must `approve` this contract for `amount` first.
     * @param amount Token units to tip (1 USDC = 1_000_000).
     * @param message Public note attached to the tip; may be empty.
     * @return index Position of the new tip in the feed.
     * @dev The amount recorded is the balance actually received, so a token that
     *      takes a transfer fee can never make the stored history overstate the jar.
     */
    function tip(uint256 amount, string calldata message) external nonReentrant returns (uint256 index) {
        if (amount == 0) revert ZeroAmount();
        if (bytes(message).length > MAX_MESSAGE_BYTES) revert MessageTooLong();

        uint256 balanceBefore = token.balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();
        if (received > type(uint128).max) revert AmountTooLarge();

        index = _tips.length;
        // `received` is bounded by the check above and uint64 holds block timestamps
        // for the next ~584 billion years.
        _tips.push(
            // forge-lint: disable-next-line(unsafe-typecast)
            Tip({sender: msg.sender, amount: uint128(received), timestamp: uint64(block.timestamp), message: message})
        );

        totalTipped += received;
        tippedBy[msg.sender] += received;

        emit TipReceived(index, msg.sender, received, message, block.timestamp);
    }

    /// @notice Number of tips in the feed.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice Current withdrawable balance held by the jar.
    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @notice Read a page of the feed in chronological order.
     * @param offset Index of the first tip to return.
     * @param limit Maximum number of tips to return.
     * @dev Returns an empty array once `offset` is past the end, and a short array
     *      on the last page, so callers never need to clamp `limit` themselves.
     */
    function getTips(uint256 offset, uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = _tips.length;
        if (offset >= total || limit == 0) return new Tip[](0);

        uint256 available = total - offset;
        uint256 size = limit < available ? limit : available;
        page = new Tip[](size);
        for (uint256 i = 0; i < size; ++i) {
            page[i] = _tips[offset + i];
        }
    }

    /**
     * @notice Read the newest tips first, which is the order the feed renders.
     * @param limit Maximum number of tips to return.
     */
    function getRecentTips(uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = _tips.length;
        if (total == 0 || limit == 0) return new Tip[](0);

        uint256 size = limit < total ? limit : total;
        page = new Tip[](size);
        for (uint256 i = 0; i < size; ++i) {
            page[i] = _tips[total - 1 - i];
        }
    }

    /// @notice Read a single tip by index.
    function getTip(uint256 index) external view returns (Tip memory) {
        return _tips[index];
    }

    /// @notice Move `amount` of collected tips to `to`.
    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Move the entire balance to `to`.
    function withdrawAll(address to) external onlyOwner nonReentrant returns (uint256 amount) {
        if (to == address(0)) revert ZeroAddress();
        amount = token.balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();
        _safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Hand the jar to a new owner.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    /// @dev ERC-20 call helper that treats an empty return value as success, since
    ///      some tokens (notably older USDT-style deployments) return nothing.
    function _safeTransfer(address to, uint256 amount) private {
        _call(abi.encodeCall(IERC20.transfer, (to, amount)));
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        _call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
    }

    function _call(bytes memory data) private {
        (bool ok, bytes memory ret) = address(token).call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
