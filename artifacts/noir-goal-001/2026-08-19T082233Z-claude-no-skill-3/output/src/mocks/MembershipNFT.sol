// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title MembershipNFT
/// @notice Stand-in for the DAO's *existing* membership NFT, so the local
///         deployment has something to point at. In production you pass the
///         real collection's address to MembershipRegistry and delete this.
/// @dev    Minimal on purpose: only ownerOf/balanceOf/transfer are needed.
contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable issuer;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address) private _ownerOf;
    mapping(address owner => uint256) private _balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotIssuer();
    error AlreadyMinted();
    error NoSuchToken();
    error NotOwner();
    error ZeroAddress();

    constructor() {
        issuer = msg.sender;
    }

    function mint(address to, uint256 tokenId) external {
        if (msg.sender != issuer) revert NotIssuer();
        if (to == address(0)) revert ZeroAddress();
        if (_ownerOf[tokenId] != address(0)) revert AlreadyMinted();

        _ownerOf[tokenId] = to;
        _balanceOf[to] += 1;
        totalSupply += 1;

        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        owner = _ownerOf[tokenId];
        if (owner == address(0)) revert NoSuchToken();
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balanceOf[owner];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (_ownerOf[tokenId] != from || msg.sender != from) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();

        _ownerOf[tokenId] = to;
        _balanceOf[from] -= 1;
        _balanceOf[to] += 1;

        emit Transfer(from, to, tokenId);
    }
}
