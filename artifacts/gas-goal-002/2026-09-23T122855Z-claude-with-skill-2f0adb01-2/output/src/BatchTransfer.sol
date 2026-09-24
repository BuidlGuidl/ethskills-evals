// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Minimal subset of the ERC-20 interface we need. Deliberately declared
///      with a bool return so we can tolerate non-compliant tokens below.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BatchTransfer
/// @notice Pulls one ERC-20 from a relayer wallet and fans it out to many
///         recipients in a single transaction.
///
/// The relayer approves this contract once per token, then sends batches. Each
/// recipient in a batch avoids the 21,000 gas intrinsic cost of its own
/// transaction and re-uses the warm token account, which is where nearly all of
/// the saving comes from.
///
/// Only `owner` may send batches so that an approval granted to this contract
/// cannot be drained by a third party.
contract BatchTransfer {
    error NotOwner();
    error LengthMismatch();
    error TransferFailed(uint256 index);
    error EmptyBatch();
    error ZeroAddress();

    address public owner;

    event OwnerChanged(address indexed from, address indexed to);

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        emit OwnerChanged(address(0), owner_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Fan out `amounts[i]` of `token` to `recipients[i]`, pulled from the caller.
    function disperse(IERC20 token, address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyOwner
    {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();
        if (n == 0) revert EmptyBatch();

        for (uint256 i = 0; i < n; ++i) {
            _pull(token, recipients[i], amounts[i], i);
        }
    }

    /// @notice Same as `disperse`, with each (recipient, amount) pair packed into
    ///         one 32-byte word: the top 160 bits are the address, the low 96
    ///         bits are the amount.
    /// @dev Halves calldata versus `disperse`. 96 bits holds 7.9e28 — ample for a
    ///      6-decimal stablecoin and for any 18-decimal token amount below
    ///      79 billion units. Callers must pre-validate amounts fit; see
    ///      `packEntry`, which reverts on overflow.
    function dispersePacked(IERC20 token, uint256[] calldata entries) external onlyOwner {
        uint256 n = entries.length;
        if (n == 0) revert EmptyBatch();

        for (uint256 i = 0; i < n; ++i) {
            uint256 entry = entries[i];
            _pull(token, address(uint160(entry >> 96)), entry & type(uint96).max, i);
        }
    }

    function _pull(IERC20 token, address to, uint256 amount, uint256 index) private {
        // Tolerates tokens that return nothing (e.g. older USDT-style ERC-20s)
        // as well as tokens that return a bool.
        (bool ok, bytes memory ret) = address(token).call(
            abi.encodeCall(IERC20.transferFrom, (msg.sender, to, amount))
        );
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed(index);
    }

    /// @notice Helper for building `dispersePacked` calldata off-chain or in tests.
    function packEntry(address to, uint256 amount) external pure returns (uint256) {
        require(amount <= type(uint96).max, "amount > 96 bits");
        return (uint256(uint160(to)) << 96) | amount;
    }
}
