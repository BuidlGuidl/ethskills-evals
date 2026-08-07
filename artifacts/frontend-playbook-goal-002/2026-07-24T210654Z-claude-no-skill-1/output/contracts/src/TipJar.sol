// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface for the parts of ERC-20 the tip jar uses.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title TipJar
/// @notice Accepts USDC tips with an optional message and keeps an onchain feed.
/// @dev On Base mainnet, deploy with the canonical USDC address
///      0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. The token is assumed to
///      have 6 decimals, like USDC.
contract TipJar {
    struct Tip {
        address tipper; // who sent the tip
        uint256 amount; // amount in USDC base units (6 decimals)
        string message; // optional message from the tipper
        uint256 timestamp; // block timestamp when the tip landed
    }

    /// @notice The USDC token this jar accepts.
    IERC20 public immutable usdc;

    /// @notice Owner who can withdraw accumulated tips.
    address public owner;

    /// @notice Append-only feed of every tip received.
    Tip[] private _tips;

    /// @notice Running total tipped, in USDC base units.
    uint256 public totalTipped;

    /// @notice Per-address lifetime tip total, in USDC base units.
    mapping(address => uint256) public tippedBy;

    event NewTip(
        uint256 indexed index, address indexed tipper, uint256 amount, string message, uint256 timestamp
    );
    event Withdrawn(address indexed to, uint256 amount);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed();
    error NotOwner();
    error NothingToWithdraw();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @param _usdc Address of the USDC token to accept.
    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        owner = msg.sender;
        emit OwnerChanged(address(0), msg.sender);
    }

    /// @notice Send a tip. The caller must have approved this contract to spend
    ///         `amount` of USDC first.
    /// @param amount Amount of USDC (base units, 6 decimals) to tip.
    /// @param message Optional message to attach to the tip.
    function tip(uint256 amount, string calldata message) external {
        if (amount == 0) revert ZeroAmount();

        // Pull the USDC from the tipper. USDC returns true on success; a false
        // return or a revert both leave the tip unrecorded.
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        uint256 index = _tips.length;
        _tips.push(Tip({tipper: msg.sender, amount: amount, message: message, timestamp: block.timestamp}));

        totalTipped += amount;
        tippedBy[msg.sender] += amount;

        emit NewTip(index, msg.sender, amount, message, block.timestamp);
    }

    /// @notice Total number of tips recorded.
    function tipCount() external view returns (uint256) {
        return _tips.length;
    }

    /// @notice Read a single tip by index.
    function getTip(uint256 index) external view returns (Tip memory) {
        return _tips[index];
    }

    /// @notice Return the most recent `count` tips, newest first.
    /// @param count Maximum number of tips to return.
    function getRecentTips(uint256 count) external view returns (Tip[] memory) {
        uint256 total = _tips.length;
        uint256 n = count < total ? count : total;
        Tip[] memory out = new Tip[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = _tips[total - 1 - i];
        }
        return out;
    }

    /// @notice Current USDC balance held by the jar.
    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Withdraw the entire USDC balance to the owner.
    function withdraw() external onlyOwner {
        uint256 bal = usdc.balanceOf(address(this));
        if (bal == 0) revert NothingToWithdraw();
        bool ok = usdc.transfer(owner, bal);
        if (!ok) revert TransferFailed();
        emit Withdrawn(owner, bal);
    }

    /// @notice Transfer ownership of the jar.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }
}
