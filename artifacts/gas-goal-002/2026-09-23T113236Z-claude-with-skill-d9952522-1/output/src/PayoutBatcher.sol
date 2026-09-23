// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title PayoutBatcher
/// @notice Batches ERC-20 payouts for a relayer-operated payments app.
///
/// The contract holds the payout float itself. That is deliberate: it keeps the
/// token balance slot being debited warm for the whole batch, which is where most
/// of the saving comes from. Funding it is a normal ERC-20 transfer from treasury.
///
/// `batchTransferPacked` takes recipients as tightly packed 31-byte records
/// (20-byte address ++ 11-byte amount) rather than ABI arrays. uint88 holds
/// 3.09e26, far above any USDC (6dp) or 18dp payout this app sends.
contract PayoutBatcher {
    /// @dev Record layout in calldata: 20 bytes recipient ++ 11 bytes amount.
    uint256 private constant RECORD_SIZE = 31;

    address public immutable token;
    address public immutable owner;

    mapping(address => bool) public isRelayer;

    error NotOwner();
    error NotRelayer();
    error BadPayloadLength();
    error TransferFailed(address to, uint256 amount);

    event RelayerSet(address indexed relayer, bool allowed);
    event Swept(address indexed to, uint256 amount);

    constructor(address _token, address _owner) {
        token = _token;
        owner = _owner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setRelayer(address relayer, bool allowed) external onlyOwner {
        isRelayer[relayer] = allowed;
        emit RelayerSet(relayer, allowed);
    }

    /// @notice Return the float (or a stuck token) to the owner.
    function sweep(address tokenToSweep, address to, uint256 amount) external onlyOwner {
        _transfer(tokenToSweep, to, amount);
        emit Swept(to, amount);
    }

    /// @notice Pay out a batch. `payload` is `n` packed 31-byte records.
    /// @dev Reverts the whole batch if any single transfer fails, so the relayer
    ///      never has to reconcile a partially-applied batch.
    function batchTransferPacked(bytes calldata payload) external {
        if (!isRelayer[msg.sender]) revert NotRelayer();

        uint256 len = payload.length;
        if (len == 0 || len % RECORD_SIZE != 0) revert BadPayloadLength();

        address _token = token;

        assembly ("memory-safe") {
            let fmp := mload(0x40)
            let off := payload.offset
            let end := add(off, len)
            // transfer(address,uint256) calldata lives at 0x1c..0x60 for the whole
            // loop; only the two argument words are rewritten per recipient.
            mstore(0x00, 0xa9059cbb)

            for {} lt(off, end) { off := add(off, RECORD_SIZE) } {
                let word := calldataload(off)
                let to := shr(96, word)
                let amount := shr(168, shl(160, word))

                mstore(0x20, to)
                mstore(0x40, amount)

                let ok := call(gas(), _token, 0, 0x1c, 0x44, 0x00, 0x20)
                // Accept no return data (non-standard tokens) or an explicit `true`.
                if ok { if returndatasize() { ok := eq(mload(0x00), 1) } }

                if iszero(ok) {
                    mstore(0x00, 0x1c43b976) // TransferFailed(address,uint256)
                    mstore(0x20, to)
                    mstore(0x40, amount)
                    revert(0x1c, 0x44)
                }
                // Restore the selector; the success path clobbered 0x00 with retdata.
                mstore(0x00, 0xa9059cbb)
            }

            mstore(0x40, fmp)
        }
    }

    /// @notice ABI-array form, kept for callers that cannot pack calldata.
    function batchTransfer(address[] calldata to, uint256[] calldata amount) external {
        if (!isRelayer[msg.sender]) revert NotRelayer();
        if (to.length != amount.length) revert BadPayloadLength();
        address _token = token;
        for (uint256 i; i < to.length;) {
            _transfer(_token, to[i], amount[i]);
            unchecked { ++i; }
        }
    }

    function _transfer(address _token, address to, uint256 amount) private {
        (bool ok, bytes memory ret) =
            _token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
            revert TransferFailed(to, amount);
        }
    }
}
