// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MembershipNFT
/// @notice Stand-in for the DAO's real membership NFT so the rest of this repo can
///         be deployed and exercised on a local chain. In production you would point
///         `MemberRegistry` at the NFT you already have; nothing here is special,
///         `MemberRegistry` only ever calls `balanceOf`.
/// @dev Minimal ERC-721: enough of the interface to be a real token, without
///         metadata, enumeration or safe-transfer callbacks.
contract MembershipNFT {
    string public name = "DAO Membership";
    string public symbol = "DAOM";

    address public immutable admin;
    uint256 public totalSupply;

    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    error NotAdmin();
    error NotAuthorized();
    error WrongOwner();
    error ZeroAddress();

    constructor(address admin_) {
        admin = admin_;
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != admin) revert NotAdmin();
        if (to == address(0)) revert ZeroAddress();
        tokenId = ++totalSupply;
        ownerOf[tokenId] = to;
        balanceOf[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function approve(address spender, uint256 tokenId) external {
        address owner = ownerOf[tokenId];
        if (msg.sender != owner && !isApprovedForAll[owner][msg.sender]) revert NotAuthorized();
        getApproved[tokenId] = spender;
        emit Approval(owner, spender, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (ownerOf[tokenId] != from) revert WrongOwner();
        if (to == address(0)) revert ZeroAddress();
        if (msg.sender != from && msg.sender != getApproved[tokenId] && !isApprovedForAll[from][msg.sender]) {
            revert NotAuthorized();
        }
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        ownerOf[tokenId] = to;
        delete getApproved[tokenId];
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd;
    }
}
