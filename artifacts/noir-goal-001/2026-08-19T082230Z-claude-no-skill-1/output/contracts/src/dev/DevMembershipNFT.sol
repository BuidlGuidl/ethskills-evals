// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title DevMembershipNFT
/// @notice Local-chain stand-in for the DAO's existing membership NFT, so the
///         deploy script and the tests have something to point at. The real
///         deployment passes the DAO's own NFT address to `MemberRegistry` and
///         never uses this file.
/// @dev Only the two functions the system actually reads (`ownerOf`,
///      `balanceOf`) plus minting and a plain transfer. Not a complete ERC-721.
contract DevMembershipNFT {
    string public constant name = "DAO Membership (dev)";
    string public constant symbol = "DAOM";

    address public immutable minter;
    uint256 public totalSupply;

    mapping(uint256 tokenId => address) private _ownerOf;
    mapping(address owner => uint256) private _balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotMinter();
    error NotOwner();
    error NoSuchToken(uint256 tokenId);
    error ZeroAddress();

    constructor(address minter_) {
        minter = minter_;
    }

    /// @notice Mint the next token to `to`. Token ids run from 0.
    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != minter) revert NotMinter();
        if (to == address(0)) revert ZeroAddress();
        tokenId = totalSupply++;
        _ownerOf[tokenId] = to;
        _balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function transfer(address to, uint256 tokenId) external {
        if (_ownerOf[tokenId] != msg.sender) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        _ownerOf[tokenId] = to;
        _balanceOf[msg.sender] -= 1;
        _balanceOf[to] += 1;
        emit Transfer(msg.sender, to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address owner) {
        owner = _ownerOf[tokenId];
        if (owner == address(0)) revert NoSuchToken(tokenId);
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _balanceOf[owner];
    }
}
