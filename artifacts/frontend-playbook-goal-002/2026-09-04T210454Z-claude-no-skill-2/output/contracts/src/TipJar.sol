// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice The subset of ERC-20 the tip jar relies on.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/// @title TipJar
/// @notice Collects ERC-20 tips (USDC on Base) together with a short public message,
///         and keeps the tip feed onchain so a frontend can render it without an indexer.
/// @dev Tips are recorded in an append-only array. `latestTips` serves the feed newest-first.
contract TipJar {
    /// @param sender Account that paid the tip.
    /// @param amount Token amount actually received, in token base units (USDC: 6 decimals).
    /// @param timestamp Block timestamp of the tip.
    /// @param message Public note attached to the tip, at most `MAX_MESSAGE_BYTES` bytes.
    struct Tip {
        address sender;
        uint96 amount;
        uint64 timestamp;
        string message;
    }

    /// @notice Longest message a tip may carry, in bytes (not characters).
    uint256 public constant MAX_MESSAGE_BYTES = 140;

    /// @notice Largest single tip the packed `Tip.amount` field can hold.
    /// @dev ~7.9e28 base units, i.e. ~7.9e22 USDC. Far above any real tip.
    uint256 public constant MAX_TIP = type(uint96).max;

    /// @notice Token tips are denominated in. On Base this is USDC.
    IERC20 public immutable token;

    /// @notice Account allowed to withdraw the jar's balance.
    address public owner;

    /// @notice Account that has been offered ownership and may `acceptOwnership`.
    address public pendingOwner;

    /// @notice Lifetime sum of every tip received, in token base units.
    uint256 public totalTipped;

    /// @notice Lifetime sum of the tips paid by an account, in token base units.
    mapping(address => uint256) public tippedBy;

    Tip[] private _tips;

    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _reentrancyStatus = NOT_ENTERED;

    event Tipped(uint256 indexed id, address indexed sender, uint256 amount, string message, uint64 timestamp);
    event Withdrawal(address indexed to, uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAddress();
    error ZeroAmount();
    error MessageTooLong(uint256 length, uint256 max);
    error TipTooLarge(uint256 amount, uint256 max);
    error NotOwner(address caller);
    error NotPendingOwner(address caller);
    error InsufficientBalance(uint256 requested, uint256 available);
    error TransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == ENTERED) revert Reentrancy();
        _reentrancyStatus = ENTERED;
        _;
        _reentrancyStatus = NOT_ENTERED;
    }

    /// @param token_ ERC-20 accepted as tips (Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).
    /// @param owner_ Account allowed to withdraw collected tips.
    constructor(IERC20 token_, address owner_) {
        if (address(token_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        token = token_;
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    /// @notice Send a tip. The caller must have approved this contract for at least `amount` first.
    /// @param amount Amount to tip, in token base units (USDC: 1000000 == 1 USDC).
    /// @param message Public note shown in the feed. May be empty.
    /// @return id Index of the recorded tip.
    function tip(uint256 amount, string calldata message) external nonReentrant returns (uint256 id) {
        if (amount == 0) revert ZeroAmount();
        if (amount > MAX_TIP) revert TipTooLarge(amount, MAX_TIP);
        if (bytes(message).length > MAX_MESSAGE_BYTES) {
            revert MessageTooLong(bytes(message).length, MAX_MESSAGE_BYTES);
        }

        // Record what the jar actually received rather than what was asked for, so the feed
        // stays truthful even for tokens that take a cut on transfer.
        uint256 balanceBefore = token.balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();
        if (received > MAX_TIP) revert TipTooLarge(received, MAX_TIP);

        uint64 timestamp = uint64(block.timestamp);
        id = _tips.length;
        // casting to `uint96` is safe: `received` was just checked against MAX_TIP == type(uint96).max
        // forge-lint: disable-next-line(unsafe-typecast)
        _tips.push(Tip({sender: msg.sender, amount: uint96(received), timestamp: timestamp, message: message}));

        totalTipped += received;
        tippedBy[msg.sender] += received;

        emit Tipped(id, msg.sender, received, message, timestamp);
    }

    /// @notice Number of tips recorded so far.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice Read a single tip by index.
    function getTip(uint256 id) external view returns (Tip memory) {
        return _tips[id];
    }

    /// @notice Read a page of the feed in the order tips arrived, oldest first.
    /// @param offset Index to start from. An offset past the end returns an empty page.
    /// @param limit Maximum number of tips to return.
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

    /// @notice Read the newest tips first — what the frontend feed renders.
    /// @param limit Maximum number of tips to return.
    function latestTips(uint256 limit) external view returns (Tip[] memory page) {
        uint256 total = _tips.length;
        uint256 size = limit < total ? limit : total;
        page = new Tip[](size);
        for (uint256 i = 0; i < size; ++i) {
            page[i] = _tips[total - 1 - i];
        }
    }

    /// @notice Tokens currently held by the jar and available to withdraw.
    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice Withdraw part of the jar to `to`.
    function withdraw(address to, uint256 amount) public onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 available = balance();
        if (amount > available) revert InsufficientBalance(amount, available);

        _safeTransfer(to, amount);
        emit Withdrawal(to, amount);
    }

    /// @notice Withdraw the jar's entire balance to `to`.
    function withdrawAll(address to) external returns (uint256 amount) {
        amount = balance();
        withdraw(to, amount);
    }

    /// @notice Offer ownership to `newOwner`, who must call `acceptOwnership` to take it.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Accept an ownership offer made to the caller.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner(msg.sender);
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    /// @dev ERC-20 transfer that accepts both `bool`-returning and return-nothing tokens.
    function _safeTransfer(address to, uint256 amount) private {
        _call(abi.encodeCall(IERC20.transfer, (to, amount)));
    }

    /// @dev ERC-20 transferFrom that accepts both `bool`-returning and return-nothing tokens.
    function _safeTransferFrom(address from, address to, uint256 amount) private {
        _call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
    }

    function _call(bytes memory data) private {
        (bool ok, bytes memory returndata) = address(token).call(data);
        if (!ok) {
            // Surface the token's own revert reason when it gave one.
            if (returndata.length > 0) {
                assembly {
                    revert(add(returndata, 0x20), mload(returndata))
                }
            }
            revert TransferFailed();
        }
        if (returndata.length != 0 && !abi.decode(returndata, (bool))) revert TransferFailed();
    }
}
