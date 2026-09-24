// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @notice The only part of the DAO's membership NFT the voting system relies on.
interface IMembershipNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function balanceOf(address owner) external view returns (uint256);
}

/// @notice Minimal stand-in for the DAO's existing membership NFT, used for local
///         deployments and tests. In production, point VoterRegistry at the real NFT
///         (any ERC-721 works; burned tokens must make ownerOf revert or return 0).
contract MembershipNFT is IMembershipNFT {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    address public immutable admin;
    uint256 public totalMinted;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) public balanceOf;

    error NotAdmin();
    error NotOwner();
    error NonexistentToken();

    constructor(address admin_) {
        admin = admin_;
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NonexistentToken();
    }

    function mint(address to) external returns (uint256 tokenId) {
        if (msg.sender != admin) revert NotAdmin();
        tokenId = ++totalMinted;
        _owners[tokenId] = to;
        balanceOf[to]++;
        emit Transfer(address(0), to, tokenId);
    }

    function burn(uint256 tokenId) external {
        if (msg.sender != admin) revert NotAdmin();
        address owner = ownerOf(tokenId);
        delete _owners[tokenId];
        balanceOf[owner]--;
        emit Transfer(owner, address(0), tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        if (ownerOf(tokenId) != from || msg.sender != from) revert NotOwner();
        _owners[tokenId] = to;
        balanceOf[from]--;
        balanceOf[to]++;
        emit Transfer(from, to, tokenId);
    }
}
