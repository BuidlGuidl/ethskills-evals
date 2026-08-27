// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MembershipNFT
/// @notice Minimal stand-in for the DAO's existing membership NFT so the local
///         chain has something to point at. In production you delete this and
///         point `MemberRegistry` at the real collection -- the registry only
///         ever calls `ownerOf`.
contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable minter;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotMinter();
    error AlreadyMinted();
    error NoSuchToken();
    error NotOwner();
    error ZeroAddress();

    constructor() {
        minter = msg.sender;
    }

    function mint(address to, uint256 tokenId) external {
        if (msg.sender != minter) revert NotMinter();
        if (to == address(0)) revert ZeroAddress();
        if (_owners[tokenId] != address(0)) revert AlreadyMinted();
        _owners[tokenId] = to;
        unchecked {
            _balances[to] += 1;
        }
        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NoSuchToken();
    }

    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert ZeroAddress();
        return _balances[owner];
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        if (_owners[tokenId] != from) revert NotOwner();
        if (msg.sender != from) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        _owners[tokenId] = to;
        unchecked {
            _balances[from] -= 1;
            _balances[to] += 1;
        }
        emit Transfer(from, to, tokenId);
    }
}
