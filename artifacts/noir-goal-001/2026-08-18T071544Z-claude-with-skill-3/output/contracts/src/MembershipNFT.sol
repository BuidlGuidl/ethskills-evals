// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title MembershipNFT
/// @notice Stand-in for the DAO's existing membership NFT so the local deploy has
///         something to point at. Soulbound: membership is not transferable.
///         Replace with the real NFT address in production - `AnonVoting` only
///         calls `balanceOf`.
contract MembershipNFT {
    string public constant name = "DAO Membership";
    string public constant symbol = "DAOM";

    address public immutable admin;
    uint256 public totalSupply;

    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    error NotAdmin();
    error AlreadyMember();
    error Soulbound();

    constructor(address _admin) {
        admin = _admin;
    }

    /// @notice Mint one membership token to `member`.
    function mint(address member) external returns (uint256 tokenId) {
        if (msg.sender != admin) revert NotAdmin();
        if (balanceOf[member] != 0) revert AlreadyMember();

        tokenId = ++totalSupply;
        ownerOf[tokenId] = member;
        balanceOf[member] = 1;
        emit Transfer(address(0), member, tokenId);
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd; // ERC165, ERC721
    }
}
