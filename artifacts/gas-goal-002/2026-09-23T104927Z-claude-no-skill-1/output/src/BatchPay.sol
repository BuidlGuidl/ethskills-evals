// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal ERC-20 surface. Return data is validated by the callers below,
///         so tokens that return nothing (USDT-style) are handled too.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title BatchPay
 * @notice Batches many ERC-20 payouts into a single transaction.
 *
 * Two payout modes, with different custody trade-offs:
 *
 *  - `payFromBalance*`: this contract holds a working float. Each payout is a plain
 *    `transfer`, so the payer balance slot is written repeatedly and stays warm after
 *    the first write. Cheapest mode.
 *
 *  - `payFromRelayer*`: funds stay in the relayer EOA and move via `transferFrom`
 *    against a standing approval. No float is custodied here, at the cost of touching
 *    the allowance slot.
 *
 * Both modes are restricted to allowlisted relayers. The owner can sweep at any time,
 * so a float parked here is recoverable without a redeploy.
 */
contract BatchPay {
    /* ------------------------------------------------------------------ errors */

    error Unauthorized();
    error LengthMismatch();
    error BadPayload();
    error TransferFailed(address token, address to, uint256 amount);

    /* ------------------------------------------------------------------ events */

    event RelayerSet(address indexed relayer, bool allowed);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event BatchPaid(address indexed token, uint256 count, uint256 total);
    /// @notice Emitted by the lenient path when one payment fails but the batch continues.
    event PaymentSkipped(address indexed token, address indexed to, uint256 amount, uint256 index);

    /* ------------------------------------------------------------------- state */

    address public owner;
    mapping(address => bool) public isRelayer;

    /// @dev Each packed record is 32 bytes: 20-byte recipient || 12-byte amount.
    ///      12 bytes holds up to 7.9e28, far above any 6-decimal stablecoin payout.
    uint256 private constant RECORD_SIZE = 32;

    /* --------------------------------------------------------------- modifiers */

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyRelayer() {
        if (!isRelayer[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(address owner_, address relayer_) {
        owner = owner_;
        emit OwnerTransferred(address(0), owner_);
        if (relayer_ != address(0)) {
            isRelayer[relayer_] = true;
            emit RelayerSet(relayer_, true);
        }
    }

    /* ---------------------------------------------------------------- payouts */

    /// @notice Pay out from this contract's own float, ABI-encoded arrays.
    function payFromBalance(IERC20 token, address[] calldata to, uint256[] calldata amount)
        external
        onlyRelayer
    {
        uint256 n = to.length;
        if (n != amount.length) revert LengthMismatch();
        uint256 total;
        for (uint256 i; i < n; ++i) {
            _transfer(token, to[i], amount[i]);
            unchecked {
                total += amount[i];
            }
        }
        emit BatchPaid(address(token), n, total);
    }

    /// @notice Pay out from this contract's own float, packed payload.
    /// @param payload Concatenated 32-byte records of `20-byte recipient || 12-byte amount`.
    function payFromBalancePacked(IERC20 token, bytes calldata payload) external onlyRelayer {
        uint256 len = payload.length;
        if (len == 0 || len % RECORD_SIZE != 0) revert BadPayload();
        uint256 n = len / RECORD_SIZE;
        uint256 total;
        for (uint256 i; i < n; ++i) {
            (address to, uint256 amount) = _record(payload, i);
            _transfer(token, to, amount);
            unchecked {
                total += amount;
            }
        }
        emit BatchPaid(address(token), n, total);
    }

    /// @notice Pay out from the relayer EOA via a standing approval, packed payload.
    function payFromRelayerPacked(IERC20 token, bytes calldata payload) external onlyRelayer {
        uint256 len = payload.length;
        if (len == 0 || len % RECORD_SIZE != 0) revert BadPayload();
        uint256 n = len / RECORD_SIZE;
        uint256 total;
        for (uint256 i; i < n; ++i) {
            (address to, uint256 amount) = _record(payload, i);
            _transferFrom(token, msg.sender, to, amount);
            unchecked {
                total += amount;
            }
        }
        emit BatchPaid(address(token), n, total);
    }

    /// @notice Same as `payFromBalancePacked`, but a payment that reverts is skipped and
    ///         reported instead of reverting the whole batch.
    /// @dev USDC and similar tokens maintain a blacklist; without this path a single
    ///      blacklisted payee would block every other payment in the batch. Callers must
    ///      reconcile `PaymentSkipped` events and re-queue those payments.
    /// @return failures Number of payments that were skipped.
    function payFromBalancePackedLenient(IERC20 token, bytes calldata payload)
        external
        onlyRelayer
        returns (uint256 failures)
    {
        uint256 len = payload.length;
        if (len == 0 || len % RECORD_SIZE != 0) revert BadPayload();
        uint256 n = len / RECORD_SIZE;
        uint256 total;
        for (uint256 i; i < n; ++i) {
            (address to, uint256 amount) = _record(payload, i);
            (bool ok, bytes memory ret) =
                address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
            if (ok && (ret.length == 0 || abi.decode(ret, (bool)))) {
                unchecked {
                    total += amount;
                }
            } else {
                emit PaymentSkipped(address(token), to, amount, i);
                unchecked {
                    ++failures;
                }
            }
        }
        emit BatchPaid(address(token), n - failures, total);
    }

    /* ---------------------------------------------------------------- internals */

    /// @dev Reads record `i` out of calldata without copying the payload to memory.
    function _record(bytes calldata payload, uint256 i)
        private
        pure
        returns (address to, uint256 amount)
    {
        uint256 word;
        assembly {
            word := calldataload(add(payload.offset, mul(i, RECORD_SIZE)))
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        to = address(uint160(word >> 96));
        amount = word & type(uint96).max;
    }

    function _transfer(IERC20 token, address to, uint256 amount) private {
        (bool ok, bytes memory ret) =
            address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            revert TransferFailed(address(token), to, amount);
        }
    }

    function _transferFrom(IERC20 token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory ret) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            revert TransferFailed(address(token), to, amount);
        }
    }

    /* -------------------------------------------------------------- management */

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        isRelayer[relayer] = allowed;
        emit RelayerSet(relayer, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Unauthorized();
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Recover the float (or any stray token) to `to`.
    function sweep(IERC20 token, address to, uint256 amount) external onlyOwner {
        _transfer(token, to, amount == 0 ? token.balanceOf(address(this)) : amount);
    }
}
