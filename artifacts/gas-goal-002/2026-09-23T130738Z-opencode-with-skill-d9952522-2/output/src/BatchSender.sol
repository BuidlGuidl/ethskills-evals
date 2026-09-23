// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract BatchSender {
    struct Payment {
        address token;
        address to;
        uint256 amount;
    }

    bytes4 private constant TRANSFER_FROM = 0x23b872dd; // transferFrom(address,address,uint256)

    address public immutable owner;

    error NotOwner(address caller, address owner);
    error EmptyBatch();
    error ZeroOwner();
    error NotAContract(uint256 index, address token);
    error TransferFailed(uint256 index);

    event BatchSent(uint256 count);

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroOwner();
        owner = owner_;
    }

    function send(Payment[] calldata payments) external {
        address owner_ = owner;
        if (msg.sender != owner_) revert NotOwner(msg.sender, owner_);
        uint256 n = payments.length;
        if (n == 0) revert EmptyBatch();
        for (uint256 i; i < n; ++i) {
            Payment calldata p = payments[i];
            if (p.token.code.length == 0) revert NotAContract(i, p.token);
            (bool ok, bytes memory ret) = p.token.call(
                abi.encodePacked(TRANSFER_FROM, abi.encode(owner_, p.to, p.amount))
            );
            if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) {
                revert TransferFailed(i);
            }
        }
        emit BatchSent(n);
    }
}
