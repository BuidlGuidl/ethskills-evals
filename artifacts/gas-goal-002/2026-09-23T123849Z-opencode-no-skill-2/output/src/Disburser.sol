// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title Disburser — packs many ERC-20 transfers into one transaction
/// @notice Transfers are encoded as 32-byte chunks, big-endian:
///         [0:20] recipient address, [20:32] uint96 amount.
///         `disburseFrom(token, packed, strict)` pulls the batch total from the
///         caller via ERC-20 allowance, then sends each transfer. It holds no
///         custody: in safe mode (strict == false) failures are skipped,
///         reported with `TransferFailed`, and the leftover is swept back to the
///         caller. In strict mode (strict == true) any failure reverts the batch.
contract Disburser {
    event Disbursed(
        address indexed token, address indexed caller, uint256 attempted, uint256 succeeded, uint256 amount
    );
    event TransferFailed(address indexed token, uint256 indexed index, address recipient, uint256 amount);

    error EmptyBatch();
    error BadPackedLength(uint256 length);
    error PullFailed();
    error SweepFailed();
    error TransferFailedAt(uint256 index);
    error InvalidRecipient(uint256 index);
    error OnlySelf();

    uint256 private constant CHUNK_SIZE = 32;

    function disburseFrom(address token, bytes calldata packed, bool strict) external {
        uint256 total = _sum(packed);
        bool pulled;
        try IERC20(token).transferFrom(msg.sender, address(this), total) returns (bool ok) {
            pulled = ok;
        } catch {
            pulled = false;
        }
        if (!pulled) revert PullFailed();
        _send(token, packed, strict);
    }

    /// @notice EIP-7702 entry point: run this contract's batch loop against the
    ///         caller's own token balance. Only reachable when this code is
    ///         delegated into the relayer EOA via an authorization list, where
    ///         msg.sender == address(this) == the EOA.
    function disburseOwn(address token, bytes calldata packed, bool strict) external {
        if (msg.sender != address(this)) revert OnlySelf();
        _send(token, packed, strict);
    }

    function _sum(bytes calldata packed) private pure returns (uint256 total) {
        uint256 n = _count(packed);
        for (uint256 i = 0; i < n; ++i) {
            (, uint96 amount) = _chunk(packed, i);
            total += amount;
        }
    }

    function _send(address token, bytes calldata packed, bool strict) private {
        uint256 n = _count(packed);
        uint256 sent;
        uint256 okCount;
        for (uint256 i = 0; i < n; ++i) {
            (address to, uint96 amount) = _chunk(packed, i);
            if (to == address(0) || amount == 0) {
                if (strict) revert InvalidRecipient(i);
                emit TransferFailed(token, i, to, amount);
                continue;
            }
            bool success;
            try IERC20(token).transfer(to, amount) returns (bool ok) {
                success = ok;
            } catch {
                success = false;
            }
            if (success) {
                sent += amount;
                okCount++;
            } else if (strict) {
                revert TransferFailedAt(i);
            } else {
                emit TransferFailed(token, i, to, amount);
            }
        }
        if (!strict) {
            uint256 leftover = IERC20(token).balanceOf(address(this));
            if (leftover != 0) {
                try IERC20(token).transfer(msg.sender, leftover) returns (bool ok) {
                    if (!ok) revert SweepFailed();
                } catch {
                    revert SweepFailed();
                }
            }
        }
        emit Disbursed(token, msg.sender, n, okCount, sent);
    }

    function _count(bytes calldata packed) private pure returns (uint256) {
        if (packed.length == 0) revert EmptyBatch();
        uint256 n = packed.length / CHUNK_SIZE;
        if (n * CHUNK_SIZE != packed.length) revert BadPackedLength(packed.length);
        return n;
    }

    function _chunk(bytes calldata packed, uint256 i) private pure returns (address to, uint96 amount) {
        bytes32 c = bytes32(packed[i * CHUNK_SIZE:(i + 1) * CHUNK_SIZE]);
        to = address(bytes20(c));
        amount = uint96(bytes12(c << 160));
    }
}
