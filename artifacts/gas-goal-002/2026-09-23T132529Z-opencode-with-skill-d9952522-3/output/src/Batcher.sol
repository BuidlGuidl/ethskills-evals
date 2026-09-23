// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Batcher
/// @notice Amortizes the 21,000-gas intrinsic cost of a transaction across many
///         ERC-20 payments. The relayer (owner) holds the tokens and approves this
///         contract once with type(uint256).max; each payment is then a
///         transferFrom(msg.sender, ...) inside a single transaction.
///
///         Security: only the owner can trigger transfers, and funds are always
///         pulled from the owner (msg.sender is not enough on its own — the
///         approval + onlyOwner pair is what makes the allowance safe).
contract Batcher {
    address public immutable owner;

    error NotOwner();
    error LengthMismatch();
    error EmptyBatch();

    event Payment(address indexed token, address indexed to, uint256 amount, bool ok);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Send many payments of one token in a single transaction.
    /// @dev    A failing payment does NOT revert the batch; its slot in the
    ///         returned array (and the Payment event) is false. Callers should
    ///         reconcile off-chain and retry failures individually.
    /// @param token   ERC-20 contract address.
    /// @param to      Recipient addresses.
    /// @param amounts Amounts in the token's smallest unit.
    /// @return ok     Per-payment success flags.
    function batch(address token, address[] calldata to, uint256[] calldata amounts)
        external
        onlyOwner
        returns (bool[] memory ok)
    {
        uint256 n = to.length;
        if (n != amounts.length) revert LengthMismatch();
        if (n == 0) revert EmptyBatch();

        ok = new bool[](n);
        for (uint256 i; i < n; ++i) {
            try IERC20(token).transferFrom(msg.sender, to[i], amounts[i]) returns (bool success) {
                ok[i] = success;
            } catch {
                ok[i] = false;
            }
            emit Payment(token, to[i], amounts[i], ok[i]);
        }
    }

    /// @notice Rescue tokens sent to this contract by mistake.
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(to, amount), "rescue failed");
    }
}
